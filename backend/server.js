import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './src/config/db.js';
import authRoutes from './src/routes/authroutes.js';
import fieldRoutes from './src/routes/fieldRoutes.js';
import { protect } from './src/middleware/authMiddleware.js';
import User from './src/models/User.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/fields', fieldRoutes);

// Health Check
app.get('/api/test', (req, res) => {
  res.json({ message: 'CropSathi backend is fully connected!' });
});
app.get('/api/user/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        phoneNumber: user.phoneNumber,
        farmDetails: user.farmDetails,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'CropSathi API Gateway is online',
    database: 'Connected',
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 CropSathi Backend running on http://localhost:${PORT}`);
  });
};

startServer();