import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { db, withTransaction } from '../lib/db';
import { requireUserId } from '../lib/auth';
import { hashApiKey } from '../lib/api-key-auth';
import { apiKeyMgmtLimit, apiKeyMutateLimit } from '../lib/rate-limit';

const router = Router();

router.use(apiKeyMgmtLimit);

export const VALID_PERMISSIONS = ['sale:write', 'webhooks:manage', 'data:read'] as const;
export type Permission = typeof VALID_PERMISSIONS[number];

const MAX_KEYS_PER_USER = 10;

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw    = randomBytes(48).toString('base64url');
  const key    = `sk_live_${raw}`;
  const hash   = hashApiKey(key);
  // Expose 32 chars of the key as the display prefix (24 random chars after "sk_live_").
  // This gives users enough uniqueness to identify their keys at a glance.
  const prefix = key.slice(0, 32);
  return { key, hash, prefix };
}

function formatRow(row: Record<string, unknown>) {
  return {
    id:          row.id,
    keyPrefix:   row.key_prefix,
    name:        row.name,
    projectId:   row.project_id ?? null,
    permissions: row.permissions ?? [],
    active:      row.active,
    createdAt:   row.created_at instanceof Date ? row.created_at.toISOString() : null,
    lastUsedAt:  row.last_used_at instanceof Date ? row.last_used_at.toISOString() : null,
    revokedAt:   row.revoked_at instanceof Date ? row.revoked_at.toISOString() : null,
    expiresAt:   row.expires_at instanceof Date ? row.expires_at.toISOString() : null,
    usageCount:  row.usage_count ?? 0,
  };
}

function parseExpiry(input: unknown): Date | null {
  if (input === undefined || input === null) return null;
  if (typeof input === 'number' && input > 0) {
    const d = new Date();
    d.setDate(d.getDate() + input);
    return d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    if (!isNaN(d.getTime()) && d > new Date()) return d;
  }
  return null;
}

// ── POST /api/v1/api-keys ─────────────────────────────────────────────────────

