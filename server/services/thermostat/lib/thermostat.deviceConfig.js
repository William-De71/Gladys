/**
 * @description Parse a value as a finite number, falling back to a default.
 * Unlike `parseFloat(x) || d`, a legitimate 0 is preserved.
 * @param {*} value - Raw value (string, number, null...).
 * @param {number|null} defaultValue - Fallback when the value is not a finite number.
 * @returns {number|null} Parsed number or the default.
 * @example
 * toNumber('0', 7); // 0
 */
function toNumber(value, defaultValue) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * @description Build a thermostat config object from device params.
 * @param {object} device - Thermostat device with params.
 * @returns {object|null} Config object, or null when the device has no params.
 * @example
 * const config = buildParamsConfig(device);
 */
function buildParamsConfig(device) {
  if (!device.params || device.params.length === 0) {
    return null;
  }
  const getParam = (name) => {
    const p = device.params.find((x) => x.name === name);
    return p ? p.value : null;
  };
  return {
    temperature_feature: getParam('THERMOSTAT_TEMPERATURE_FEATURE') || null,
    humidity_feature: getParam('THERMOSTAT_HUMIDITY_FEATURE') || null,
    switch_feature: getParam('THERMOSTAT_SWITCH_FEATURE') || null,
    window_feature: getParam('THERMOSTAT_WINDOW_FEATURE') || null,
    default_mode: getParam('THERMOSTAT_MODE') || 'heating',
    control_type: getParam('THERMOSTAT_CONTROL_TYPE') || 'hysteresis',
    preset_frost: toNumber(getParam('THERMOSTAT_PRESET_FROST'), 7),
    preset_away: toNumber(getParam('THERMOSTAT_PRESET_AWAY'), 16),
    preset_eco: toNumber(getParam('THERMOSTAT_PRESET_ECO'), 18),
    preset_night: toNumber(getParam('THERMOSTAT_PRESET_NIGHT'), 17),
    preset_comfort: toNumber(getParam('THERMOSTAT_PRESET_COMFORT'), 21),
    hysteresis_start: toNumber(getParam('THERMOSTAT_HYSTERESIS_START'), 0.5),
    hysteresis_stop: toNumber(getParam('THERMOSTAT_HYSTERESIS_STOP'), 0.5),
    tpi_cycle_time: toNumber(getParam('THERMOSTAT_TPI_CYCLE_TIME'), 10),
    tpi_proportional_band: toNumber(getParam('THERMOSTAT_TPI_PROPORTIONAL_BAND'), 2),
  };
}

/**
 * @description Load the full config of a thermostat device: device params first,
 * then the THERMOSTAT_CONFIG_<KEY> variable fills any missing field.
 * @param {object} gladys - Gladys instance.
 * @param {object} device - Thermostat device.
 * @param {string} featureKey - Feature selector uppercased with dashes replaced by underscores.
 * @returns {Promise<object|null>} Merged config or null.
 * @example
 * const config = await getDeviceConfig(gladys, device, 'THERMOSTAT_LIVING_ROOM');
 */
async function getDeviceConfig(gladys, device, featureKey) {
  let config = buildParamsConfig(device);
  if (!config || !config.temperature_feature) {
    try {
      const configRaw = await gladys.variable.getValue(`THERMOSTAT_CONFIG_${featureKey}`);
      if (configRaw) {
        const parsed = JSON.parse(configRaw);
        if (!config) {
          config = parsed;
        } else {
          Object.keys(parsed).forEach((k) => {
            if (config[k] === null || config[k] === undefined) {
              config[k] = parsed[k];
            }
          });
        }
      }
    } catch (e) {
      // ignore: variable missing or invalid JSON, params config is used as-is
    }
  }
  return config;
}

/**
 * @description Fetch a device feature (and its device) by feature selector.
 * @param {object} gladys - Gladys instance.
 * @param {string} selector - Device feature selector.
 * @returns {Promise<{device: object, feature: object}|null>} Device + feature, or null.
 * @example
 * const found = await getFeatureBySelector(gladys, 'heater-switch');
 */
async function getFeatureBySelector(gladys, selector) {
  const devices = await gladys.device.get({ device_feature_selectors: selector });
  const device = devices && devices[0];
  const feature = device && device.features.find((f) => f.selector === selector);
  return device && feature ? { device, feature } : null;
}

module.exports = {
  toNumber,
  buildParamsConfig,
  getDeviceConfig,
  getFeatureBySelector,
};
