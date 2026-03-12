import { Router, Request, Response } from 'express';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';
import { requireUserId } from '../lib/auth';
import { hashApiKey } from '../lib/api-key-auth';

const router = Router();

export const VALID_PERMISSIONS = ['sale:write', 'webhooks:manage', 'data:read'] as const;
export type Permission = typeof VALID_PERMISSIONS[number];

const MAX_KEYS_PER_USER = 10;

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString('hex'); // 64 hex chars = 256 bits
  const key = `sk_test_${raw}`;
  const hash = hashApiKey(key);
  const prefix = key.slice(0, 16); // "sk_test_" + first 8 chars of random
  return { key, hash, prefix };
}

function formatDoc(id: string, d: FirebaseFirestore.DocumentData) {
  return {
    id,
    keyPrefix: d.keyPrefix,
    name: d.name,
    projectId: d.projectId ?? null,
    permissions: d.permissions ?? [],
    active: d.active,
    createdAt: d.createdAt?.toDate?.()?.toISOString() ?? null,
    lastUsedAt: d.lastUsedAt?.toDate?.()?.toISOString() ?? null,
    revokedAt: d.revokedAt?.toDate?.()?.toISOString() ?? null,
    usageCount: d.usageCount ?? 0,
  };
}

// ── POST /api/v1/api-keys ─────────────────────────────────────────────────────
// Create a new API key. The full key is returned ONCE — it is never stored in
// plaintext and cannot be retrieved again.

router.post('/', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  const { name, projectId, permissions = ['sale:write'] } = req.body;

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
    const db = getFirestore();

    // Enforce per-user key limit
    const countSnap = await db
      .collection('api_keys')
      .where('ownerId', '==', ownerId)
      .where('active', '==', true)
      .count()
      .get();

    if (countSnap.data().count >= MAX_KEYS_PER_USER) {
      res.status(429).json({
        error: `Maximum of ${MAX_KEYS_PER_USER} active API keys per user. Revoke an existing key first.`,
      });
      return;
    }

    const { key, hash, prefix } = generateApiKey();

    const docData: Record<string, unknown> = {
      keyHash: hash,
      keyPrefix: prefix,
      name: name.trim(),
      ownerId,
      permissions,
      active: true,
      createdAt: FieldValue.serverTimestamp(),
      lastUsedAt: null,
      revokedAt: null,
      usageCount: 0,
    };
    if (projectId) docData.projectId = projectId.trim();

    const docRef = await db.collection('api_keys').add(docData);

    res.status(201).json({
      id: docRef.id,
      key,   // ← only time the full key is returned
      keyPrefix: prefix,
      name: name.trim(),
      projectId: projectId ?? null,
      permissions,
      active: true,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
      _warning: 'Save this key now — it will not be shown again.',
    });
  } catch (err) {
    console.error('POST /api-keys error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/v1/api-keys ──────────────────────────────────────────────────────
// List all API keys belonging to the caller. The secret value is never returned.

router.get('/', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const db = getFirestore();
    const snap = await db
      .collection('api_keys')
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .get();

    const keys = snap.docs.map(doc => formatDoc(doc.id, doc.data()));
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
    const db = getFirestore();
    const doc = await db.collection('api_keys').doc(req.params.keyId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    if (doc.data()!.ownerId !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    res.json(formatDoc(doc.id, doc.data()!));
  } catch (err) {
    console.error('GET /api-keys/:keyId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PATCH /api/v1/api-keys/:keyId ────────────────────────────────────────────
// Update the key's display name.

router.patch('/:keyId', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: '`name` is required.' });
    return;
  }

  try {
    const db = getFirestore();
    const doc = await db.collection('api_keys').doc(req.params.keyId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    if (doc.data()!.ownerId !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }

    await doc.ref.update({ name: name.trim() });
    res.json({ id: doc.id, name: name.trim() });
  } catch (err) {
    console.error('PATCH /api-keys/:keyId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── DELETE /api/v1/api-keys/:keyId ───────────────────────────────────────────
// Revoke (permanently deactivate) an API key.

router.delete('/:keyId', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const db = getFirestore();
    const doc = await db.collection('api_keys').doc(req.params.keyId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    if (doc.data()!.ownerId !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (!doc.data()!.active) {
      res.status(400).json({ error: 'Key is already revoked.' });
      return;
    }

    await doc.ref.update({ active: false, revokedAt: FieldValue.serverTimestamp() });
    res.json({ id: doc.id, revoked: true });
  } catch (err) {
    console.error('DELETE /api-keys/:keyId error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── POST /api/v1/api-keys/:keyId/rotate ──────────────────────────────────────
// Atomically revoke the existing key and issue a new one with the same settings.
// The new key is returned ONCE.

router.post('/:keyId/rotate', async (req: Request, res: Response) => {
  const ownerId = requireUserId(req, res);
  if (!ownerId) return;

  try {
    const db = getFirestore();
    const doc = await db.collection('api_keys').doc(req.params.keyId).get();

    if (!doc.exists) {
      res.status(404).json({ error: 'API key not found.' });
      return;
    }
    const old = doc.data()!;
    if (old.ownerId !== ownerId) {
      res.status(403).json({ error: 'Forbidden.' });
      return;
    }
    if (!old.active) {
      res.status(400).json({ error: 'Cannot rotate a revoked key.' });
      return;
    }

    const { key, hash, prefix } = generateApiKey();
    let newId = '';

    await db.runTransaction(async tx => {
      tx.update(doc.ref, { active: false, revokedAt: FieldValue.serverTimestamp() });

      const newRef = db.collection('api_keys').doc();
      newId = newRef.id;
      const newDoc: Record<string, unknown> = {
        keyHash: hash,
        keyPrefix: prefix,
        name: old.name,
        ownerId,
        permissions: old.permissions,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        lastUsedAt: null,
        revokedAt: null,
        usageCount: 0,
        rotatedFrom: doc.id,
      };
      if (old.projectId) newDoc.projectId = old.projectId;
      tx.set(newRef, newDoc);
    });

    res.json({
      id: newId,
      key,   // ← only time the full key is returned
      keyPrefix: prefix,
      name: old.name,
      projectId: old.projectId ?? null,
      permissions: old.permissions,
      active: true,
      usageCount: 0,
      createdAt: new Date().toISOString(),
      _warning: 'Save this key now — it will not be shown again. Previous key has been revoked.',
    });
  } catch (err) {
    console.error('POST /api-keys/:keyId/rotate error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
