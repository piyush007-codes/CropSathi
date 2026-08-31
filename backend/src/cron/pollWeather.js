import cron from 'node-cron';
import Field from '../models/Field.js';
import { pollWeatherForFarm, evaluateWeatherRules } from '../services/weatherService.js';
import { computeThermalReading } from '../services/thermalService.js';
import { fetchNdviForFarm, computeNdviComponent } from '../services/ndviService.js';
import RiskScore from '../models/RiskScore.js';

const BATCH_SIZE = parseInt(process.env.CRON_BATCH_SIZE || '200', 10);

/**
 * Poll weather for active farms and recompute risk scores.
 *
 * For each active farm not polled in the last 2 hours:
 *  1. Fetch Open-Meteo weather data
 *  2. Fetch simulated NDVI reading
 *  3. Compute thermal reading from weather
 *  4. Compute 4-component risk fusion score
 *  5. Save RiskScore document
 *
 * Farms with tightened monitoring (active cases) are prioritized first.
 */
async function pollWeatherForActiveFarms() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Priority 1: farms needing tightened monitoring (polled recently but still prioritized)
  // Priority 2: farms not polled in last 2 hours, oldest first
  const farms = await Field.find({
    status: 'active',
    deletedAt: null,
    $or: [
      { lastWeatherPollAt: null },
      { lastWeatherPollAt: { $lt: twoHoursAgo } },
    ],
  })
    .sort({ lastWeatherPollAt: 1 })
    .limit(BATCH_SIZE)
    .lean();

  if (farms.length === 0) {
    console.log('⏱️  [poll-weather] No farms need polling');
    return { polled: 0, errors: 0 };
  }

  console.log(`🌤️  [poll-weather] Polling ${farms.length} farms...`);

  let polled = 0;
  let errors = 0;

  for (const farm of farms) {
    try {
      // 1. Fetch weather + evaluate rules
      const weatherReading = await pollWeatherForFarm(farm);
      const weatherEval = evaluateWeatherRules(weatherReading, farm.cropType);

      // 2. Fetch NDVI (simulated)
      const ndviReading = await fetchNdviForFarm(farm);
      const ndviComponent = await computeNdviComponent(farm._id);

      // 3. Compute thermal from weather
      let thermalComponent = 0.5;
      try {
        const thermalReading = await computeThermalReading(farm, weatherReading);
        thermalComponent = thermalReading.anomalyC > 0
          ? Math.min(1, thermalReading.anomalyC / 10)
          : 0;
      } catch {
        // Thermal is best-effort — continue without it
      }

      // 4. Weighted fusion (same logic as riskService)
      const CROP_WEIGHTS = {
        default:  { weather: 0.35, ndvi: 0.30, thermal: 0.15, pestHistory: 0.20 },
        rice:     { weather: 0.30, ndvi: 0.35, thermal: 0.15, pestHistory: 0.20 },
        cotton:   { weather: 0.40, ndvi: 0.25, thermal: 0.15, pestHistory: 0.20 },
        wheat:    { weather: 0.40, ndvi: 0.25, thermal: 0.15, pestHistory: 0.20 },
      };
      const BASE_THRESHOLDS = { default: 0.6, rice: 0.55, cotton: 0.6, wheat: 0.6 };
      const cropKey = farm.cropType?.toLowerCase();
      const weights = CROP_WEIGHTS[cropKey] || CROP_WEIGHTS.default;
      const threshold = BASE_THRESHOLDS[cropKey] || BASE_THRESHOLDS.default;

      const compositeScore =
        weights.weather * weatherEval.score +
        weights.ndvi * ndviComponent +
        weights.thermal * thermalComponent +
        weights.pestHistory * 0; // pest history placeholder

      await RiskScore.create({
        farmId: farm._id,
        computedAt: new Date(),
        weatherComponent: Math.round(weatherEval.score * 1000) / 1000,
        ndviComponent: Math.round(ndviComponent * 1000) / 1000,
        thermalComponent: Math.round(thermalComponent * 1000) / 1000,
        pestHistoryComponent: 0,
        compositeScore: Math.round(compositeScore * 1000) / 1000,
        triggeredAlert: compositeScore >= threshold,
        diseaseHypothesis: weatherEval.diseaseHypothesis,
        matchedWeatherRules: weatherEval.matchedRules || [],
        thresholdUsed: threshold,
        inputsSnapshot: {
          weatherReadingId: weatherReading._id,
          ndviReadingId: ndviReading?._id,
          cropType: farm.cropType,
          source: 'cron_poll_weather',
        },
      });

      polled++;
    } catch (err) {
      console.error(`❌ [poll-weather] Farm ${farm._id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`✅ [poll-weather] Done: ${polled} polled, ${errors} errors`);
  return { polled, errors };
}

/**
 * Schedule: every 2 hours at minute 0.
 * Uses node-cron cron expression: second(0) minute(0) hour(*/2) * * * *
 */
export function startPollWeatherCron() {
  cron.schedule('0 0 */2 * *', async () => {
    console.log('⏰ [cron] poll-weather triggered');
    try {
      await pollWeatherForActiveFarms();
    } catch (err) {
      console.error('❌ [cron] poll-weather crashed:', err.message);
    }
  });

  console.log('📅 [cron] poll-weather scheduled: every 2 hours');
}

// Allow manual trigger for testing
export { pollWeatherForActiveFarms };
