const db = require('../../../models');
const logger = require('../../../utils/logger');
const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../utils/constants');

const DEFAULT_PRESET_TEMPS = {
  frost: 7,
  away: 16,
  eco: 18,
  night: 17,
  comfort: 20,
};

/**
 * @description Find the matching preset for the current time in a list of slots.
 * @param {Array} slots - Slots for the current day.
 * @param {number} currentMinutes - Current time in minutes since midnight.
 * @returns {string|null} Matched preset or null.
 * @example
 * findMatchingPreset(slots, 480);
 */
function findMatchingPreset(slots, currentMinutes) {
  const matched = slots.find((slot) => {
    const [startH, startM] = slot.start_time.split(':').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const slotStart = startH * 60 + startM;
    const slotEnd = endH * 60 + endM;
    return currentMinutes >= slotStart && currentMinutes < slotEnd;
  });
  return matched ? matched.preset : null;
}

/**
 * @description Get setpoint temperature for a preset from config.
 * @param {string} preset - Preset name.
 * @param {object} config - Thermostat config object.
 * @returns {number} Setpoint temperature.
 * @example
 * getSetpointForPreset('comfort', config);
 */
function getSetpointForPreset(preset, config) {
  if (preset === 'off') {
    return null;
  }
  const key = `preset_${preset}`;
  if (config && config[key] !== undefined && config[key] !== null) {
    return Number(config[key]);
  }
  return DEFAULT_PRESET_TEMPS[preset] || 20;
}

/**
 * @description Compute whether the switch should be active based on current temp and setpoint.
 * @param {number} currentTemp - Current measured temperature.
 * @param {number} setpoint - Target setpoint.
 * @param {string} mode - 'heating' or 'cooling'.
 * @param {object} config - Thermostat config with hysteresis values.
 * @returns {boolean} True if switch should be ON.
 * @example
 * computeSwitchActive(18, 20, 'heating', config);
 */
function computeSwitchActive(currentTemp, setpoint, mode, config) {
  if (currentTemp === null || currentTemp === undefined) {
    return false;
  }
  const hystStart = Number((config && config.hysteresis_start)) || 0.5;
  const hystStop = Number((config && config.hysteresis_stop)) || 0.5;
  const isActive = mode === 'heating'
    ? currentTemp < setpoint - hystStart
    : currentTemp > setpoint + hystStart;
  const isStopped = mode === 'heating'
    ? currentTemp > setpoint + hystStop
    : currentTemp < setpoint - hystStop;
  return isActive && !isStopped;
}

/**
 * @description Apply active schedules to all thermostats. Called every minute by cron.
 * Reads THERMOSTAT_ACTIVE_SCHEDULE_<FEATURE_KEY> variable for each thermostat device,
 * finds the matching slot for current day/time, updates the preset variable,
 * and directly actuates the switch device.
 * @returns {Promise<void>}
 * @example
 * await thermostatHandler.applySchedules();
 */
