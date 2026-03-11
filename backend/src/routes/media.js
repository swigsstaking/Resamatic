import { Router } from 'express';
import multer from 'multer';
import { upload, listBySite, getOne, update, remove } from '../controllers/mediaController.js';
import { requireAuth } from '../middleware/auth.js';

const storage = multer.memoryStorage();
const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

const router = Router();
router.use(requireAuth);

router.post('/site/:siteId/upload', uploadMiddleware.single('file'), upload);
router.get('/site/:siteId', listBySite);
router.get('/:id', getOne);
router.patch('/:id', update);
router.delete('/:id', remove);

export default router;
