import RiskScore from '../models/RiskScore.js';
import Field from '../models/Field.js';
import { evaluateWeatherForFarm } from './weatherService.js';
import { fetchNdviForFarm, computeNdviComponent } from './ndviService.js';
import { computeThermalReading, computeThermalComponent } from './thermalService.js';

// ─── Per-crop configurable weights (spec §7.4) ─────────────────────────────
const CROP_WEIGHTS = {
  default:  { weather: 0.35, ndvi: 0.30, thermal: 0.15, pestHistory: 0.20 },
  rice:     { weather: 0.30, ndvi: 0.35, thermal: 0.15, pestHistory: 0.20 },
  cotton:   { weather: 0.40, ndvi: 0.25, thermal: 0.15, pestHistory: 0.20 },
  soybean:  { weather: 0.35, ndvi: 0.30, thermal: 0.15, pestHistory: 0.20 },
  wheat:    { weather: 0.40, ndvi: 0.25, thermal: 0.15, pestHistory: 0.20 },
  potato:   { weather: 0.35, ndvi: 0.30, thermal: 0.20, pestHistory: 0.15 },
};

// ─── Alert threshold per crop (default 0.6, adjustable via false-alarm recalibration) ──
const BASE_ALERT_THRESHOLDS = {
  default: 0.6,
  cotton: 0.6,
  soybean: 0.55,
  wheat: 0.6,
  rice: 0.55,
  potato: 0.6,
  maize: 0.6,
  sugarcane: 0.6,
  grapes: 0.6,
  tur: 0.6,
};

// In-memory threshold adjustments (reset on server restart — persisted in DB would be better)
const thresholdAdjustments = {};

// ─── Weight & Threshold Helpers ─────────────────────────────────────────────

function getCropWeights(cropType) {
  const key = cropType?.toLowerCase();
  return CROP_WEIGHTS[key] || CROP_WEIGHTS.default;
}

function getAlertThreshold(cropType) {
  const key = cropType?.toLowerCase();
  const base = BASE_ALERT_THRESHOLDS[key] || BASE_ALERT_THRESHOLDS.default;
  const adjustment = thresholdAdjustments[key] || 0;
  return Math.min(base + adjustment, base + 0.15); // cap at +0.15 cumulative
}

/**
 * Recalibrate threshold after a false alarm (spec §7.4).
 * Called when a case resolves outcome='false_alarm'.
 * Nudges threshold up by +0.01, capped at +0.15 cumulative.
 */
export function recalibrateThreshold(cropType, diseaseHypothesis) {
  const key = `${cropType?.toLowerCase()}_${diseaseHypothesis || 'general'}`;
  const current = thresholdAdjustments[key] || 0;
  if (current >= 0.15) return; // cap reached
  thresholdAdjustments[key] = Math.min(current + 0.01, 0.15);
  console.log(`🔄 Threshold recalibrated for ${key}: ${BASE_ALERT_THRESHOLDS.default} + ${thresholdAdjustments[key]}`);
}

// ─── Pest History Component ─────────────────────────────────────────────────

/**
 * Compute pest history component.
 * Fraction of confirmed (non-false-alarm) cases for same crop in trailing 90 days,
 * normalized against a district baseline rate.
 *
 * Currently returns 0 — will be wired when DiagnosisCase model is added.
 */
async function computePestHistoryComponent(farmId, cropType) {
  try {
    // Placeholder: will query DiagnosisCase when model exists
    return 0;
  } catch {
    return 0;
  }
}

// ─── Core Risk Computation ──────────────────────────────────────────────────

/**
 * Compute composite risk score for a farm.
 * Orchestrates all 4 services: weather, NDVI, thermal, pest history.
 *
 * Steps:
 * 1. Fetch fresh NDVI reading (simulated)
 * 2. Fetch fresh thermal reading from weather data
 * 3. Evaluate weather rules for disease hypothesis
 * 4. Compute all 4 component scores
 * 5. Weighted fusion → composite score
 * 6. Compare against crop-specific alert threshold
 * 7. Save RiskScore document
 */
export async function computeRiskScore(farmId) {
  const farm = await Field.findById(farmId);
  if (!farm) throw new Error('Farm not found');

  // ── 1. Fetch fresh sensor data ──
  const [ndviReading, weatherEval] = await Promise.all([
    fetchNdviForFarm(farm),
    evaluateWeatherForFarm(farmId),
  ]);

  // ── 2. Compute thermal reading from weather ──
  let thermalReading = null;
  if (weatherEval.weatherReading) {
    thermalReading = await computeThermalReading(farm, weatherEval.weatherReading);
  }

  // ── 3. Compute all 4 component scores ──
  const weatherComponent = weatherEval.score;
  const ndviComponent = await computeNdviComponent(farmId);
  const thermalComponent = await computeThermalComponent(farmId);
  const pestHistoryComponent = await computePestHistoryComponent(farmId, farm.cropType);

  // ── 4. Weighted fusion ──
  const weights = getCropWeights(farm.cropType);
  const compositeScore =
    weights.weather * weatherComponent +
    weights.ndvi * ndviComponent +
    weights.thermal * thermalComponent +
    weights.pestHistory * pestHistoryComponent;

  // ── 5. Alert threshold ──
  const threshold = getAlertThreshold(farm.cropType);
  const triggeredAlert = compositeScore >= threshold;

  // ── 6. Save ──
  const riskScore = await RiskScore.create({
    farmId,
    computedAt: new Date(),
    weatherComponent: Math.round(weatherComponent * 1000) / 1000,
    ndviComponent: Math.round(ndviComponent * 1000) / 1000,
    thermalComponent: Math.round(thermalComponent * 1000) / 1000,
    pestHistoryComponent: Math.round(pestHistoryComponent * 1000) / 1000,
    compositeScore: Math.round(compositeScore * 1000) / 1000,
    triggeredAlert,
    diseaseHypothesis: weatherEval.diseaseHypothesis,
    matchedWeatherRules: weatherEval.matchedRules || [],
    thresholdUsed: threshold,
    inputsSnapshot: {
      weatherReadingId: weatherEval.weatherReading?._id,
      ndviReadingId: ndviReading?._id,
      thermalReadingId: thermalReading?._id,
      weights,
      cropType: farm.cropType,
    },
  });

  // Update farm timestamps
  await Field.findByIdAndUpdate(farmId, { lastRiskScoreAt: new Date() });

  return riskScore;
}

/**
 * Batch compute risk scores for all active farms.
 * Used by cron jobs — processes farms oldest-first, bounded batch.
 */
export async function computeRiskScoresForAllActiveFarms(batchSize = 50) {
  const farms = await Field.find({ status: 'active' })
    .sort({ lastRiskScoreAt: 1 })
    .limit(batchSize)
    .lean();

  const results = [];
  for (const farm of farms) {
    try {
      const score = await computeRiskScore(farm._id);
      results.push({ farmId: farm._id, success: true, compositeScore: score.compositeScore });
    } catch (err) {
      results.push({ farmId: farm._id, success: false, error: err.message });
    }
  }

  return results;
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

export async function getRiskHistory(farmId, limit = 20, cursor = null) {
  const query = { farmId };
  if (cursor) {
    query.computedAt = { $lt: new Date(cursor) };
  }
  return RiskScore.find(query)
    .sort({ computedAt: -1 })
    .limit(limit)
    .lean();
}

export async function getLatestRiskScore(farmId) {
  return RiskScore.findOne({ farmId })
    .sort({ computedAt: -1 })
    .lean();
}
