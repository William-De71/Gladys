/**
 * @description Set a thermostat device feature value (e.g. setpoint).
 * Persists the new value via saveState so it appears in graphs and history.
 * @param {object} device - The device object.
 * @param {object} deviceFeature - The device feature to update.
 * @param {number} value - The new value.
 * @returns {Promise<void>}
 * @example
 * await service.device.setValue(device, deviceFeature, 21.5);
 */
async function setValue(device, deviceFeature, value) {
  await this.gladys.device.saveState(deviceFeature, value);
}

module.exports = { setValue };
