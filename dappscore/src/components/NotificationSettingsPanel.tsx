'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, MessageSquare, Webhook, Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface AlertPreferences {
  enableEmail:          boolean;
  enableTelegram:       boolean;
  enableWebhook:        boolean;
  enablePush:           boolean;
  trustChangeAlerts:    boolean;
  scamFlagAlerts:       boolean;
  whaleActivityAlerts:  boolean;
  voteThresholdAlerts:  boolean;
  marketAlerts:         boolean;
  minSeverity:          'low' | 'medium' | 'high' | 'critical';
  email?:               string;
  telegram?:            string;
  webhook?:             string;
}

const DEFAULT_PREFS: AlertPreferences = {
  enableEmail:         false,
  enableTelegram:      false,
  enableWebhook:       false,
  enablePush:          true,
  trustChangeAlerts:   true,
  scamFlagAlerts:      true,
  whaleActivityAlerts: true,
  voteThresholdAlerts: false,
  marketAlerts:        false,
  minSeverity:         'low',
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-yellow-500' : 'bg-gray-600'}`}
    >
      <div className={`w-5 h-5 bg-white rounded-full transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  );
}

function Row({ label, desc, enabled, onChange }: {
  label: string; desc: string; enabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium text-sm">{label}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
      <Toggle enabled={enabled} onChange={onChange} />
    </div>
  );
}

export default function NotificationSettingsPanel({ walletAddress }: { walletAddress: string }) {
  const [prefs, setPrefs] = useState<AlertPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/alerts/preferences`, {
      headers: { 'x-user-id': walletAddress },
    })
      .then(r => r.json())
      .then(json => {
        if (json.success && json.data) setPrefs({ ...DEFAULT_PREFS, ...json.data });
      })
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false));
  }, [walletAddress]);

  const set = <K extends keyof AlertPreferences>(key: K, value: AlertPreferences[K]) =>
    setPrefs(p => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/alerts/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-user-id': walletAddress },
        body: JSON.stringify(prefs),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Alert Types ──────────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Bell className="h-5 w-5 text-yellow-500" />
          Alert Types
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          Choose which events create alerts. These apply across all delivery channels.
        </p>
        <div className="space-y-4">
          <Row
            label="Scam Flags"
            desc="When a watched project is flagged as a potential scam"
            enabled={prefs.scamFlagAlerts}
            onChange={v => set('scamFlagAlerts', v)}
          />
          <Row
            label="Trust Level Changes"
            desc="When a watched project's trust rating is updated"
            enabled={prefs.trustChangeAlerts}
            onChange={v => set('trustChangeAlerts', v)}
          />
          <Row
            label="Whale Activity"
            desc="Large wallet movements in watched projects"
            enabled={prefs.whaleActivityAlerts}
            onChange={v => set('whaleActivityAlerts', v)}
          />
          <Row
            label="Vote Milestones"
            desc="When a watched project crosses significant vote thresholds"
            enabled={prefs.voteThresholdAlerts}
            onChange={v => set('voteThresholdAlerts', v)}
          />
          <Row
            label="Market Resolutions"
            desc="When prediction markets for projects are resolved"
            enabled={prefs.marketAlerts}
            onChange={v => set('marketAlerts', v)}
          />
        </div>

        <div className="mt-5 pt-5 border-t border-gray-700">
          <label className="block text-sm font-medium mb-2">Minimum severity</label>
          <div className="flex gap-2 flex-wrap">
            {(['low', 'medium', 'high', 'critical'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => set('minSeverity', s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  prefs.minSeverity === s
                    ? 'bg-yellow-500 text-black'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Alerts below this severity level are stored but not delivered.
          </p>
        </div>
      </div>

      {/* ── Delivery Channels ────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-500" />
          Delivery Channels
        </h2>
        <p className="text-sm text-gray-400 mb-5">
          In-app notifications are always on. Add optional channels below.
        </p>
        <div className="space-y-6">

          {/* In-app / Push */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm flex items-center gap-2">
                <Bell className="h-4 w-4 text-yellow-500" />
                In-app Notifications
              </div>
              <div className="text-xs text-gray-400">Alerts appear in your dashboard</div>
            </div>
            <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-medium">Always on</span>
          </div>

          {/* Email */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-400" />
                  Email Notifications
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Optional</span>
                </div>
                <div className="text-xs text-gray-400">Delivered immediately via Resend</div>
              </div>
              <Toggle enabled={prefs.enableEmail} onChange={v => set('enableEmail', v)} />
            </div>
            {prefs.enableEmail && (
              <input
                type="email"
                value={prefs.email ?? ''}
                onChange={e => set('email', e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            )}
          </div>

          {/* Telegram */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-sky-400" />
                  Telegram
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Optional</span>
                </div>
                <div className="text-xs text-gray-400">Get alerts via @DappScoreBot</div>
              </div>
              <Toggle enabled={prefs.enableTelegram} onChange={v => set('enableTelegram', v)} />
            </div>
            {prefs.enableTelegram && (
              <input
                type="text"
                value={prefs.telegram ?? ''}
                onChange={e => set('telegram', e.target.value)}
                placeholder="Your Telegram chat ID"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            )}
          </div>

          {/* Webhook */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-purple-400" />
                  Webhook
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Optional</span>
                </div>
                <div className="text-xs text-gray-400">HMAC-signed POST to your endpoint</div>
              </div>
              <Toggle enabled={prefs.enableWebhook} onChange={v => set('enableWebhook', v)} />
            </div>
            {prefs.enableWebhook && (
              <input
                type="url"
                value={prefs.webhook ?? ''}
                onChange={e => set('webhook', e.target.value)}
                placeholder="https://your-server.com/webhook"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm focus:border-yellow-500 focus:outline-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Save ─────────────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-4 py-3">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
        ) : saved ? (
          <><CheckCircle className="h-4 w-4" /> Saved</>
        ) : (
          <><Save className="h-4 w-4" /> Save Notification Settings</>
        )}
      </button>
    </div>
  );
}
