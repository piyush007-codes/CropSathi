import mongoose from 'mongoose';

const thermalReadingSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field',
    required: true,
  },
  observedAt: {
    type: Date,
    required: true,
  },
  estimatedCanopyTempC: {
    type: Number,
    required: true,
  },
  baselineTempC: {
    type: Number,
    default: null,
  },
  anomalyC: {
    type: Number,
    default: 0,
  },
  resolution: {
    type: String,
    enum: ['district', 'farm_simulated'],
    default: 'farm_simulated',
  },
}, { timestamps: true });

thermalReadingSchema.index({ farmId: 1, observedAt: -1 });

const ThermalReading = mongoose.model('ThermalReading', thermalReadingSchema);
export default ThermalReading;
