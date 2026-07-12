const db = require('../../../models');
const logger = require('../../../utils/logger');
const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../utils/constants');
const { toNumber, getDeviceConfig, getFeatureBySelector } = require('./thermostat.deviceConfig');

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
 * @returns {number|null} Setpoint temperature, null for the off preset.
 * @example
 * getSetpointForPreset('comfort', config);
 */
function getSetpointForPreset(preset, config) {
  if (preset === 'off') {
    return null;
  }
  const configValue = toNumber(config && config[`preset_${preset}`], null);
  if (configValue !== null) {
    return configValue;
  }
  return DEFAULT_PRESET_TEMPS[preset] !== undefined ? DEFAULT_PRESET_TEMPS[preset] : 20;
}

/**
 * @description Compute whether the switch should be active based on current temp and setpoint.
 * Supports hysteresis (default) and TPI (time-proportional) control types.
 * @param {number} currentTemp - Current measured temperature.
 * @param {number} setpoint - Target setpoint.
 * @param {string} mode - 'heating' or 'cooling'.
 * @param {object} config - Thermostat config with hysteresis/TPI values.
 * @param {boolean} currentSwitchOn - Whether the switch is currently ON (for neutral-zone hold).
 * @param {number} [nowMs] - Current epoch in ms (for TPI cycle position, injectable in tests).
 * @returns {boolean} True if switch should be ON.
 * @example
 * computeSwitchActive(18, 20, 'heating', config, false);
 */
