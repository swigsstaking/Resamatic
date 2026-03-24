import { Router } from 'express';
import { list, getOne, create, update, remove, duplicate, fetchGoogleReviews } from '../controllers/siteController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', remove);
router.post('/:id/duplicate', duplicate);
router.post('/:id/fetch-reviews', fetchGoogleReviews);

export default router;
