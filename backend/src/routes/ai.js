import { Router } from 'express';
import { generatePage, generateContact, generateSeo, optimizeSeo, rewrite, generateAlt } from '../controllers/aiController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post('/generate-page', generatePage);
router.post('/generate-contact', generateContact);
router.post('/generate-seo', generateSeo);
router.post('/optimize-seo', optimizeSeo);
router.post('/rewrite', rewrite);
router.post('/generate-alt', generateAlt);

export default router;
