import { Router } from 'express';
import { triggerBuild, getBuildStatus, servePreview } from '../controllers/buildController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Preview is public (loaded in iframe without auth header)
router.get('/:siteId/preview/*', servePreview);

// Other routes require auth
router.post('/:siteId', requireAuth, triggerBuild);
router.get('/:siteId/status', requireAuth, getBuildStatus);

export default router;
