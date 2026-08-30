import express from 'express';
import { register, login, getMe, updateLocation, changePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/update-location', protect, updateLocation);
router.put('/change-password', protect, changePassword);

export default router;