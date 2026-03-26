import { Router } from 'express';
import { listBySite, getOne, create, update, remove, updateSection, updateSections } from '../controllers/pageController.js';
import { requireAuth, requireSiteAccess } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Nested under /api/pages
router.get('/site/:siteId', requireSiteAccess, listBySite);
router.post('/site/:siteId', requireSiteAccess, create);
router.get('/:id', getOne);
router.put('/:id', update);
router.delete('/:id', remove);
router.patch('/:id/sections', updateSections);
router.patch('/:id/sections/:sectionIdx', updateSection);

export default router;
