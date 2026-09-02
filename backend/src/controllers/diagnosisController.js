import { createCase, uploadPhoto, getCaseDetail, listCasesForFarm, requestRecapture } from '../services/diagnosisService.js';

export async function createCaseEndpoint(req, res) {
  try {
    const { farmId, triggeredBy, triggeringRiskScoreId, gpsPoint } = req.body;
    if (!farmId || !triggeredBy) {
      return res.status(400).json({ success: false, message: 'farmId and triggeredBy are required' });
    }
    const diagnosisCase = await createCase({
      farmId, userId: req.user._id, triggeredBy,
      triggeringRiskScoreId, gpsPoint,
    });
    res.status(201).json({ success: true, data: diagnosisCase });
  } catch (err) {
    console.error('Error creating case:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function uploadPhotoEndpoint(req, res) {
  try {
    const { caseId } = req.params;
    const fileInfo = {
      storageKey: req.file ? 'cases/' + caseId + '/' + req.file.filename : 'mock/photo.jpg',
      filename: req.file?.originalname || 'photo.jpg',
      mimeType: req.file?.mimetype || 'image/jpeg',
      fileSize: req.file?.size || 0,
    };
    const onDeviceResult = req.body.onDeviceResult ? JSON.parse(req.body.onDeviceResult) : null;
    const { diagnosisCase, photo } = await uploadPhoto(caseId, fileInfo, onDeviceResult);
    res.status(201).json({ success: true, data: { diagnosisCase, photo } });
  } catch (err) {
    console.error('Error uploading photo:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCaseDetailEndpoint(req, res) {
  try {
    const detail = await getCaseDetail(req.params.caseId);
    if (!detail) return res.status(404).json({ success: false, message: 'Case not found' });
    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listCasesEndpoint(req, res) {
  try {
    const { farmId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor || null;
    const cases = await listCasesForFarm(farmId, limit, cursor);
    res.json({
      success: true, count: cases.length, data: cases,
      nextCursor: cases.length === limit ? cases[cases.length - 1]?._id : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function recaptureEndpoint(req, res) {
  try {
    const dc = await requestRecapture(req.params.caseId);
    res.json({ success: true, data: dc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}
