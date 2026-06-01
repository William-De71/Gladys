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
 * @description Parse end time string, treating 00:00 as end of day (1440 minutes).
 * @param {string} timeStr - Time string HH:MM.
 * @returns {number} Minutes since midnight, 1440 if 00:00.
 * @example
 * parseEnd('00:00'); // 1440
 */
function parseEnd(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const v = h * 60 + m;
  return v === 0 ? 1440 : v;
}

/**
 * @description Find the matching preset for the current time in a list of slots.
 * Handles overnight slots (end_time < start_time, e.g. 22:00 → 07:00).
 * @param {Array} todaySlots - Slots for the current day.
 * @param {Array} yesterdaySlots - Slots for the previous day (for overnight detection).
 * @param {number} currentMinutes - Current time in minutes since midnight.
 * @returns {string|null} Matched preset or null.
 * @example
 * findMatchingPreset(todaySlots, yesterdaySlots, 480);
 */
function findMatchingPreset(todaySlots, yesterdaySlots, currentMinutes) {
  // Check today's normal slots (start < end, same day)
  const matchedToday = todaySlots.find((slot) => {
    const [startH, startM] = slot.start_time.split(':').map(Number);
    const slotStart = startH * 60 + startM;
    const slotEnd = parseEnd(slot.end_time);
    return slotEnd > slotStart && currentMinutes >= slotStart && currentMinutes < slotEnd;
  });
  if (matchedToday) {
    return matchedToday.preset;
  }

  // Check today's overnight slots (end < start, crosses midnight)
  // e.g. slot 22:00 → 07:00: covers 22:00 → 23:59 on the start day
  const matchedTodayOvernightStart = todaySlots.find((slot) => {
    const [startH, startM] = slot.start_time.split(':').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const slotStart = startH * 60 + startM;
    const slotEnd = endH * 60 + endM;
    return slotEnd < slotStart && currentMinutes >= slotStart;
  });
  if (matchedTodayOvernightStart) {
    return matchedTodayOvernightStart.preset;
  }

  // Check yesterday's overnight slots (end < start, crosses midnight)
  // e.g. slot 22:00 → 07:00 on day N covers 00:00 → 07:00 on day N+1
  const matchedOvernight = yesterdaySlots.find((slot) => {
    const [startH, startM] = slot.start_time.split(':').map(Number);
    const [endH, endM] = slot.end_time.split(':').map(Number);
    const slotStart = startH * 60 + startM;
    const slotEnd = endH * 60 + endM;
    return slotEnd < slotStart && currentMinutes < slotEnd;
  });
  if (matchedOvernight) {
    return matchedOvernight.preset;
  }

  return null;
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
 * @param {boolean} currentSwitchOn - Whether the switch is currently ON (for neutral-zone hold).
 * @returns {boolean} True if switch should be ON.
 * @example
 * computeSwitchActive(18, 20, 'heating', config, false);
 */
function computeSwitchActive(currentTemp, setpoint, mode, config, currentSwitchOn) {
  if (currentTemp === null || currentTemp === undefined) {
    return false;
  }
  const hystStart = Number((config && config.hysteresis_start)) || 0.5;
  const hystStop = Number((config && config.hysteresis_stop)) || 0.5;
  if (mode === 'heating') {
    if (currentTemp < setpoint - hystStart) {
      return true; // too cold → ON
    }
    if (currentTemp > setpoint + hystStop) {
      return false; // hot enough → OFF
    }
    return !!currentSwitchOn; // neutral zone → keep current state
  }
  // cooling
  if (currentTemp > setpoint + hystStart) {
    return true; // too hot → ON
  }
  if (currentTemp < setpoint - hystStop) {
    return false; // cold enough → OFF
  }
  return !!currentSwitchOn; // neutral zone → keep current state
}

/**
 * @description Find all thermostat box configs from all dashboards.
 * Returns a map: thermostat_feature_selector -> box config object.
 * @returns {Promise<object>} Map of feature selector to box config.
 * @example
 * const map = await getThermostatBoxConfigs();
 */
async function getThermostatBoxConfigs() {
  const dashboards = await db.Dashboard.findAll({ attributes: ['boxes'] });
  const configMap = {};
  dashboards.forEach((dashboard) => {
    let rawBoxes = dashboard.boxes;
    if (typeof rawBoxes === 'string') {
      try {
        rawBoxes = JSON.parse(rawBoxes);
      } catch (e) {
        rawBoxes = [];
      }
    }
    const boxes = Array.isArray(rawBoxes) ? rawBoxes : [];
    boxes.forEach((row) => {
      if (!Array.isArray(row)) {
        return;
      }
      row.forEach((box) => {
        if (box && box.type === 'thermostat' && box.thermostat_feature) {
          configMap[box.thermostat_feature] = box;
        }
      });
    });
  });
  return configMap;
}

/**
 * @description Apply active schedules to all thermostats. Called every minute by cron.
 * Reads schedule config from dashboards, finds the matching slot for current day/time,
 * updates the preset variable, and directly actuates the switch device.
 * @returns {Promise<void>}
 * @example
 * await thermostatHandler.applySchedules();
 */
async function applySchedules() {
  try {
    const thermostatDevices = await this.gladys.device.get({ service: 'thermostat' });
    if (!thermostatDevices || thermostatDevices.length === 0) {
      logger.debug('Thermostat schedule: no thermostat devices found');
      return;
    }
    logger.debug(`Thermostat schedule: found ${thermostatDevices.length} thermostat device(s)`);

    // Load all thermostat box configs from dashboards (source of truth for config)
    const boxConfigMap = await getThermostatBoxConfigs();

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

        // Primary config source: device params (always present since device creation)
        let boxConfig = null;
        if (device.params && device.params.length > 0) {
          const getParam = (name) => {
            const p = device.params.find((x) => x.name === name);
            return p ? p.value : null;
          };
          boxConfig = {
            temperature_feature: getParam('THERMOSTAT_TEMPERATURE_FEATURE') || null,
            humidity_feature: getParam('THERMOSTAT_HUMIDITY_FEATURE') || null,
            switch_feature: getParam('THERMOSTAT_SWITCH_FEATURE') || null,
            window_feature: getParam('THERMOSTAT_WINDOW_FEATURE') || null,
            default_mode: getParam('THERMOSTAT_MODE') || 'heating',
            control_type: getParam('THERMOSTAT_CONTROL_TYPE') || 'hysteresis',
            preset_frost: parseFloat(getParam('THERMOSTAT_PRESET_FROST')) || 7,
            preset_away: parseFloat(getParam('THERMOSTAT_PRESET_AWAY')) || 16,
            preset_eco: parseFloat(getParam('THERMOSTAT_PRESET_ECO')) || 18,
            preset_night: parseFloat(getParam('THERMOSTAT_PRESET_NIGHT')) || 17,
            preset_comfort: parseFloat(getParam('THERMOSTAT_PRESET_COMFORT')) || 21,
            hysteresis_start: parseFloat(getParam('THERMOSTAT_HYSTERESIS_START')) || 0.5,
            hysteresis_stop: parseFloat(getParam('THERMOSTAT_HYSTERESIS_STOP')) || 0.5,
          };
        }
        // Fallback: THERMOSTAT_CONFIG variable (written on save from integration page)
        if (!boxConfig || !boxConfig.temperature_feature) {
          try {
            const configRaw = await this.gladys.variable.getValue(`THERMOSTAT_CONFIG_${featureKey}`);
            if (configRaw) {
              const parsed = JSON.parse(configRaw);
              if (!boxConfig) {
                boxConfig = parsed;
              } else {
                Object.keys(parsed).forEach((k) => {
                  if (boxConfig[k] === null || boxConfig[k] === undefined) {
                    boxConfig[k] = parsed[k];
                  }
                });
              }
            }
          } catch (e) {
            // ignore
          }
        }

        // schedule_selector: from dashboard box (set in EditThermostatBox) or ACTIVE_SCHEDULE variable
        const dashboardBox = boxConfigMap[thermostatFeature.selector] || null;
        const rawScheduleSelector = (dashboardBox && dashboardBox.schedule_selector)
          || await this.gladys.variable.getValue(`THERMOSTAT_ACTIVE_SCHEDULE_${featureKey}`).catch(() => null);
        const scheduleSelector = rawScheduleSelector || null;

        if (!scheduleSelector) {
          logger.debug(`Thermostat schedule: no active schedule for ${thermostatFeature.selector}`);
          return;
        }
        logger.info(`Thermostat schedule: applying schedule "${scheduleSelector}" for ${thermostatFeature.selector}`);

        const schedule = await db.ThermostatSchedule.findOne({
          where: { selector: scheduleSelector },
          include: [{ model: db.ThermostatScheduleSlot, as: 'slots' }],
        });

        if (!schedule) {
          return;
        }

        const slotsForToday = schedule.slots.filter((s) => s.day_of_week === dayOfWeek);
        const yesterdayOfWeek = (dayOfWeek + 6) % 7;
        const slotsForYesterday = schedule.slots.filter((s) => s.day_of_week === yesterdayOfWeek);
        const matchedPreset = findMatchingPreset(slotsForToday, slotsForYesterday, currentMinutes);

        if (!matchedPreset) {
          logger.debug(`Thermostat schedule: no matching slot at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} for ${thermostatFeature.selector}`);
          return;
        }
        logger.info(`Thermostat schedule: matched preset "${matchedPreset}" at ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')} for ${thermostatFeature.selector}`);

        const presetVarKey = `THERMOSTAT_${featureKey}_PRESET`;
        const manualVarKey = `THERMOSTAT_${featureKey}_MANUAL_MODE`;
        const config = boxConfig || null;
        if (!config) {
          logger.warn(`Thermostat schedule: no config found for ${thermostatFeature.selector}`);
        }

        try {
          // Window open check: if window sensor configured and open, cut heating immediately
          if (config && config.window_feature) {
            try {
              const winDevices = await this.gladys.device.get(
                { device_feature_selectors: config.window_feature },
              );
              const winFeature = winDevices && winDevices[0]
                && winDevices[0].features.find((f) => f.selector === config.window_feature);
              if (winFeature && winFeature.last_value === 0) {
                logger.info(
                  `Thermostat schedule: window open for ${thermostatFeature.selector}, switch OFF`,
                );
                if (config.switch_feature) {
                  const swDevices = await this.gladys.device.get(
                    { device_feature_selectors: config.switch_feature },
                  );
                  const swDevice = swDevices && swDevices[0];
                  const swFeature = swDevice && swDevice.features
                    .find((f) => f.selector === config.switch_feature);
                  if (swDevice && swFeature && swFeature.last_value !== 0) {
                    await this.gladys.device.setValue(swDevice, swFeature, 0);
                  }
                }
                return;
              }
            } catch (e) {
              logger.warn(`Thermostat schedule: Failed to read window sensor: ${e.message}`);
            }
          }

          const [currentPreset, manualVal] = await Promise.all([
            this.gladys.variable.getValue(presetVarKey).catch(() => null),
            this.gladys.variable.getValue(manualVarKey).catch(() => null),
          ]);

          if (manualVal === 'true') {
            const manualUntilKey = `THERMOSTAT_${featureKey}_MANUAL_UNTIL`;
            const manualUntilVal = await this.gladys.variable.getValue(manualUntilKey).catch(() => null);
            const manualUntil = manualUntilVal ? parseInt(manualUntilVal, 10) : null;
            if (manualUntil && Date.now() > manualUntil) {
              logger.info(`Thermostat schedule: manual timer expired for ${thermostatFeature.selector}, reverting to schedule`);
              await this.gladys.variable.setValue(manualVarKey, 'false');
              await this.gladys.variable.setValue(manualUntilKey, '');
              this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
                type: WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.MANUAL_MODE_UPDATED,
                payload: { key: manualVarKey, value: 'false' },
              });
              // Continue — schedule will now be applied below
            } else {
              logger.debug(
                `Thermostat schedule: manual mode active for ${thermostatFeature.selector},`
                + ` actuating switch with manual setpoint`,
              );
              const manualSetpointKey = `THERMOSTAT_${featureKey}_MANUAL_SETPOINT`;
              const manualSetpointRaw = await this.gladys.variable
                .getValue(manualSetpointKey).catch(() => null);
              let manualSetpoint = null;
              if (manualSetpointRaw) {
                try {
                  const parsed = JSON.parse(manualSetpointRaw);
                  if (parsed && parsed.setpoint !== null && !Number.isNaN(parsed.setpoint)) {
                    manualSetpoint = parsed.setpoint;
                  }
                } catch (e) { /* ignore */ }
              }
              if (manualSetpoint !== null && config && config.switch_feature) {
                try {
                  const swDevices = await this.gladys.device.get(
                    { device_feature_selectors: config.switch_feature },
                  );
                  const swDevice = swDevices && swDevices[0];
                  const swFeature = swDevice && swDevice.features
                    .find((f) => f.selector === config.switch_feature);
                  const tmpDevices = await this.gladys.device.get(
                    { device_feature_selectors: config.temperature_feature },
                  );
                  const tmpFeature = tmpDevices && tmpDevices[0]
                    && tmpDevices[0].features.find((f) => f.selector === config.temperature_feature);
                  const currentTemp = tmpFeature ? tmpFeature.last_value : null;
                  if (swDevice && swFeature && currentTemp !== null) {
                    const currentSwitchOn = swFeature.last_value === 1;
                    const mode = config.default_mode || 'heating';
                    const shouldBeActive = computeSwitchActive(
                      currentTemp, manualSetpoint, mode, config, currentSwitchOn,
                    );
                    if (currentSwitchOn !== shouldBeActive) {
                      await this.gladys.device.setValue(swDevice, swFeature, shouldBeActive ? 1 : 0);
                      logger.info(
                        `Thermostat schedule: switch ${shouldBeActive ? 'ON' : 'OFF'}`
                        + ` (manual, setpoint=${manualSetpoint}, temp=${currentTemp})`
                        + ` for ${thermostatFeature.selector}`,
                      );
                    }
                  }
                } catch (e) {
                  logger.warn(`Thermostat schedule: Failed to actuate switch in manual mode: ${e.message}`);
                }
              }
              return;
            }
          }

          if (config) {
            logger.debug(
              `Thermostat schedule: config loaded for ${thermostatFeature.selector}:`
              + ` switch=${config.switch_feature}, temp=${config.temperature_feature}`,
            );
          }

          // Always enforce the scheduled setpoint (handles manual overrides being reverted)
          const newSetpoint = getSetpointForPreset(matchedPreset, config);
          if (newSetpoint !== null && newSetpoint !== undefined) {
            try {
              await this.gladys.device.saveState(thermostatFeature, newSetpoint);
            } catch (e) {
              logger.warn(`Thermostat schedule: Failed to update setpoint: ${e.message}`);
            }
          }

          // Apply preset variable if changed and notify widget
          if (currentPreset !== matchedPreset) {
            await this.gladys.variable.setValue(presetVarKey, matchedPreset);
            logger.info(
              `Thermostat schedule: preset "${matchedPreset}" applied to ${thermostatFeature.selector}`,
            );
          }

          // Always emit PRESET_UPDATED so the widget refreshes its state
          this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
            type: WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.PRESET_UPDATED,
            payload: { key: presetVarKey, value: matchedPreset },
          });

          if (!config || !config.switch_feature) {
            logger.warn(`Thermostat schedule: no switch_feature configured for ${thermostatFeature.selector}, cannot actuate switch`);
            return;
          }

          if (matchedPreset === 'off') {
            // Preset off = switch off
            try {
              const switchDevices = await this.gladys.device.get({
                device_feature_selectors: config.switch_feature,
              });
              const switchDevice = switchDevices && switchDevices[0];
              const switchFeature = switchDevice && switchDevice.features.find(
                (f) => f.selector === config.switch_feature,
              );
              if (switchDevice && switchFeature) {
                await this.gladys.device.setValue(switchDevice, switchFeature, 0);
                logger.info(`Thermostat schedule: switch OFF (preset=off) for ${thermostatFeature.selector}`);
              } else {
                logger.warn(`Thermostat schedule: switch device not found for selector="${config.switch_feature}"`);
              }
            } catch (e) {
              logger.warn(`Thermostat schedule: Failed to turn off switch: ${e.message}`);
            }
            return;
          }

          // Get current temperature from sensor
          const temperatureFeatureSelector = config.temperature_feature;
          if (!temperatureFeatureSelector) {
            logger.warn(`Thermostat schedule: no temperature_feature configured for ${thermostatFeature.selector}, cannot compute switch state`);
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
            logger.warn(`Thermostat schedule: no temperature reading for ${temperatureFeatureSelector}, cannot compute switch state`);
            return;
          }

          const setpoint = getSetpointForPreset(matchedPreset, config);
          const mode = config.default_mode || 'heating';

          // Read switch device once, use current state for stateful hysteresis
          try {
            const switchDevices = await this.gladys.device.get({
              device_feature_selectors: config.switch_feature,
            });
            const switchDevice = switchDevices && switchDevices[0];
            const switchFeature = switchDevice && switchDevice.features.find(
              (f) => f.selector === config.switch_feature,
            );
            if (switchDevice && switchFeature) {
              const currentSwitchOn = switchFeature.last_value === 1;
              const shouldBeActive = computeSwitchActive(currentTemp, setpoint, mode, config, currentSwitchOn);
              logger.debug(`Thermostat schedule: temp=${currentTemp}, setpoint=${setpoint}, mode=${mode}, switchWas=${currentSwitchOn}, shouldBeActive=${shouldBeActive}`);
              const desiredValue = shouldBeActive ? 1 : 0;
              if (currentSwitchOn !== shouldBeActive) {
                await this.gladys.device.setValue(switchDevice, switchFeature, desiredValue);
                logger.info(
                  `Thermostat schedule: switch ${shouldBeActive ? 'ON' : 'OFF'} (preset="${matchedPreset}", temp=${currentTemp}, setpoint=${setpoint}) for ${thermostatFeature.selector}`,
                );
              } else {
                logger.debug(`Thermostat schedule: switch already at desired value ${desiredValue} for ${thermostatFeature.selector}`);
              }
            } else {
              logger.warn(`Thermostat schedule: switch device/feature not found for selector="${config.switch_feature}"`);
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

module.exports = {
  applySchedules,
  getThermostatBoxConfigs,
  parseEnd,
  findMatchingPreset,
  getSetpointForPreset,
  computeSwitchActive,
};
