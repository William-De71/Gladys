const logger = require('../../../utils/logger');
const { mergeDevices } = require('../../../utils/device');

const { convertDevice } = require('./device/convertDevice');

/**
 * @description Discover Freebox devices.
 * @param {object} filters - Filters to apply.
 * @returns {Promise} List of discovered devices.
 * @example
 * await discoverDevices({ filter_existing: 'true', refresh: 'true' });
 */
async function discoverDevices(filters = {}) {
  const { filter_existing: filterExisting, refresh } = filters;

  // Only scan the Freebox if asked (refresh) or if nothing was discovered yet;
  // otherwise reuse the cached devices and simply re-merge them with Gladys state
  const shouldScan = `${refresh}` === 'true' || this.discoveredDevices.length === 0;

  if (shouldScan) {
    // Ensure Freebox has been discovered (baseAPIURL is set)
    if (!this.baseAPIURL) {
      logger.debug('Freebox discoverDevices: baseAPIURL not set, calling discoverFreebox...');
      await this.discoverFreebox();
    }
    logger.debug(`Freebox discoverDevices: baseAPIURL = ${this.baseAPIURL}`);

    this.sessionToken = await this.getSessionToken();
    logger.debug(`Freebox discoverDevices: sessionToken obtained`);

    logger.debug('Looking for Freebox devices...');

    try {
      this.discoveredDevices = await this.loadDevices(this.sessionToken);
      logger.debug(`Freebox discoverDevices: ${this.discoveredDevices.length} device(s) loaded from Freebox`);
    } catch (e) {
      logger.error('Unable to load Freebox devices', e);
    }
  }

  let result = this.discoveredDevices
    .map((device) => {
      try {
        return {
          ...convertDevice(device),
          service_id: this.serviceId,
        };
      } catch (e) {
        logger.error(`Freebox discoverDevices: error converting device`, e);
        return null;
      }
    })
    .filter((device) => device !== null)
    .map((device) => {
      const existingDevice = this.gladys.stateManager.get('deviceByExternalId', device.external_id);
      const mergedDevice = mergeDevices(device, existingDevice);
      // Device created under another service (e.g. cameras once assigned to rtsp-camera):
      // mark it updatable so it can be reassigned to the Freebox service
      if (existingDevice && existingDevice.service_id !== this.serviceId) {
        mergedDevice.updatable = true;
      }
      return mergedDevice;
    });

  if (`${filterExisting}` === 'true') {
    result = result.filter((device) => device.id === undefined || device.updatable);
  }

  logger.debug(`Freebox discoverDevices: ${result.length} device(s) to show`);

  return result;
}

module.exports = {
  discoverDevices,
};
