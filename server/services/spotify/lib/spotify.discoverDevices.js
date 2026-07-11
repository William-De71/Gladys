const logger = require('../../../utils/logger');
const { API } = require('./utils/spotify.constants');
const { convertToGladysDevice } = require('../utils/convertToGladysDevice');

/**
 * @description Discover the Spotify Connect devices available on the account.
 * Only devices currently online (Spotify app open or speaker awake) are returned by the API.
 * @returns {Promise<Array>} Resolves with the discovered Gladys devices.
 * @example
 * await spotify.discoverDevices();
 */
async function discoverDevices() {
  logger.debug('Discovering Spotify Connect devices...');
  const data = await this.callApi('GET', API.DEVICES);
  const spotifyDevices = data && data.devices ? data.devices : [];
  this.discoveredDevices = spotifyDevices
    .filter((device) => !device.is_restricted)
    .map((device) => convertToGladysDevice(this.serviceId, device));
  return this.discoveredDevices;
}

module.exports = {
  discoverDevices,
};