router.post('/', apiKeyMutateLimit, async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  const { name, projectId, permissions = ['sale:write'], expiresIn } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: '`name` is required.' });
    return;
  }
  if (name.length > 100) {
    res.status(400).json({ error: '`name` must be ≤ 100 characters.' });
    return;
  }
  if (!Array.isArray(permissions) || permissions.length === 0) {
    res.status(400).json({ error: '`permissions` must be a non-empty array.' });
    return;
  }
  const invalid = permissions.filter((p: string) => !(VALID_PERMISSIONS as readonly string[]).includes(p));
  if (invalid.length > 0) {
    res.status(400).json({ error: `Invalid permissions: ${invalid.join(', ')}`, valid: VALID_PERMISSIONS });
    return;
  }
  if (projectId !== undefined && typeof projectId !== 'string') {
    res.status(400).json({ error: '`projectId` must be a string.' });
    return;
  }

  try {
    const { rows: countRows } = await db.query<{ count: string }>(
      `SELECT COUNT(*) FROM api_keys WHERE owner_id = $1 AND active = TRUE`,
      [ownerId],
    );

    if (parseInt(countRows[0].count, 10) >= MAX_KEYS_PER_USER) {
      res.status(429).json({
        error: `Maximum of ${MAX_KEYS_PER_USER} active API keys per user. Revoke an existing key first.`,
      });
      return;
    }

    const { key, hash, prefix } = generateApiKey();
    const expiresAt = parseExpiry(expiresIn);

    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO api_keys
         (key_hash, key_prefix, name, owner_id, project_id, permissions,
          active, usage_count, created_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6::text[],TRUE,0,NOW(),$7)
       RETURNING id`,
      [hash, prefix, name.trim(), ownerId,
       projectId ? projectId.trim() : null,
       `{${permissions.join(',')}}`,
       expiresAt ?? null],
    );

    res.status(201).json({
      id:          rows[0].id,
      key,
      keyPrefix:   prefix,
      name:        name.trim(),
      projectId:   projectId ?? null,
      permissions,
      active:      true,
      usageCount:  0,
      createdAt:   new Date().toISOString(),
      lastUsedAt:  null,
      revokedAt:   null,
      expiresAt:   expiresAt?.toISOString() ?? null,
      _warning:    'Save this key now — it will not be shown again.',
    });
  } catch (err) {
    console.error('POST /api-keys error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/v1/api-keys ──────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const { rows } = await db.query(
      `SELECT id, key_prefix, name, project_id, permissions, active,
              usage_count, created_at, last_used_at, revoked_at, expires_at
       FROM api_keys
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [ownerId],
    );

    const keys = rows.map(formatRow);
    res.json({ keys, total: keys.length });
  } catch (err) {
    console.error('GET /api-keys error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/v1/api-keys/:keyId ───────────────────────────────────────────────

router.get('/:keyId', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const { rows } = await db.query(
      `SELECT id, key_prefix, name, owner_id, project_id, permissions, active,
              usage_count, created_at, last_used_at, revoked_at, expires_at
       FROM api_keys WHERE id = $1`,
      [req.params.keyId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    if (rows[0].owner_id !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    res.json(formatRow(rows[0]));
  } catch (err) {
    console.error('GET /api-keys/:keyId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PATCH /api/v1/api-keys/:keyId ────────────────────────────────────────────

router.patch('/:keyId', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: '`name` is required.' });
    return;
  }

  try {
    const { rows } = await db.query<{ owner_id: string }>(
      'SELECT owner_id FROM api_keys WHERE id = $1',
      [req.params.keyId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    if (rows[0].owner_id !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    await db.query('UPDATE api_keys SET name = $1 WHERE id = $2', [name.trim(), req.params.keyId]);
    res.json({ id: req.params.keyId, name: name.trim() });
  } catch (err) {
    console.error('PATCH /api-keys/:keyId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── DELETE /api/v1/api-keys/:keyId ───────────────────────────────────────────

router.delete('/:keyId', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const { rows } = await db.query<{ owner_id: string; active: boolean }>(
      'SELECT owner_id, active FROM api_keys WHERE id = $1',
      [req.params.keyId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    if (rows[0].owner_id !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (!rows[0].active) {
      res.status(400).json({ error: 'Key is already revoked.' });
      return;
    }

    await db.query(
      'UPDATE api_keys SET active = FALSE, revoked_at = NOW() WHERE id = $1',
      [req.params.keyId],
    );
    res.json({ id: req.params.keyId, revoked: true });
  } catch (err) {
    console.error('DELETE /api-keys/:keyId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/v1/api-keys/:keyId/rotate ──────────────────────────────────────

router.post('/:keyId/rotate', apiKeyMutateLimit, async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const { rows } = await db.query(
      `SELECT id, owner_id, name, project_id, permissions, active
       FROM api_keys WHERE id = $1`,
      [req.params.keyId],
    );

    if (rows.length === 0) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    const old = rows[0];
    if (old.owner_id !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (!old.active) {
      res.status(400).json({ error: 'Cannot rotate a revoked key.' });
      return;
    }

    const { key, hash, prefix } = generateApiKey();

    const newId = await withTransaction(async client => {
      await client.query(
        'UPDATE api_keys SET active = FALSE, revoked_at = NOW() WHERE id = $1',
        [old.id],
      );

      const { rows: newRows } = await client.query<{ id: string }>(
        `INSERT INTO api_keys
           (key_hash, key_prefix, name, owner_id, project_id, permissions,
            active, usage_count, rotated_from, created_at)
         VALUES ($1,$2,$3,$4,$5,$6::text[],TRUE,0,$7,NOW())
         RETURNING id`,
        [hash, prefix, old.name, ownerId,
         old.project_id ?? null,
         old.permissions,
         old.id],
      );
      return newRows[0].id;
    });

    res.json({
      id:          newId,
      key,
      keyPrefix:   prefix,
      name:        old.name,
      projectId:   old.project_id ?? null,
      permissions: old.permissions,
      active:      true,
      usageCount:  0,
      createdAt:   new Date().toISOString(),
      _warning:    'Save this key now — it will not be shown again. Previous key has been revoked.',
    });
  } catch (err) {
    console.error('POST /api-keys/:keyId/rotate error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
