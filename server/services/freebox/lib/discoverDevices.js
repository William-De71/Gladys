const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { FREEBOX_APPTOKEN_KEY } = require('./utils/constants');

const { convertDevice } = require('./device/convertDevice');

/**
 * @description Discover Freebox devices.
 * @returns {Promise} List of discovered devices;.
 * @example
 * await discoverDevices();
 */
async function discoverDevices() {

  const appToken = await this.gladys.variable.getValue(FREEBOX_APPTOKEN_KEY, this.serviceId);
    
  if (!appToken) {
    throw new ServiceNotConfiguredError(`Freebox is not connected`);
  }
  
  if (appToken) {

    this.sessionToken = await this.getSessionToken();

    logger.debug('Looking for Freebox devices...');
    
    // Reset already discovered devices
    this.discoveredDevices = [];
    let devices = [];
    try {
      devices = await this.loadDevices(this.sessionToken);
    } catch (e) {
      logger.error('Unable to load Freebox devices', e);
    }
    
    this.discoveredDevices = await Promise.allSettled(
      devices.map((device) => this.loadDeviceDetails(this.sessionToken, device)),
    ).then((results) => results.filter((result) => result.status === 'fulfilled').map((result) => result.value));
      
    this.discoveredDevices = this.discoveredDevices
      .map((device) => ({
        ...convertDevice(device),
        service_id: this.serviceId,
      }))
      .filter((device) => {
        const existInGladys = this.gladys.stateManager.get('deviceByExternalId', device.external_id);
        return existInGladys === null;
      });
    
    return this.discoveredDevices;

  }
}

module.exports = {
  discoverDevices,
};
