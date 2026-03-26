import { Router } from 'express';
import { list, getOne, create, update, remove, duplicate, fetchGoogleReviews } from '../controllers/siteController.js';
import { requireAuth, requireAdmin, requireSiteAccess } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', requireAdmin, create);
router.get('/:id', requireSiteAccess, getOne);
router.put('/:id', requireSiteAccess, update);
router.delete('/:id', requireAdmin, remove);
router.post('/:id/duplicate', requireAdmin, duplicate);
router.post('/:id/fetch-reviews', requireSiteAccess, fetchGoogleReviews);

export default router;
