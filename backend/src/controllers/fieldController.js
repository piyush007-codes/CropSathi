import Field from '../models/Field.js';

// @desc    Create a new field
// @route   POST /api/fields
// @access  Private
export const createField = async (req, res) => {
  try {
    const { name, cropType, sowingDate, polygon, areaInHectares, areaInAcres } = req.body;

    if (!polygon || polygon.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Polygon must have at least 3 points',
      });
    }

    const field = await Field.create({
      userId: req.user.id,
      name,
      cropType,
      sowingDate,
      polygon,
      areaInHectares,
      areaInAcres,
    });

    res.status(201).json({
      success: true,
      data: field,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get all fields for current user
// @route   GET /api/fields
// @access  Private
export const getFields = async (req, res) => {
  try {
    const fields = await Field.find({ userId: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: fields.length,
      data: fields,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Get single field
// @route   GET /api/fields/:id
// @access  Private
export const getField = async (req, res) => {
  try {
    const field = await Field.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found',
      });
    }

    res.status(200).json({
      success: true,
      data: field,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Update field
// @route   PUT /api/fields/:id
// @access  Private
export const updateField = async (req, res) => {
  try {
    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ['name', 'cropType', 'sowingDate', 'polygon', 'areaInHectares', 'areaInAcres'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const field = await Field.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found',
      });
    }

    res.status(200).json({
      success: true,
      data: field,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete field
// @route   DELETE /api/fields/:id
// @access  Private
export const deleteField = async (req, res) => {
  try {
    const field = await Field.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Field not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Field deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
