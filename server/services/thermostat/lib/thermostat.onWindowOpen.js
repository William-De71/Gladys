const logger = require('../../../utils/logger');
const { getThermostatBoxConfigs } = require('./thermostat.applySchedules');

/**
 * @description Called when a device feature state changes.
 * If the feature is a configured window sensor and the window is now open,
 * immediately turn off the associated heating switch.
 * @param {object} event - The device new-state event payload.
 * @param {string} event.device_feature_selector - Selector of the feature that changed.
 * @param {number} event.last_value - New value of the feature.
 * @returns {Promise<void>}
 * @example
 * await thermostatHandler.onDeviceNewState({ device_feature_selector: 'my-window', last_value: 0 });
 */
async function onDeviceNewState(event) {
  if (!event || event.last_value !== 0) {
    return;
  }
  const changedSelector = event.device_feature || event.device_feature_selector || null;
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
        // Build config from device params
        let windowFeature = null;
        let switchFeature = null;
        if (device.params && device.params.length > 0) {
          const getParam = (name) => {
            const p = device.params.find((x) => x.name === name);
            return p ? p.value : null;
          };
          windowFeature = getParam('THERMOSTAT_WINDOW_FEATURE') || null;
          switchFeature = getParam('THERMOSTAT_SWITCH_FEATURE') || null;
        }
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
        if (!windowFeature || windowFeature !== changedSelector) {
          return;
        }
        if (!switchFeature) {
          return;
        }
        logger.info(
          `Thermostat: window opened (${changedSelector})`
          + ` for ${thermostatFeature.selector}, turning switch OFF immediately`,
        );
        try {
          const swDevices = await this.gladys.device.get(
            { device_feature_selectors: switchFeature },
          );
          const swDevice = swDevices && swDevices[0];
          const swFeature = swDevice && swDevice.features
            .find((f) => f.selector === switchFeature);
          if (swDevice && swFeature && swFeature.last_value !== 0) {
            await this.gladys.device.setValue(swDevice, swFeature, 0);
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
