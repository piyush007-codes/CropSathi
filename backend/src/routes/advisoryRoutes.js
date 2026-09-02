import { Router } from 'express';
import { getCaseAdvisory, regenerateAdvisory, getDiseaseRulePreview } from '../controllers/advisoryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

// All advisory routes require authentication
router.use(protect);

// GET /api/advisory/cases/:caseId — get latest advisory for a case
router.get('/cases/:caseId', getCaseAdvisory);

// POST /api/advisory/cases/:caseId/regenerate — regenerate advisory (expert/officer)
router.post('/cases/:caseId/regenerate', regenerateAdvisory);

// GET /api/advisory/rules/:diseaseCode — preview advisory rule for a disease
router.get('/rules/:diseaseCode', getDiseaseRulePreview);

export default router;
