const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Get the latest image of a Freebox camera.
 * The capture itself (ffmpeg on the camera RTSP URL) is delegated
 * to the rtsp-camera service, based on the CAMERA_URL device param.
 * @param {object} device - The camera device.
 * @returns {Promise} Resolve with the camera image.
 * @example
 * getImage(device);
 */
async function getImage(device) {
  const rtspCameraService = this.gladys.service.getService('rtsp-camera');
  if (rtspCameraService === null) {
    throw new ServiceNotConfiguredError('RTSP_CAMERA_SERVICE_NOT_CONFIGURED');
  }
  return rtspCameraService.device.getImage(device);
}

module.exports = {
  getImage,
};