async function applySchedules() {
  try {
    const thermostatDevices = await this.gladys.device.get({ service: 'thermostat' });
    if (!thermostatDevices || thermostatDevices.length === 0) {
      return;
    }

    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday=0 ... Sunday=6
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    await Promise.all(
      thermostatDevices.map(async (device) => {
        const thermostatFeature = device.features && device.features[0];
        if (!thermostatFeature) {
          return;
        }

        const featureKey = thermostatFeature.selector.toUpperCase().replace(/-/g, '_');

        let scheduleSelector = null;
        try {
          scheduleSelector = await this.gladys.variable.getValue(
            `THERMOSTAT_ACTIVE_SCHEDULE_${featureKey}`,
          );
        } catch (e) {
          return;
        }

        if (!scheduleSelector) {
          return;
        }

        const schedule = await db.ThermostatSchedule.findOne({
          where: { selector: scheduleSelector },
          include: [{ model: db.ThermostatScheduleSlot, as: 'slots' }],
        });

        if (!schedule) {
          return;
        }

        const slotsForToday = schedule.slots.filter((s) => s.day_of_week === dayOfWeek);
        const matchedPreset = findMatchingPreset(slotsForToday, currentMinutes);

        if (!matchedPreset) {
          return;
        }

        const presetVarKey = `THERMOSTAT_${featureKey}_PRESET`;
        const manualVarKey = `THERMOSTAT_${featureKey}_MANUAL_MODE`;
        const configVarKey = `THERMOSTAT_CONFIG_${featureKey}`;

        try {
          const [currentPreset, manualVal, configRaw] = await Promise.all([
            this.gladys.variable.getValue(presetVarKey).catch(() => null),
            this.gladys.variable.getValue(manualVarKey).catch(() => null),
            this.gladys.variable.getValue(configVarKey).catch(() => null),
          ]);

          if (manualVal === 'true') {
            return;
          }

          // Parse config once
          let config = null;
          try {
            config = configRaw ? JSON.parse(configRaw) : null;
          } catch (e) {
            logger.warn(`Thermostat schedule: Failed to parse config for ${thermostatFeature.selector}`);
          }

          // Apply preset variable if changed
          if (currentPreset !== matchedPreset) {
            await this.gladys.variable.setValue(presetVarKey, matchedPreset);
            logger.info(
              `Thermostat schedule: preset "${matchedPreset}" applied to ${thermostatFeature.selector}`,
            );

            // Update the thermostat feature setpoint so the widget reflects the new temperature
            const newSetpoint = getSetpointForPreset(matchedPreset, config);
            if (newSetpoint !== null && newSetpoint !== undefined) {
              try {
                await this.gladys.device.saveState(thermostatFeature, newSetpoint);
                logger.info(
                  `Thermostat schedule: setpoint ${newSetpoint} applied to ${thermostatFeature.selector}`,
                );
              } catch (e) {
                logger.warn(`Thermostat schedule: Failed to update setpoint: ${e.message}`);
              }
            }

            this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
              type: WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.PRESET_UPDATED,
              payload: { key: presetVarKey, value: matchedPreset },
            });
          }

          if (!config || !config.switch_feature) {
            return;
          }

          if (matchedPreset === 'off') {
            // Preset off = switch off
            try {
              const allDevices = await this.gladys.device.get({ service: 'thermostat' });
              const switchDevice = allDevices && allDevices.find(
                (d) => d.features && d.features.some((f) => f.selector === config.switch_feature),
              );
              const switchFeature = switchDevice && switchDevice.features.find(
                (f) => f.selector === config.switch_feature,
              );
              if (switchDevice && switchFeature) {
                await this.gladys.device.setValue(switchDevice, switchFeature, 0);
                logger.info(`Thermostat schedule: switch OFF (preset=off) for ${thermostatFeature.selector}`);
              }
            } catch (e) {
              logger.warn(`Thermostat schedule: Failed to turn off switch: ${e.message}`);
            }
            return;
          }

          // Get current temperature from sensor
          const temperatureFeatureSelector = config.temperature_feature;
          if (!temperatureFeatureSelector) {
            return;
          }

          let currentTemp = null;
          try {
            const tempDevices = await this.gladys.device.get({
              device_feature_selectors: temperatureFeatureSelector,
            });
            if (tempDevices && tempDevices.length > 0) {
              const tempFeature = tempDevices[0].features.find(
                (f) => f.selector === temperatureFeatureSelector,
              );
              if (tempFeature) {
                currentTemp = tempFeature.last_value;
              }
            }
          } catch (e) {
            logger.warn(`Thermostat schedule: Failed to read temperature: ${e.message}`);
            return;
          }

          if (currentTemp === null || currentTemp === undefined) {
            return;
          }

          const setpoint = getSetpointForPreset(matchedPreset, config);
          const mode = config.default_mode || 'heating';
          const shouldBeActive = computeSwitchActive(currentTemp, setpoint, mode, config);

          // Find switch device and actuate
          try {
            const switchDevices = await this.gladys.device.get({
              device_feature_selectors: config.switch_feature,
            });
            const switchDevice = switchDevices && switchDevices[0];
            const switchFeature = switchDevice && switchDevice.features.find(
              (f) => f.selector === config.switch_feature,
            );
            if (switchDevice && switchFeature) {
              const currentSwitchValue = switchFeature.last_value;
              const desiredValue = shouldBeActive ? 1 : 0;
              if (currentSwitchValue !== desiredValue) {
                await this.gladys.device.setValue(switchDevice, switchFeature, desiredValue);
                logger.info(
                  `Thermostat schedule: switch ${shouldBeActive ? 'ON' : 'OFF'} (preset="${matchedPreset}", temp=${currentTemp}, setpoint=${setpoint}) for ${thermostatFeature.selector}`,
                );
              }
            }
          } catch (e) {
            logger.warn(`Thermostat schedule: Failed to actuate switch: ${e.message}`);
          }
        } catch (e) {
          logger.warn(`Thermostat schedule: Failed to update preset for ${thermostatFeature.selector}: ${e.message}`);
        }
      }),
    );
  } catch (e) {
    logger.warn(`Thermostat applySchedules error: ${e.message}`);
  }
}

module.exports = { applySchedules };
