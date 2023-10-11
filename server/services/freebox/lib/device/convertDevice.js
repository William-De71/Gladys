const { DEVICE_POLL_FREQUENCIES } = require('../../../../utils/constants');
const { convertFeature } = require('./convertFeature');
const logger = require('../../../../utils/logger');

/**
 * @description Transform Freebox device to Gladys device.
 * @param {object} freeboxDevice - Freebox device.
 * @returns {object} Gladys device.
 * @example
 * convertDevice({ ... });
 */
function convertDevice(freeboxDevice) {
  const {action, label: name, node_id: id, type, data } = freeboxDevice.specifications[0];
  const externalId = `freebox:${id}`;
  
  logger.debug(`Freebox convert device "${name}"`);

  let model = null;
  if (action === undefined) {
    model = type;
  } else {
    model = action;
  }

  // Groups functions and status on same code
  const groups = {};
  data.forEach((func) => {
    const { name: featureName } = func;
    groups[featureName] = { ...func, readOnly: false };
  });

  const features = Object.values(groups).map((group) => convertFeature(group, externalId));

  const device = {
    name,
    features: features.filter((feature) => feature),
    external_id: externalId,
    selector: externalId,
    model,
    service_id: this.serviceId,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS,
    should_poll: true,
  };
  return device;
}

module.exports = {
  convertDevice,
};
