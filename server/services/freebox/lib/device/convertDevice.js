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
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS,
    should_poll: true,
  };

  // For camera devices, use the HLS URL provided by the Freebox as camera stream.
  // Note: the Freebox also exposes an RTSP endpoint, but its stream misses the H264
  // SPS/PPS parameters and ffmpeg cannot decode it, while the HLS stream works fine.
  if (type === 'camera') {
    const camFunc = data.find((func) => func.name === 'cam');
    if (camFunc && camFunc.value) {
      device.params = [
        { name: 'CAMERA_URL', value: camFunc.value },
        { name: 'CAMERA_ROTATION', value: '0' },
      ];
      device.poll_frequency = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES;
      logger.info(`Freebox camera "${name}" detected with stream URL: ${camFunc.value}`);
    }
  }

  return device;
}

module.exports = {
  convertDevice,
};
