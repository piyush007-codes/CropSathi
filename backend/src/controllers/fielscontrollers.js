const Field = require('../models/Field');

// @desc    Get all fields for the logged-in user
// @route   GET /api/fields
// @access  Private
exports.getFields = async (req, res) => {
  try {
    const fields = await Field.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: fields.length,
      data: fields
    });
  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching fields' });
  }
};

// @desc    Create a new field/plot
// @route   POST /api/fields
// @access  Private
exports.createField = async (req, res) => {
  try {
    const {
      fieldName,
      cropName,
      variety,
      areaAcres,
      sowingDate,
      growthStage,
      soilMoisture,
      healthScore,
      soilType,
      location
    } = req.body;

    if (!cropName || !areaAcres) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least the crop name and area in acres.'
      });
    }

    const newField = new Field({
      user: req.user.id,
      fieldName: fieldName || 'Field 1',
      cropName,
      variety: variety || 'Standard',
      areaAcres,
      sowingDate: sowingDate || Date.now(),
      growthStage: growthStage || 'Vegetative',
      soilMoisture: soilMoisture !== undefined ? soilMoisture : 45,
      healthScore: healthScore || 'Good',
      soilType: soilType || 'Black Soil',
      location: location || 'Nashik, Maharashtra'
    });

    const savedField = await newField.save();

    res.status(201).json({
      success: true,
      message: 'Field created successfully',
      data: savedField
    });
  } catch (error) {
    console.error('Error creating field:', error);
    res.status(500).json({ success: false, message: 'Server error while creating field' });
  }
};

// @desc    Delete a field
// @route   DELETE /api/fields/:id
// @access  Private
exports.deleteField = async (req, res) => {
  try {
    const field = await Field.findById(req.params.id);

    if (!field) {
      return res.status(404).json({ success: false, message: 'Field not found' });
    }

    // Verify field belongs to the requesting user
    if (field.user.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this field' });
    }

    await field.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Field deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting field:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting field' });
  }
};