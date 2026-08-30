import express from 'express';
<<<<<<< HEAD
import { register, login, getMe, updateLocation, changePassword, updateProfile } from '../controllers/authController.js';
=======
import { register, login, getMe, updateLocation, changePassword } from '../controllers/authController.js';
>>>>>>> a75bcd36f1adfd02198398784bc138e4b67c1ef1
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/update-location', protect, updateLocation);
router.put('/change-password', protect, changePassword);
<<<<<<< HEAD
router.put('/update-profile', protect, updateProfile); // This now handles both name and photo
=======
>>>>>>> a75bcd36f1adfd02198398784bc138e4b67c1ef1

export default router;