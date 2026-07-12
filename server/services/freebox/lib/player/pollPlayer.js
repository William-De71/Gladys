const { EVENTS, DEVICE_FEATURE_TYPES } = require('../../../../utils/constants');
const logger = require('../../../../utils/logger');
const { getPlayerBaseUrl } = require('./getPlayerBaseUrl');

/**
 * @description Poll a Freebox Player device (power state, volume, mute).
 * @param {object} device - The Gladys player device to poll.
 * @returns {Promise} Promise of nothing.
 * @example
 * await pollPlayer(device);
 */
async function pollPlayer(device) {
  const playerBaseUrl = getPlayerBaseUrl(device);

  const emitIfChanged = (featureType, value) => {
    const deviceFeature = device.features.find((feature) => feature.type === featureType);
    if (!deviceFeature || value === null || value === undefined) {
      return;
    }
    if (deviceFeature.last_value !== value) {
      this.gladys.event.emit(EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: deviceFeature.external_id,
        state: value,
      });
    }
  };

  const statusResponse = await this.playerRequest({
    method: 'GET',
    url: `${playerBaseUrl}/status/`,
  });

  const { power_state: powerState } = statusResponse.data.result || {};
  emitIfChanged(DEVICE_FEATURE_TYPES.TELEVISION.BINARY, powerState === 'running' ? 1 : 0);

  // Volume is only reachable when the player is running
  if (powerState !== 'running') {
    return;
  }

  try {
    const volumeResponse = await this.playerRequest({
      method: 'GET',
      url: `${playerBaseUrl}/control/volume`,
    });

    const { volume, mute } = volumeResponse.data.result || {};
    if (volume !== undefined) {
      emitIfChanged(DEVICE_FEATURE_TYPES.TELEVISION.VOLUME, volume);
    }
    if (mute !== undefined) {
      emitIfChanged(DEVICE_FEATURE_TYPES.TELEVISION.VOLUME_MUTE, mute ? 1 : 0);
    }
  } catch (e) {
    logger.debug(`Freebox: unable to get volume of player "${device.selector}"`);
    logger.debug(e);
  }
}

module.exports = {
  pollPlayer,
};
