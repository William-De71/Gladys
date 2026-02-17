const logger = require('../../../utils/logger');
const { mergeDevices } = require('../../../utils/device');

const { convertDevice } = require('./device/convertDevice');

/**
 * @description Discover Freebox devices.
 * @param {object} filters - Filters to apply.
 * @returns {Promise} List of discovered devices.
 * @example
 * await discoverDevices({ filter_existing: 'true' });
 */
async function discoverDevices(filters = {}) {

  // Ensure Freebox has been discovered (baseAPIURL is set)
  if (!this.baseAPIURL) {
    logger.debug('Freebox discoverDevices: baseAPIURL not set, calling discoverFreebox...');
    await this.discoverFreebox();
  }
  logger.debug(`Freebox discoverDevices: baseAPIURL = ${this.baseAPIURL}`);

  this.sessionToken = await this.getSessionToken();
  logger.debug(`Freebox discoverDevices: sessionToken obtained`);

  logger.debug('Looking for Freebox devices...');
  
  // Reset already discovered devices
  this.discoveredDevices = [];
  let devices = [];
  try {
    devices = await this.loadDevices(this.sessionToken);
    logger.debug(`Freebox discoverDevices: ${devices.length} device(s) loaded from Freebox`);
  } catch (e) {
    logger.error('Unable to load Freebox devices', e);
  }
  
  this.discoveredDevices = await Promise.allSettled(
    devices.map((device) => this.loadDeviceDetails(this.sessionToken, device)),
  ).then((results) => results.filter((result) => result.status === 'fulfilled').map((result) => result.value));
    
  logger.debug(`Freebox discoverDevices: ${this.discoveredDevices.length} device detail(s) loaded`);

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
      return mergeDevices(device, existingDevice);
    });

  const { filter_existing: filterExisting } = filters;
  if (`${filterExisting}` === 'true') {
    result = result.filter((device) => device.id === undefined || device.updatable);
  }

  logger.debug(`Freebox discoverDevices: ${result.length} device(s) to show`);
  
  return result;

}

module.exports = {
  discoverDevices,
};
