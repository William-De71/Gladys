const logger = require('../../../utils/logger');
const { mergeDevices } = require('../../../utils/device');
const { DEVICE_FEATURE_CATEGORIES } = require('../../../utils/constants');

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

  // Look up the rtsp-camera service ID so camera devices can be assigned to it
  let rtspCameraServiceId = null;
  try {
    const rtspService = await this.gladys.service.getLocalServiceByName('rtsp-camera');
    if (rtspService) {
      rtspCameraServiceId = rtspService.id;
    }
  } catch (e) {
    logger.warn('Freebox: rtsp-camera service not found, cameras will use freebox service');
  }
  
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
        const converted = convertDevice(device);
        // Assign camera devices to the rtsp-camera service for image polling/streaming
        const isCamera = converted.features.some(
          (f) => f.category === DEVICE_FEATURE_CATEGORIES.CAMERA,
        );
        return {
          ...converted,
          service_id: isCamera && rtspCameraServiceId ? rtspCameraServiceId : this.serviceId,
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
