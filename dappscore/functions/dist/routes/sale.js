"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// ── Schema ────────────────────────────────────────────────────────────────────
const saleSchema = zod_1.z.object({
    raised: zod_1.z.number().min(0),
    goal: zod_1.z.number().positive(),
    currency: zod_1.z.string().min(1).max(10).transform(s => s.trim().toUpperCase()),
    tokenPrice: zod_1.z.number().positive(),
    startDate: zod_1.z.number().int(),
    endDate: zod_1.z.number().int(),
    minContribution: zod_1.z.number().min(0).optional(),
    maxContribution: zod_1.z.number().positive().optional(),
    saleContract: zod_1.z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    network: zod_1.z.string().max(50).transform(s => s.trim()).optional(),
}).refine(d => d.endDate > d.startDate, {
    message: 'endDate must be after startDate',
});
// ── API key validation ────────────────────────────────────────────────────────
// SALE_API_KEYS env var: JSON object mapping projectId → apiKey
// e.g.  SALE_API_KEYS='{"42":"sk_sale_abc123"}'
function validateApiKey(projectId, authHeader) {
    if (!authHeader?.startsWith('Bearer '))
        return false;
    const provided = authHeader.slice(7).trim();
    let keys = {};
    try {
        keys = JSON.parse(process.env.SALE_API_KEYS ?? '{}');
    }
    catch {
        return false;
    }
    const expected = keys[projectId];
    if (!expected || provided.length !== expected.length)
        return false;
    // Constant-time comparison to prevent timing attacks
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) {
        mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
}
// ── GET /api/v1/projects/:id/sale ────────────────────────────────────────────
router.get('/:id/sale', async (req, res) => {
    const { id } = req.params;
    const doc = await (0, firestore_1.getFirestore)().collection('project_sales').doc(id).get();
    if (!doc.exists) {
        res.status(404).json({ error: 'No sale data found for this project.' });
        return;
    }
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
    res.json(doc.data());
});
// ── POST /api/v1/projects/:id/sale ───────────────────────────────────────────
router.post('/:id/sale', async (req, res) => {
    const { id } = req.params;
    if (!validateApiKey(id, req.headers.authorization ?? null)) {
        res.status(401).json({ error: 'Unauthorized.' });
        return;
    }
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(422).json({ error: 'Invalid fields.', details: parsed.error.flatten() });
        return;
    }
    const saleData = { ...parsed.data, updatedAt: Math.floor(Date.now() / 1000) };
    await (0, firestore_1.getFirestore)().collection('project_sales').doc(id).set(saleData);
    res.json({ ok: true, data: saleData });
});
exports.default = router;
//# sourceMappingURL=sale.js.map