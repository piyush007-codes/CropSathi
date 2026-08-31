import mongoose from 'mongoose';

const ndviReadingSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field',
    required: true,
  },
  observedAt: {
    type: Date,
    required: true,
  },
  ndvi: {
    type: Number,
    required: true,
    min: -1,
    max: 1,
  },
  ndre: {
    type: Number,
    default: null,
    min: -1,
    max: 1,
  },
  cloudCoverPct: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  trailingAvgNdvi28d: {
    type: Number,
    default: null,
  },
  anomalyScore: {
    type: Number,
    default: 0,
  },
  pixelCountPureCrop: {
    type: Number,
    default: null,
  },
}, { timestamps: true });

ndviReadingSchema.index({ farmId: 1, observedAt: -1 });

const NdviReading = mongoose.model('NdviReading', ndviReadingSchema);
export default NdviReading;
