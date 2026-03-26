import { Router } from 'express';
import { triggerBuild, getBuildStatus, servePreview } from '../controllers/buildController.js';
import { requireAuth, requireSiteAccess } from '../middleware/auth.js';

const router = Router();

// Preview is public (loaded in iframe without auth header)
router.get('/:siteId/preview/*', servePreview);

// Other routes require auth + site access
router.post('/:siteId', requireAuth, requireSiteAccess, triggerBuild);
router.get('/:siteId/status', requireAuth, requireSiteAccess, getBuildStatus);

export default router;
