const { DEVICE_FEATURE_TYPES } = require('../../../utils/constants');
const { API } = require('./utils/spotify.constants');

/**
 * @description Send the new device value to the Spotify API.
 * @param {object} device - Updated Gladys device.
 * @param {object} deviceFeature - Updated Gladys device feature.
 * @param {string|number} value - The new device feature value.
 * @example
 * await spotify.setValue(device, deviceFeature, 1);
 */
async function setValue(device, deviceFeature, value) {
  const deviceId = device.external_id.split(':')[1];
  switch (deviceFeature.type) {
    case DEVICE_FEATURE_TYPES.MUSIC.PLAY:
      await this.callApi('PUT', `${API.PLAY}?device_id=${deviceId}`);
      break;
    case DEVICE_FEATURE_TYPES.MUSIC.PAUSE:
      await this.callApi('PUT', `${API.PAUSE}?device_id=${deviceId}`);
      break;
    case DEVICE_FEATURE_TYPES.MUSIC.NEXT:
      await this.callApi('POST', `${API.NEXT}?device_id=${deviceId}`);
      break;
    case DEVICE_FEATURE_TYPES.MUSIC.PREVIOUS:
      await this.callApi('POST', `${API.PREVIOUS}?device_id=${deviceId}`);
      break;
    case DEVICE_FEATURE_TYPES.MUSIC.VOLUME:
      await this.callApi('PUT', `${API.VOLUME}?volume_percent=${Math.round(Number(value))}&device_id=${deviceId}`);
      this.lastVolumeCommandAt = Date.now();
      break;
    default:
      break;
  }
  this.refreshPlaybackStateSoon();
}

module.exports = {
  setValue,
};
