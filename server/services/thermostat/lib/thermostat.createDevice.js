const logger = require('../../../utils/logger');

/**
 * @description Create a thermostat device linked to this service.
 * @param {object} device - Device to create.
 * @returns {Promise<object>} Created device.
 * @example
 * await gladys.services.thermostat.device.createDevice({ name: 'Thermostat Salon', ... });
 */
async function createDevice(device) {
  logger.info(`Thermostat: Creating device "${device.name}"`);
  const createdDevice = await this.gladys.device.create({
    ...device,
    service_id: this.serviceId,
  });
  return createdDevice;
}

module.exports = { createDevice };
