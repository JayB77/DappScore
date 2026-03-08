"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const app_1 = require("firebase-admin/app");
const https_1 = require("firebase-functions/v2/https");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const sale_1 = __importDefault(require("./routes/sale"));
(0, app_1.initializeApp)();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)({ origin: true })); // Firebase Hosting same-origin; CORS needed for local dev
app.use(express_1.default.json());
// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});
// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/v1/projects', sale_1.default);
// Add more route groups here as the API grows:
// app.use('/api/v1/risk',    riskRoutes);
// app.use('/api/v1/holders', holderRoutes);
// ── Catch-all 404 ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'Not found.' });
});
// Exported as a single Cloud Function — minInstances keeps it warm (no cold starts)
exports.api = (0, https_1.onRequest)({ region: 'us-central1', minInstances: 1, memory: '256MiB' }, app);
//# sourceMappingURL=index.js.map