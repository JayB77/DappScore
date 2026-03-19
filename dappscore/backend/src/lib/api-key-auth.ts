import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { db } from './db';

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
 * Middleware: validate a Bearer API key against the api_keys PostgreSQL table.
 *
 * @param permission    Optional permission string that must be in the key's permissions array.
 * @param projectParam  Optional Express route param name (e.g. 'id') whose value must match
 *                      the key's project_id field. Use this when a key is scoped to a project.
 */
export function requireApiKey(permission?: string, projectParam?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authorization header required.',
        hint: 'Authorization: Bearer sk_live_...',
      });
      return;
    }

    const key = header.slice(7).trim();
    if (!key.startsWith('sk_')) {
      res.status(401).json({ error: 'Invalid API key format. Keys begin with sk_live_.' });
      return;
    }

    const hash = hashApiKey(key);

    try {
      const { rows } = await db.query<{
        id: string; key_prefix: string; name: string; owner_id: string;
        project_id: string | null; permissions: string[]; active: boolean;
        usage_count: number; expires_at: Date | null;
      }>(
        `SELECT id, key_prefix, name, owner_id, project_id, permissions,
                active, usage_count, expires_at
         FROM api_keys
         WHERE key_hash = $1 AND active = TRUE
         LIMIT 1`,
        [hash],
      );

      if (rows.length === 0) {
        res.status(403).json({ error: 'Invalid or revoked API key.' });
        return;
      }

      const row = rows[0];

      if (row.expires_at && row.expires_at < new Date()) {
        res.status(403).json({ error: 'API key has expired.' });
        return;
      }

      const keyData: ApiKeyData = {
        id:          row.id,
        keyPrefix:   row.key_prefix,
        name:        row.name,
        ownerId:     row.owner_id,
        projectId:   row.project_id ?? undefined,
        permissions: row.permissions ?? [],
        active:      row.active,
        usageCount:  row.usage_count,
      };

      if (permission && !keyData.permissions.includes(permission)) {
        res.status(403).json({
          error:    'Insufficient permissions.',
          required: permission,
          granted:  keyData.permissions,
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
      db.query(
        'UPDATE api_keys SET last_used_at = NOW(), usage_count = usage_count + 1 WHERE id = $1',
        [row.id],
      ).catch(() => {/* non-fatal */});

      req.apiKeyData = keyData;
      next();
    } catch (err) {
      console.error('API key validation error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  };
}
