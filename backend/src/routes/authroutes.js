import express from 'express';
import { register, login, getMe, updateLocation } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/update-location', protect, updateLocation);

export default router;