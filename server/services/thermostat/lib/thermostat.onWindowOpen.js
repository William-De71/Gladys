const logger = require('../../../utils/logger');
const { getThermostatBoxConfigs } = require('./thermostat.applySchedules');
const { buildParamsConfig, getFeatureBySelector } = require('./thermostat.deviceConfig');

/**
 * @description Called when a device feature state changes.
 * If the feature is a configured window sensor and the window is now open,
 * immediately turn off the associated heating switch.
 * Services emit EVENTS.DEVICE.NEW_STATE with { device_feature_external_id, state };
 * the legacy { device_feature, last_value } shape is also accepted.
 * @param {object} event - The device new-state event payload.
 * @returns {Promise<void>}
 * @example
 * await thermostatHandler.onDeviceNewState({ device_feature_external_id: 'zigbee2mqtt:xx', state: 0 });
 */
async function onDeviceNewState(event) {
  if (!event) {
    return;
  }
  const newValue = event.state !== undefined ? event.state : event.last_value;
  if (newValue !== 0) {
    return;
  }
  let changedSelector = event.device_feature || event.device_feature_selector || null;
  if (!changedSelector && event.device_feature_external_id) {
    const feature = this.gladys.stateManager.get('deviceFeatureByExternalId', event.device_feature_external_id);
    changedSelector = feature ? feature.selector : null;
  }
  if (!changedSelector) {
    return;
  }
  try {
    const thermostatDevices = await this.gladys.device.get({ service: 'thermostat' });
    if (!thermostatDevices || thermostatDevices.length === 0) {
      return;
    }
    const boxConfigMap = await getThermostatBoxConfigs();
    await Promise.all(
      thermostatDevices.map(async (device) => {
        const thermostatFeature = device.features && device.features[0];
        if (!thermostatFeature) {
          return;
        }
        const paramsConfig = buildParamsConfig(device) || {};
        let windowFeature = paramsConfig.window_feature || null;
        let switchFeature = paramsConfig.switch_feature || null;
        // Fallback to dashboard box config
        if (!windowFeature || !switchFeature) {
          const dashboardBox = boxConfigMap[thermostatFeature.selector] || null;
          if (!windowFeature) {
            windowFeature = (dashboardBox && dashboardBox.window_feature) || null;
          }
          if (!switchFeature) {
            switchFeature = (dashboardBox && dashboardBox.switch_feature) || null;
          }
        }
        if (!windowFeature || windowFeature !== changedSelector || !switchFeature) {
          return;
        }
        logger.info(
          `Thermostat: window opened (${changedSelector})` +
            ` for ${thermostatFeature.selector}, turning switch OFF immediately`,
        );
        try {
          const sw = await getFeatureBySelector(this.gladys, switchFeature);
          if (sw && sw.feature.last_value !== 0) {
            await this.gladys.device.setValue(sw.device, sw.feature, 0);
          }
        } catch (e) {
          logger.warn(`Thermostat: Failed to turn off switch on window open: ${e.message}`);
        }
      }),
    );
  } catch (e) {
    logger.warn(`Thermostat onDeviceNewState error: ${e.message}`);
  }
}

module.exports = { onDeviceNewState };
