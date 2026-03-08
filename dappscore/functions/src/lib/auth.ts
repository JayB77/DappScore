import { Request, Response, NextFunction } from 'express';

/** Read admin key from env — set via firebase functions:config:set or Secret Manager. */
function adminKey(): string {
  return process.env.ADMIN_API_KEY ?? '';
}

/**
 * Middleware: require `Authorization: Bearer <ADMIN_API_KEY>`.
 * Responds 401/403 on failure; calls next() on success.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const key = adminKey();
  if (!key) {
    res.status(500).json({ error: 'Server not configured for admin auth.' });
    return;
  }
  const header = req.headers.authorization ?? '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required.' });
    return;
  }
  const provided = header.slice(7).trim();
  if (provided.length !== key.length) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < provided.length; i++) diff |= provided.charCodeAt(i) ^ key.charCodeAt(i);
  if (diff !== 0) {
    res.status(403).json({ error: 'Forbidden.' });
    return;
  }
  next();
}

/** Extract `x-user-id` header (wallet address or UID). Respond 401 if absent. */
export function requireUserId(req: Request, res: Response): string | null {
  const id = req.headers['x-user-id'] as string | undefined;
  if (!id) {
    res.status(401).json({ error: 'x-user-id header required.' });
    return null;
  }
  return id;
}

/** Validate an EVM address. */
export function isEvmAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}
