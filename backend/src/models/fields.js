const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    fieldName: {
      type: String,
      required: true,
      trim: true,
      default: 'Field 1'
    },
    cropName: {
      type: String,
      required: true,
      trim: true
    },
    variety: {
      type: String,
      trim: true,
      default: 'Standard'
    },
    areaAcres: {
      type: Number,
      required: true,
      min: 0.1
    },
    sowingDate: {
      type: Date,
      default: Date.now
    },
    growthStage: {
      type: String,
      enum: ['Sowing', 'Vegetative', 'Flowering', 'Maturity', 'Harvesting'],
      default: 'Vegetative'
    },
    soilMoisture: {
      type: Number,
      default: 45
    },
    healthScore: {
      type: String,
      enum: ['Excellent', 'Good', 'Moderate', 'Critical'],
      default: 'Good'
    },
    soilType: {
      type: String,
      default: 'Black Soil'
    },
    location: {
      type: String,
      default: 'Nashik, Maharashtra'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Field', fieldSchema);