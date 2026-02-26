const logger = require('../../../utils/logger');

/**
 * @description Get all thermostat devices linked to this service.
 * @returns {Promise<Array>} List of thermostat devices.
 * @example
 * await gladys.services.thermostat.device.getDevices();
 */
async function getDevices() {
  logger.info('Thermostat: Getting devices');
  const devices = await this.gladys.device.get({
    service: 'thermostat',
  });
  return devices;
}

module.exports = { getDevices };
