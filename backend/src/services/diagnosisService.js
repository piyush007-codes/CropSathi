import DiagnosisCase from '../models/DiagnosisCase.js';
import CasePhoto from '../models/CasePhoto.js';
import Field from '../models/Field.js';
import { generateAndSaveAdvisory } from './advisoryService.js';

const CONFIDENCE_CONFIRM_THRESHOLD = 0.85;
const EXPERT_REVIEW_THRESHOLD = 0.70;
const AMBIGUOUS_LOW = 0.40;

const MOCK_DISEASE_CONFIDENCE = {
  rice_blast: { confidence: 0.91, severity: 'high' },
  cotton_bollworm: { confidence: 0.93, severity: 'high' },
  soybean_rust: { confidence: 0.89, severity: 'high' },
  wheat_rust: { confidence: 0.85, severity: 'medium' },
  maize_fall_armyworm: { confidence: 0.92, severity: 'high' },
  potato_late_blight: { confidence: 0.94, severity: 'high' },
};

const CROP_DISEASES = {
  rice: ['rice_blast'], wheat: ['wheat_rust'], cotton: ['cotton_bollworm'],
  soybean: ['soybean_rust'], maize: ['maize_fall_armyworm'],
  potato: ['potato_late_blight'], grapes: ['grapes_downy_mildew'],
  tur: ['tur_wilt'], sugarcane: ['sugarcane_red_rot'],
};

function getMockDiseaseCode(cropType) {
  const diseases = CROP_DISEASES[cropType] || ['rice_blast'];
  return diseases[Math.floor(Math.random() * diseases.length)];
}

export async function createCase({ farmId, userId, triggeredBy, triggeringRiskScoreId = null, gpsPoint = null }) {
  const farm = await Field.findById(farmId);
  if (!farm) throw new Error('Farm not found');
  const status = triggeredBy === 'farmer_initiated' ? 'pending_server_confirmation' : 'awaiting_photo';
  return DiagnosisCase.create({
    farmId, userId, triggeredBy, triggeringRiskScoreId, status,
    gpsPoint: gpsPoint || { lat: farm.centerLat, lng: farm.centerLng },
    capturedAt: new Date(),
  });
}

export async function uploadPhoto(caseId, fileInfo, onDeviceResult = null) {
  const diagnosisCase = await DiagnosisCase.findById(caseId);
  if (!diagnosisCase) throw new Error('Case not found');
  const photo = await CasePhoto.create({
    caseId, storageKey: fileInfo.storageKey, filename: fileInfo.filename || '',
    mimeType: fileInfo.mimeType || 'image/jpeg', fileSize: fileInfo.fileSize || 0,
    isRecapture: diagnosisCase.status === 'ambiguous_recapture_requested',
  });
  if (onDeviceResult) diagnosisCase.onDeviceResult = onDeviceResult;
  diagnosisCase.status = 'pending_server_confirmation';
  await diagnosisCase.save();
  const confirmedCase = await confirmDiagnosis(caseId);
  return { diagnosisCase: confirmedCase, photo };
}

export async function confirmDiagnosis(caseId) {
  const diagnosisCase = await DiagnosisCase.findById(caseId);
  if (!diagnosisCase) throw new Error('Case not found');
  const farm = await Field.findById(diagnosisCase.farmId);
  const cropType = farm?.cropType?.toLowerCase() || 'other';
  const diseaseCode = getMockDiseaseCode(cropType);
  const mockResult = MOCK_DISEASE_CONFIDENCE[diseaseCode] || { confidence: 0.5, severity: 'medium' };
  const confidence = Math.min(1, Math.max(0, mockResult.confidence + (Math.random() - 0.5) * 0.1));
  const severity = confidence >= 0.85 ? mockResult.severity : confidence >= 0.6 ? 'medium' : 'low';
  diagnosisCase.serverResult = { diseaseCode, confidence: Math.round(confidence * 1000) / 1000, modelVersion: 'mock-ensemble-1.0', severity };
  if (confidence >= CONFIDENCE_CONFIRM_THRESHOLD) {
    diagnosisCase.status = 'confirmed';
    diagnosisCase.finalDiseaseCode = diseaseCode;
    diagnosisCase.finalSeverity = severity;
    diagnosisCase.confidence = diagnosisCase.serverResult.confidence;
    if (confidence < EXPERT_REVIEW_THRESHOLD || severity === 'high' || severity === 'critical') {
      diagnosisCase.requiresExpertReview = true;
    }
    await generateAndSaveAdvisory(caseId, diseaseCode, severity, farm?.cropStage || 'vegetative');
  } else if (confidence < AMBIGUOUS_LOW) {
    diagnosisCase.status = diagnosisCase.triggeredBy === 'risk_alert' ? 'false_alarm' : 'ambiguous_recapture_requested';
    if (diagnosisCase.status === 'false_alarm') diagnosisCase.outcome = 'false_alarm';
  } else {
    diagnosisCase.status = 'ambiguous_recapture_requested';
  }
  await diagnosisCase.save();
  return diagnosisCase;
}

export async function requestRecapture(caseId) {
  const dc = await DiagnosisCase.findById(caseId);
  if (!dc) throw new Error('Case not found');
  if (dc.status !== 'ambiguous_recapture_requested') throw new Error('Case not in recapture status');
  return dc;
}

export async function getCaseDetail(caseId) {
  const dc = await DiagnosisCase.findById(caseId).populate('farmId', 'name cropType cropStage areaInHectares').populate('triggeringRiskScoreId', 'compositeScore healthLevel diseaseHypothesis').lean();
  if (!dc) return null;
  const photos = await CasePhoto.find({ caseId }).sort({ uploadedAt: -1 }).lean();
  let advisory = null;
  try { const A = (await import('../models/Advisory.js')).default; advisory = await A.findOne({ caseId }).sort({ version: -1 }).lean(); } catch {}
  return { ...dc, photos, advisory };
}

export async function listCasesForFarm(farmId, limit = 20, cursor = null) {
  const query = { farmId };
  if (cursor) query._id = { $lt: cursor };
  return DiagnosisCase.find(query).sort({ createdAt: -1 }).limit(limit).lean();
}