function computeSwitchActive(currentTemp, setpoint, mode, config, currentSwitchOn, nowMs = Date.now()) {
  if (currentTemp === null || currentTemp === undefined || setpoint === null || setpoint === undefined) {
    return false;
  }
  if (config && config.control_type === 'tpi') {
    // TPI: over each cycle, the switch is ON for a fraction of the time
    // proportional to the temperature error within the proportional band.
    const cycleMinutes = toNumber(config.tpi_cycle_time, 10);
    const band = toNumber(config.tpi_proportional_band, 2);
    const error = mode === 'cooling' ? currentTemp - setpoint : setpoint - currentTemp;
    const onFraction = Math.min(1, Math.max(0, error / band));
    if (onFraction <= 0) {
      return false;
    }
    if (onFraction >= 1) {
      return true;
    }
    const minuteInCycle = Math.floor(nowMs / 60000) % cycleMinutes;
    return minuteInCycle < onFraction * cycleMinutes;
  }
  const hystStart = toNumber(config && config.hysteresis_start, 0.5);
  const hystStop = toNumber(config && config.hysteresis_stop, 0.5);
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
 * @description Read the switch feature and actuate it if its state differs from the desired one.
 * @param {object} gladys - Gladys instance.
 * @param {string} switchSelector - Switch feature selector.
 * @param {boolean} shouldBeActive - Desired state.
 * @param {string} logContext - Context string for logs.
 * @returns {Promise<void>}
 * @example
 * await actuateSwitch(gladys, 'heater-switch', true, 'preset=comfort');
 */
async function actuateSwitch(gladys, switchSelector, shouldBeActive, logContext) {
  try {
    const found = await getFeatureBySelector(gladys, switchSelector);
    if (!found) {
      logger.warn(`Thermostat schedule: switch device/feature not found for selector="${switchSelector}"`);
      return;
    }
    const currentSwitchOn = found.feature.last_value === 1;
    if (currentSwitchOn !== shouldBeActive) {
      await gladys.device.setValue(found.device, found.feature, shouldBeActive ? 1 : 0);
      logger.info(`Thermostat schedule: switch ${shouldBeActive ? 'ON' : 'OFF'} (${logContext})`);
    } else {
      logger.debug(`Thermostat schedule: switch already ${shouldBeActive ? 'ON' : 'OFF'} (${logContext})`);
    }
  } catch (e) {
    logger.warn(`Thermostat schedule: Failed to actuate switch: ${e.message}`);
  }
}

/**
 * @description Regulate a single thermostat device: window check, manual mode,
 * schedule/preset resolution and switch actuation.
 * @param {object} gladys - Gladys instance.
 * @param {object} device - Thermostat device.
 * @param {object} boxConfigMap - Map of thermostat feature selector to dashboard box.
 * @param {number} dayOfWeek - Current day (0=Monday … 6=Sunday).
 * @param {number} currentMinutes - Current time in minutes since midnight.
 * @returns {Promise<void>}
 * @example
 * await regulateDevice(gladys, device, boxConfigMap, 0, 480);
 */
async function regulateDevice(gladys, device, boxConfigMap, dayOfWeek, currentMinutes) {
  const thermostatFeature = device.features && device.features[0];
  if (!thermostatFeature) {
    return;
  }
  const { selector } = thermostatFeature;
  const featureKey = selector.toUpperCase().replace(/-/g, '_');
  const presetVarKey = `THERMOSTAT_${featureKey}_PRESET`;
  const manualVarKey = `THERMOSTAT_${featureKey}_MANUAL_MODE`;

  const config = await getDeviceConfig(gladys, device, featureKey);
  if (!config) {
    logger.warn(`Thermostat schedule: no config found for ${selector}`);
    return;
  }
  const mode = config.default_mode || 'heating';

  // Window open check: if a window sensor is configured and open, cut the switch and stop here.
  if (config.window_feature) {
    try {
      const win = await getFeatureBySelector(gladys, config.window_feature);
      if (win && win.feature.last_value === 0) {
        logger.info(`Thermostat schedule: window open for ${selector}, switch OFF`);
        if (config.switch_feature) {
          await actuateSwitch(gladys, config.switch_feature, false, `window open, ${selector}`);
        }
        return;
      }
    } catch (e) {
      logger.warn(`Thermostat schedule: Failed to read window sensor: ${e.message}`);
    }
  }

  const [currentPreset, manualVal] = await Promise.all([
    gladys.variable.getValue(presetVarKey).catch(() => null),
    gladys.variable.getValue(manualVarKey).catch(() => null),
  ]);

  // Manual mode: regulate on the manual setpoint until the timer expires.
  if (manualVal === 'true') {
    const manualUntilKey = `THERMOSTAT_${featureKey}_MANUAL_UNTIL`;
    const manualUntilVal = await gladys.variable.getValue(manualUntilKey).catch(() => null);
    const manualUntil = manualUntilVal ? parseInt(manualUntilVal, 10) : null;
    if (manualUntil && Date.now() > manualUntil) {
      logger.info(`Thermostat schedule: manual timer expired for ${selector}, reverting to schedule`);
      await gladys.variable.setValue(manualVarKey, 'false');
      await gladys.variable.setValue(manualUntilKey, '');
      gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
        type: WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.MANUAL_MODE_UPDATED,
        payload: { key: manualVarKey, value: 'false' },
      });
      // Fall through — the schedule/preset is applied below
    } else {
      const manualSetpointRaw = await gladys.variable
        .getValue(`THERMOSTAT_${featureKey}_MANUAL_SETPOINT`)
        .catch(() => null);
      let manualSetpoint = null;
      if (manualSetpointRaw) {
        try {
          const parsed = JSON.parse(manualSetpointRaw);
          manualSetpoint = toNumber(parsed && parsed.setpoint, null);
        } catch (e) {
          /* ignore */
        }
      }
      if (manualSetpoint !== null && config.switch_feature && config.temperature_feature) {
        const tmp = await getFeatureBySelector(gladys, config.temperature_feature);
        const sw = await getFeatureBySelector(gladys, config.switch_feature);
        if (tmp && sw && tmp.feature.last_value !== null) {
          const shouldBeActive = computeSwitchActive(
            tmp.feature.last_value,
            manualSetpoint,
            mode,
            config,
            sw.feature.last_value === 1,
          );
          await actuateSwitch(
            gladys,
            config.switch_feature,
            shouldBeActive,
            `manual, setpoint=${manualSetpoint}, temp=${tmp.feature.last_value}, ${selector}`,
          );
        }
      }
      return;
    }
  }

  // Resolve the target preset: schedule slot first, then the current preset variable.
  // A thermostat without schedule (or between slots) keeps being regulated on its preset.
  const dashboardBox = boxConfigMap[selector] || null;
  const rawScheduleSelector =
    (dashboardBox && dashboardBox.schedule_selector) ||
    (await gladys.variable.getValue(`THERMOSTAT_ACTIVE_SCHEDULE_${featureKey}`).catch(() => null));
  const scheduleSelector = rawScheduleSelector || null;

  let targetPreset = null;
  if (scheduleSelector) {
    const schedule = await db.ThermostatSchedule.findOne({
      where: { selector: scheduleSelector },
      include: [{ model: db.ThermostatScheduleSlot, as: 'slots' }],
    });
    if (schedule) {
      const slotsForToday = schedule.slots.filter((s) => s.day_of_week === dayOfWeek);
      const yesterdayOfWeek = (dayOfWeek + 6) % 7;
      const slotsForYesterday = schedule.slots.filter((s) => s.day_of_week === yesterdayOfWeek);
      targetPreset = findMatchingPreset(slotsForToday, slotsForYesterday, currentMinutes);
    }
  }
  if (!targetPreset) {
    targetPreset = currentPreset || null;
  }
  if (!targetPreset) {
    logger.debug(`Thermostat schedule: no preset resolved for ${selector}, nothing to regulate`);
    return;
  }

  // Enforce the target setpoint on the thermostat feature, only when it changed.
  const newSetpoint = getSetpointForPreset(targetPreset, config);
  if (newSetpoint !== null && thermostatFeature.last_value !== newSetpoint) {
    try {
      await gladys.device.saveState(thermostatFeature, newSetpoint);
    } catch (e) {
      logger.warn(`Thermostat schedule: Failed to update setpoint: ${e.message}`);
    }
  }

  // Persist + notify the preset only when it changed.
  if (currentPreset !== targetPreset) {
    await gladys.variable.setValue(presetVarKey, targetPreset);
    logger.info(`Thermostat schedule: preset "${targetPreset}" applied to ${selector}`);
    gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.PRESET_UPDATED,
      payload: { key: presetVarKey, value: targetPreset },
    });
  }

  if (!config.switch_feature) {
    logger.debug(`Thermostat schedule: no switch_feature configured for ${selector}, cannot actuate switch`);
    return;
  }

  if (targetPreset === 'off') {
    await actuateSwitch(gladys, config.switch_feature, false, `preset=off, ${selector}`);
    return;
  }

  if (!config.temperature_feature) {
    logger.warn(`Thermostat schedule: no temperature_feature configured for ${selector}, cannot compute switch state`);
    return;
  }

  let currentTemp = null;
  try {
    const tmp = await getFeatureBySelector(gladys, config.temperature_feature);
    currentTemp = tmp ? tmp.feature.last_value : null;
  } catch (e) {
    logger.warn(`Thermostat schedule: Failed to read temperature: ${e.message}`);
    return;
  }
  if (currentTemp === null || currentTemp === undefined) {
    logger.warn(`Thermostat schedule: no temperature reading for ${config.temperature_feature}, cannot compute switch state`);
    return;
  }

  const sw = await getFeatureBySelector(gladys, config.switch_feature);
  if (!sw) {
    logger.warn(`Thermostat schedule: switch device/feature not found for selector="${config.switch_feature}"`);
    return;
  }
  const shouldBeActive = computeSwitchActive(currentTemp, newSetpoint, mode, config, sw.feature.last_value === 1);
  await actuateSwitch(
    gladys,
    config.switch_feature,
    shouldBeActive,
    `preset="${targetPreset}", temp=${currentTemp}, setpoint=${newSetpoint}, ${selector}`,
  );
}

/**
 * @description Regulate all thermostats. Called every minute by the service interval.
 * Resolves the target preset (schedule slot, or current preset when no schedule),
 * updates the setpoint/preset when they changed, and actuates the switch
 * (hysteresis or TPI). The server is the single control authority.
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

    const boxConfigMap = await getThermostatBoxConfigs();

    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday=0 ... Sunday=6
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    await Promise.all(
      thermostatDevices.map(async (device) => {
        try {
          await regulateDevice(this.gladys, device, boxConfigMap, dayOfWeek, currentMinutes);
        } catch (e) {
          logger.warn(`Thermostat schedule: Failed to regulate device: ${e.message}`);
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
