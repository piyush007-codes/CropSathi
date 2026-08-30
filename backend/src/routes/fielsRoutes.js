const express = require('express');
const router = express.Router();
const { getFields, createField, deleteField } = require('../controllers/fieldController');
const authMiddleware = require('../middleware/auth'); // Adjust path if auth.js is in src/middleware

// All field routes require authentication
router.use(authMiddleware);

router.route('/')
  .get(getFields)
  .post(createField);

router.route('/:id')
  .delete(deleteField);

module.exports = router;