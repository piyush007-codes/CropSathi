import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import multer from 'multer';
import {
  createCaseEndpoint, uploadPhotoEndpoint, getCaseDetailEndpoint,
  listCasesEndpoint, recaptureEndpoint,
} from '../controllers/diagnosisController.js';

const router = Router();
router.use(protect);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/cases', createCaseEndpoint);
router.get('/cases/:caseId', getCaseDetailEndpoint);
router.post('/cases/:caseId/photos', upload.single('photo'), uploadPhotoEndpoint);
router.post('/cases/:caseId/recapture', recaptureEndpoint);
router.get('/farms/:farmId/cases', listCasesEndpoint);

export default router;
