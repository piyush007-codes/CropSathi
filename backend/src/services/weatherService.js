import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import WeatherReading from '../models/WeatherReading.js';
import Field from '../models/Field.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

// ─── Weather Rules (cached at startup) ─────────────────────────────────────
let weatherRules = null;

function loadWeatherRules() {
  if (weatherRules) return weatherRules;
  try {
    const rulesPath = join(__dirname, '../config/weatherRules.json');
    const raw = readFileSync(rulesPath, 'utf-8');
    weatherRules = JSON.parse(raw);
    console.log(`📋 Loaded weather rules v${weatherRules.version} (${Object.keys(weatherRules.rules).length} crops)`);
    return weatherRules;
  } catch (err) {
    console.error('⚠️  Failed to load weather rules:', err.message);
    weatherRules = { rules: {}, defaultThresholds: { humidityMin: 70, tempMin: 18, tempMax: 30, rainfallMin: 5, riskWeight: 0.5 } };
    return weatherRules;
  }
}

// Load rules eagerly at module import
loadWeatherRules();

// ─── Open-Meteo Client ─────────────────────────────────────────────────────

export async function fetchWeatherFromOpenMeteo(lat, lng) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lng,
    current: 'temperature_2m,relative_humidity_2m,rain,soil_temperature_6cm,wind_speed_10m',
    timezone: 'auto',
  });

  const response = await fetch(`${OPEN_METEO_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }
  return response.json();
}

// ─── Weather Polling ───────────────────────────────────────────────────────

export async function pollWeatherForFarm(farm) {
  const lat = farm.centerLat || (farm.polygon?.[0]?.lat);
  const lng = farm.centerLng || (farm.polygon?.[0]?.lng);

  if (!lat || !lng) {
    throw new Error(`Farm ${farm._id} has no coordinates`);
  }

  const data = await fetchWeatherFromOpenMeteo(lat, lng);
  const current = data.current;

  const reading = await WeatherReading.create({
    farmId: farm._id,
    source: 'open_meteo',
    observedAt: new Date(current.time || Date.now()),
    temperatureC: current.temperature_2m,
    humidityPct: current.relative_humidity_2m,
    rainfallMm24h: current.rain ?? 0,
    windSpeedMs: current.wind_speed_10m,
    soilTempC: current.soil_temperature_6cm,
    rawPayload: data,
  });

  await Field.findByIdAndUpdate(farm._id, { lastWeatherPollAt: new Date() });

  return reading;
}

export async function getRecentWeather(farmId, limit = 10) {
  return WeatherReading.find({ farmId })
    .sort({ observedAt: -1 })
    .limit(limit)
    .lean();
}

// ─── Rule-Based Weather Risk Evaluation ─────────────────────────────────────

/**
 * Evaluate weather rules for a crop type against a weather reading.
 * Returns { score, matchedRules[], diseaseHypothesis }.
 *
 * Score logic: for each rule that fires (all thresholds met), accumulate
 * riskWeight. Multiple rules can fire (multiple diseases possible).
 * Final score = min(1, sum of matched rule weights / number of rules for crop).
 */
export function evaluateWeatherRules(weatherReading, cropType) {
  const rules = loadWeatherRules();
  const cropKey = cropType?.toLowerCase();
  const cropRules = rules.rules[cropKey] || [];
  const defaults = rules.defaultThresholds;

  if (!weatherReading) {
    return { score: 0.5, matchedRules: [], diseaseHypothesis: null };
  }

  const { humidityPct, temperatureC, rainfallMm24h } = weatherReading;

  // Default fallback if crop not in rules
  if (cropRules.length === 0) {
    let score = 0;
    if (humidityPct > defaults.humidityMin) score += 0.3;
    if (temperatureC >= defaults.tempMin && temperatureC <= defaults.tempMax) score += 0.3;
    if (rainfallMm24h > defaults.rainfallMin) score += 0.3;
    return {
      score: Math.min(score, 1),
      matchedRules: [],
      diseaseHypothesis: null,
    };
  }

  const matchedRules = [];

  for (const rule of cropRules) {
    const humidityMatch = humidityPct >= rule.humidityMin;
    const tempMatch = temperatureC >= rule.tempMin && temperatureC <= rule.tempMax;
    const rainfallMatch = rainfallMm24h >= rule.rainfallMin;

    if (humidityMatch && tempMatch && rainfallMatch) {
      matchedRules.push({
        diseaseCode: rule.diseaseCode,
        diseaseName: rule.diseaseName,
        riskWeight: rule.riskWeight,
        notes: rule.notes,
      });
    }
  }

  // Score = average risk weight of matched rules, or 0 if none
  let score = 0;
  let diseaseHypothesis = null;

  if (matchedRules.length > 0) {
    const totalWeight = matchedRules.reduce((sum, r) => sum + r.riskWeight, 0);
    score = totalWeight / matchedRules.length;
    // Hypothesis = highest-risk matched disease
    diseaseHypothesis = matchedRules.sort((a, b) => b.riskWeight - a.riskWeight)[0].diseaseCode;
  }

  return {
    score: Math.min(score, 1),
    matchedRules,
    diseaseHypothesis,
  };
}

/**
 * Convenience: fetch latest weather + evaluate rules for a farm.
 */
export async function evaluateWeatherForFarm(farmId) {
  const readings = await getRecentWeather(farmId, 1);
  const latest = readings[0] || null;

  const farm = await Field.findById(farmId).lean();
  const cropType = farm?.cropType || 'Other';

  const evaluation = evaluateWeatherRules(latest, cropType);

  return {
    weatherReading: latest,
    ...evaluation,
  };
}
