import mongoose from 'mongoose';

const fieldSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Field name is required'],
      trim: true,
      maxlength: [100, 'Field name cannot exceed 100 characters'],
    },
    cropType: {
      type: String,
      required: [true, 'Crop type is required'],
      enum: ['Wheat', 'Rice', 'Maize', 'Cotton', 'Sugarcane', 'Potato', 'Grapes', 'Other'],
    },
    sowingDate: {
      type: Date,
      required: [true, 'Sowing date is required'],
    },
    polygon: {
      type: [{ lat: Number, lng: Number }],
      validate: {
        validator: function (v) {
          return v && v.length >= 3;
        },
        message: 'Polygon must have at least 3 points',
      },
    },
    areaInHectares: {
      type: Number,
      default: 0,
    },
    areaInAcres: {
      type: Number,
      default: 0,
    },
    centerLat: {
      type: Number,
      default: null,
    },
    centerLng: {
      type: Number,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'archived'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

// Calculate center point before saving
fieldSchema.pre('save', function (next) {
  if (this.polygon && this.polygon.length > 0) {
    const sumLat = this.polygon.reduce((sum, p) => sum + p.lat, 0);
    const sumLng = this.polygon.reduce((sum, p) => sum + p.lng, 0);
    this.centerLat = sumLat / this.polygon.length;
    this.centerLng = sumLng / this.polygon.length;
  }
  next();
});

const Field = mongoose.model('Field', fieldSchema);
export default Field;
