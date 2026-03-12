import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export interface ApiKeyData {
  id: string;
  keyPrefix: string;
  name: string;
  ownerId: string;
  projectId?: string;
  permissions: string[];
  active: boolean;
  usageCount: number;
}

// Extend Express Request to carry resolved key data downstream
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      apiKeyData?: ApiKeyData;
    }
  }
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Middleware: validate a Bearer API key against the `api_keys` Firestore collection.
 *
 * @param permission  Optional permission string that must be in the key's `permissions` array.
 * @param projectParam  Optional Express route param name (e.g. 'id') whose value must match
 *                      the key's `projectId` field. Use this when a key is scoped to a project.
 */
export function requireApiKey(permission?: string, projectParam?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authorization header required.',
        hint: 'Authorization: Bearer sk_test_...',
      });
      return;
    }

    const key = header.slice(7).trim();
    if (!key.startsWith('sk_')) {
      res.status(401).json({ error: 'Invalid API key format. Keys begin with sk_test_ or sk_live_.' });
      return;
    }

    const hash = hashApiKey(key);
    const db = getFirestore();

    try {
      const snap = await db
        .collection('api_keys')
        .where('keyHash', '==', hash)
        .where('active', '==', true)
        .limit(1)
        .get();

      if (snap.empty) {
        res.status(403).json({ error: 'Invalid or revoked API key.' });
        return;
      }

      const doc = snap.docs[0];
      const d = doc.data();

      // Check expiry
      if (d.expiresAt) {
        const expiresAt: Date = d.expiresAt.toDate();
        if (expiresAt < new Date()) {
          res.status(403).json({ error: 'API key has expired.' });
          return;
        }
      }

      const keyData: ApiKeyData = {
        id: doc.id,
        keyPrefix: d.keyPrefix,
        name: d.name,
        ownerId: d.ownerId,
        projectId: d.projectId,
        permissions: d.permissions ?? [],
        active: d.active,
        usageCount: d.usageCount ?? 0,
      };

      if (permission && !keyData.permissions.includes(permission)) {
        res.status(403).json({
          error: 'Insufficient permissions.',
          required: permission,
          granted: keyData.permissions,
        });
        return;
      }

      if (projectParam) {
        const routeProjectId = req.params[projectParam];
        if (keyData.projectId && keyData.projectId !== routeProjectId) {
          res.status(403).json({
            error: 'This API key is not authorized for the requested project.',
          });
          return;
        }
      }

      // Fire-and-forget: update usage stats
      doc.ref.update({
        lastUsedAt: FieldValue.serverTimestamp(),
        usageCount: FieldValue.increment(1),
      }).catch(() => {/* non-fatal */});

      req.apiKeyData = keyData;
      next();
    } catch (err) {
      console.error('API key validation error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };
}
