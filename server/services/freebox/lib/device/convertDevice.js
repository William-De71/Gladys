const { DEVICE_POLL_FREQUENCIES } = require('../../../../utils/constants');
const { convertFeature } = require('./convertFeature');
const logger = require('../../../../utils/logger');

/**
 * @description Build an RTSP URL from a Freebox camera HLS URL.
 * @param {string} hlsUrl - HLS URL from Freebox (e.g. http://freeboxcam:pwd@IP/img/stream.m3u8).
 * @returns {string|null} RTSP URL (e.g. rtsp://freeboxcam:pwd@IP/live) or null if parsing fails.
 * @example
 * buildRtspUrl('http://freeboxcam:pwd@192.168.0.156/img/stream.m3u8');
 */
function buildRtspUrl(hlsUrl) {
  try {
    const url = new URL(hlsUrl);
    const { username, password, hostname } = url;
    if (!hostname) {
      return null;
    }
    const auth = username && password ? `${username}:${password}@` : '';
    return `rtsp://${auth}${hostname}/live`;
  } catch (e) {
    logger.warn(`Freebox: unable to parse camera URL "${hlsUrl}": ${e.message}`);
    return null;
  }
}

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

  // For camera devices, extract the RTSP URL and add it as a device param
  if (type === 'camera') {
    const camFunc = data.find((func) => func.name === 'cam');
    if (camFunc && camFunc.value) {
      const rtspUrl = buildRtspUrl(camFunc.value);
      if (rtspUrl) {
        device.params = [
          { name: 'CAMERA_URL', value: rtspUrl },
          { name: 'CAMERA_ROTATION', value: '0' },
        ];
        device.poll_frequency = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES;
        logger.info(`Freebox camera "${name}" detected with RTSP URL: ${rtspUrl}`);
      }
    }
  }

  return device;
}

module.exports = {
  convertDevice,
};
