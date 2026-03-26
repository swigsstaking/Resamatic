import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getBillingStats, generateAndSendReport } from '../services/billing.service.js';

const router = Router();

// All admin routes require authentication + admin role
router.use(requireAuth, requireAdmin);

// GET /api/admin/billing?month=3&year=2026
router.get('/billing', async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    const year = parseInt(req.query.year) || now.getFullYear();
    const stats = await getBillingStats(month, year);
    res.json(stats);
  } catch (err) { next(err); }
});

// POST /api/admin/billing-report — send email report manually
router.post('/billing-report', async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.body.month) || (now.getMonth() + 1);
    const year = parseInt(req.body.year) || now.getFullYear();
    const stats = await generateAndSendReport(month, year);
    res.json({ message: 'Rapport envoyé', stats });
  } catch (err) { next(err); }
});

export default router;
