import { Router } from 'express';
import { publish, unpublish, getDeployStatus } from '../controllers/deployController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/:siteId/publish', publish);
router.post('/:siteId/unpublish', unpublish);
router.get('/:siteId/status', getDeployStatus);

export default router;
