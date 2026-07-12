const logger = require('../../../../utils/logger');
const { BadParameters } = require('../../../../utils/coreErrors');
const { DEVICE_FEATURE_TYPES } = require('../../../../utils/constants');
const { getPlayerBaseUrl } = require('./getPlayerBaseUrl');

// Mapping of Gladys television feature types to player media control commands
const MEDIA_COMMANDS = {
  [DEVICE_FEATURE_TYPES.TELEVISION.PLAY]: 'play',
  [DEVICE_FEATURE_TYPES.TELEVISION.PAUSE]: 'pause',
  [DEVICE_FEATURE_TYPES.TELEVISION.STOP]: 'stop',
  [DEVICE_FEATURE_TYPES.TELEVISION.PREVIOUS]: 'prev',
  [DEVICE_FEATURE_TYPES.TELEVISION.NEXT]: 'next',
  [DEVICE_FEATURE_TYPES.TELEVISION.REWIND]: 'seek_backward',
  [DEVICE_FEATURE_TYPES.TELEVISION.FORWARD]: 'seek_forward',
};

/**
 * @description Send a new value to a Freebox Player.
 * @param {object} device - Gladys player device.
 * @param {object} deviceFeature - Gladys device feature.
 * @param {string|number} value - The new device feature value.
 * @returns {Promise} Promise of nothing.
 * @example
 * await setPlayerValue(device, deviceFeature, 1);
 * @see https://github.com/Aymkdn/assistant-freebox-cloud/wiki/Player-API
 */
async function setPlayerValue(device, deviceFeature, value) {
  const playerBaseUrl = getPlayerBaseUrl(device);

  logger.debug(`Freebox player: set "${deviceFeature.type}" to ${value} on ${playerBaseUrl}...`);

  if (deviceFeature.type === DEVICE_FEATURE_TYPES.TELEVISION.VOLUME) {
    await this.playerRequest({
      method: 'PUT',
      url: `${playerBaseUrl}/control/volume`,
      data: { volume: Math.round(Number(value)) },
    });
    return;
  }

  if (deviceFeature.type === DEVICE_FEATURE_TYPES.TELEVISION.VOLUME_MUTE) {
    await this.playerRequest({
      method: 'PUT',
      url: `${playerBaseUrl}/control/volume`,
      data: { mute: Number(value) === 1 },
    });
    return;
  }

  const cmd = MEDIA_COMMANDS[deviceFeature.type];
  if (!cmd) {
    throw new BadParameters(`Freebox player: feature type "${deviceFeature.type}" is not managed`);
  }

  await this.playerRequest({
    method: 'POST',
    url: `${playerBaseUrl}/control/mediactrl`,
    data: { cmd },
  });
}

module.exports = {
  setPlayerValue,
};
