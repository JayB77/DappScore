/**
 * notify.ts — fan out in-app alerts to opted-in users when platform events occur.
 *
 * Called from incoming webhook handlers (incoming/graph, incoming/alchemy) after
 * an external event is received. Complements dispatchGlobalWebhook() which handles
 * outbound webhooks; this handles the in-app alert side.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { pushAlert } from '../routes/alerts';

// ── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_ORDER: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

// ── Trust level labels (mirrors smart contract enum) ─────────────────────────

const TRUST_LABELS: Record<number, string> = {
  0: 'New Listing', 1: 'Trusted', 2: 'Neutral',
  3: 'Suspicious',  4: 'Suspected Scam', 5: 'Probable Scam',
};

// ── Event → preference field mapping ─────────────────────────────────────────

const EVENT_PREF: Record<string, keyof AlertPrefs> = {
  'project.scam_flagged':  'scamFlagAlerts',
  'project.trust_changed': 'trustChangeAlerts',
  'whale.activity':        'whaleActivityAlerts',
  'vote.cast':             'voteThresholdAlerts',
  'market.resolved':       'marketAlerts',
};

interface AlertPrefs {
  scamFlagAlerts:       boolean;
  trustChangeAlerts:    boolean;
  whaleActivityAlerts:  boolean;
  voteThresholdAlerts:  boolean;
  marketAlerts:         boolean;
  minSeverity:          Severity;
}

// ── Alert content builder ─────────────────────────────────────────────────────

function buildContent(
  event: string,
  data: Record<string, unknown>,
): { title: string; message: string; severity: Severity } {
  const name = (data.projectName as string | undefined)
    ?? (data.projectId as string | undefined)
    ?? 'Unknown project';

  switch (event) {
    case 'project.scam_flagged':
      return {
        title:    `Scam alert: ${name}`,
        message:  `${name} has been flagged as a suspected scam by the community.`,
        severity: 'critical',
      };

    case 'project.trust_changed': {
      const newLevel = (data.newTrustLevel ?? data.trustLevel ?? 0) as number;
      const oldLevel = (data.oldTrustLevel ?? 0) as number;
      const newLabel = TRUST_LABELS[newLevel] ?? `Level ${newLevel}`;
      const oldLabel = TRUST_LABELS[oldLevel] ?? `Level ${oldLevel}`;
      const severity: Severity =
        newLevel >= 4 ? 'critical' : newLevel >= 3 ? 'high' : newLevel > oldLevel ? 'medium' : 'low';
      return {
        title:    `Trust change: ${name}`,
        message:  `${name} moved from "${oldLabel}" → "${newLabel}".`,
        severity,
      };
    }

    case 'whale.activity': {
      const value  = data.value  as number | undefined;
      const asset  = data.asset  as string | undefined ?? 'tokens';
      const from   = data.fromAddress as string | undefined;
      const short  = from ? `${from.slice(0, 6)}…${from.slice(-4)}` : 'unknown';
      return {
        title:    `Whale move: ${value?.toLocaleString() ?? '?'} ${asset}`,
        message:  `${short} transferred ${value?.toLocaleString() ?? '?'} ${asset}.`,
        severity: 'medium',
      };
    }

    case 'market.resolved':
      return {
        title:    `Market resolved: ${name}`,
        message:  `A prediction market for "${name}" has been resolved.`,
        severity: 'low',
      };

    default:
      return {
        title:    event,
        message:  JSON.stringify(data).slice(0, 200),
        severity: 'low',
      };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Write in-app alerts for all users who opted in to the given event type
 * and whose minSeverity threshold is met.
 *
 * Fire-and-forget safe — logs errors but does not throw.
 */
export async function notifyUsersForEvent(
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  const prefField = EVENT_PREF[event];
  if (!prefField) return;

  const { title, message, severity } = buildContent(event, data);

  try {
    const snap = await getFirestore()
      .collection('alert_preferences')
      .where(prefField, '==', true)
      .get();

    if (snap.empty) return;

    await Promise.allSettled(
      snap.docs.map(async doc => {
        const prefs = doc.data() as Partial<AlertPrefs>;
        const minSev = (prefs.minSeverity ?? 'low') as Severity;
        if (SEVERITY_ORDER[severity] < SEVERITY_ORDER[minSev]) return;

        await pushAlert(doc.id, { type: event, title, message, severity, data });
      }),
    );
  } catch (err) {
    console.error('[notify] notifyUsersForEvent failed:', err);
  }
}
