import mongoose from 'mongoose';

const diagnosisCaseSchema = new mongoose.Schema({
  farmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Field',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  triggeredBy: {
    type: String,
    enum: ['risk_alert', 'farmer_initiated'],
    required: true,
  },
  triggeringRiskScoreId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RiskScore',
    default: null,
  },
  status: {
    type: String,
    enum: [
      'awaiting_photo',
      'awaiting_sync',
      'on_device_screened',
      'pending_server_confirmation',
      'confirmed',
      'false_alarm',
      'ambiguous_recapture_requested',
      'escalated',
      'resolved',
    ],
    default: 'awaiting_photo',
  },
  // On-device screening result (synced from app, not authoritative)
  onDeviceResult: {
    diseaseCode: { type: String, default: null },
    confidence: { type: Number, default: null },
    modelVersion: { type: String, default: null },
  },
  // Server-side confirmation result (authoritative)
  serverResult: {
    diseaseCode: { type: String, default: null },
    confidence: { type: Number, default: null },
    modelVersion: { type: String, default: null },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical', null], default: null },
  },
  finalDiseaseCode: { type: String, default: null },
  finalSeverity: { type: String, enum: ['low', 'medium', 'high', 'critical', null], default: null },
  confidence: { type: Number, default: null },
  outcome: {
    type: String,
    enum: ['confirmed_treated', 'false_alarm', 'escalated_unresolved', null],
    default: null,
  },
  requiresExpertReview: { type: Boolean, default: false },
  gpsPoint: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  capturedAt: { type: Date, default: Date.now },
  syncedAt: { type: Date, default: null },
}, { timestamps: true });

diagnosisCaseSchema.index({ farmId: 1, status: 1 });
diagnosisCaseSchema.index({ status: 1, requiresExpertReview: 1 });

const DiagnosisCase = mongoose.model('DiagnosisCase', diagnosisCaseSchema);
export default DiagnosisCase;
