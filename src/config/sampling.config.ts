/**
 * Sampling Configuration
 *
 * Defines intervals for sensor sampling, health checks, and orchestration logging.
 * All intervals can be configured via environment variables for different deployment scenarios.
 *
 * Testing (default):
 * - Water sensor: 3 seconds (rapid testing feedback)
 * - Filter health: 5 seconds (quick health degradation visibility)
 * - Orchestration: 30 seconds (frequent status reporting)
 *
 * Production (examples):
 * - Fast installation (new sensors): 30-60s, 60-120s, 300s
 * - Slow installation (older sensors): 180-300s, 300-600s, 600s+
 * - Very slow installation (remote sensors): 1800s+, 3600s+, 3600s+
 */

export const SAMPLING_CONFIG = {
  /**
   * Water Quality Sensor sampling interval (milliseconds)
   * 
   * TEST RANGE: 3000 (3 seconds)
   * PROD RANGE: 30000 - 180000 (30 seconds to 3 minutes)
   * 
   * Set via environment variable: WATER_SENSOR_INTERVAL
   * Example: WATER_SENSOR_INTERVAL=60000 npm start
   */
  WATER_SENSOR_INTERVAL: parseInt(process.env.WATER_SENSOR_INTERVAL || "3000", 10),

  /**
   * Filter Health check and degradation interval (milliseconds)
   * 
   * TEST RANGE: 5000 (5 seconds)
   * PROD RANGE: 60000 - 300000 (1 minute to 5 minutes)
   * 
   * Set via environment variable: FILTER_HEALTH_INTERVAL
   * Example: FILTER_HEALTH_INTERVAL=120000 npm start
   */
  FILTER_HEALTH_INTERVAL: parseInt(process.env.FILTER_HEALTH_INTERVAL || "5000", 10),

  /**
   * Orchestration status logging interval (milliseconds)
   * 
   * TEST RANGE: 30000 (30 seconds)
   * PROD RANGE: 300000 - 3600000 (5 minutes to 1 hour)
   * 
   * Set via environment variable: ORCHESTRATION_CHECK_INTERVAL
   * Example: ORCHESTRATION_CHECK_INTERVAL=600000 npm start
   */
  ORCHESTRATION_CHECK_INTERVAL: parseInt(process.env.ORCHESTRATION_CHECK_INTERVAL || "30000", 10),
};

// Log configuration on startup (helpful for debugging)
export function logConfiguration(): void {
  console.log("\n📊 Sampling Configuration:");
  console.log(`   Water Sensor:      ${SAMPLING_CONFIG.WATER_SENSOR_INTERVAL}ms`);
  console.log(`   Filter Health:     ${SAMPLING_CONFIG.FILTER_HEALTH_INTERVAL}ms`);
  console.log(`   Orchestration:     ${SAMPLING_CONFIG.ORCHESTRATION_CHECK_INTERVAL}ms\n`);
}
