const {
  DEVICE_POLL_FREQUENCIES,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} = require('../../../../utils/constants');
const { PLAYER } = require('../utils/constants');
const logger = require('../../../../utils/logger');

// Features exposed for a Freebox Player, all under the "television" category.
// "power" is read-only: the player API only reports the power state,
// it does not allow to switch the player on/off.
const PLAYER_FEATURES = [
  {
    name: 'Power',
    type: DEVICE_FEATURE_TYPES.TELEVISION.BINARY,
    read_only: true,
    keep_history: true,
    min: 0,
    max: 1,
  },
  {
    name: 'Volume',
    type: DEVICE_FEATURE_TYPES.TELEVISION.VOLUME,
    unit: DEVICE_FEATURE_UNITS.PERCENT,
    read_only: false,
    keep_history: false,
    min: 0,
    max: 100,
  },
  {
    name: 'Mute',
    type: DEVICE_FEATURE_TYPES.TELEVISION.VOLUME_MUTE,
    read_only: false,
    keep_history: false,
    min: 0,
    max: 1,
  },
  { name: 'Play', type: DEVICE_FEATURE_TYPES.TELEVISION.PLAY, read_only: false, keep_history: false, min: 0, max: 1 },
  {
    name: 'Pause',
    type: DEVICE_FEATURE_TYPES.TELEVISION.PAUSE,
    read_only: false,
    keep_history: false,
    min: 0,
    max: 1,
  },
  { name: 'Stop', type: DEVICE_FEATURE_TYPES.TELEVISION.STOP, read_only: false, keep_history: false, min: 0, max: 1 },
  {
    name: 'Previous',
    type: DEVICE_FEATURE_TYPES.TELEVISION.PREVIOUS,
    read_only: false,
    keep_history: false,
    min: 0,
    max: 1,
  },
  { name: 'Next', type: DEVICE_FEATURE_TYPES.TELEVISION.NEXT, read_only: false, keep_history: false, min: 0, max: 1 },
  {
    name: 'Rewind',
    type: DEVICE_FEATURE_TYPES.TELEVISION.REWIND,
    read_only: false,
    keep_history: false,
    min: 0,
    max: 1,
  },
  {
    name: 'Fast forward',
    type: DEVICE_FEATURE_TYPES.TELEVISION.FORWARD,
    read_only: false,
    keep_history: false,
    min: 0,
    max: 1,
  },
];

/**
 * @description Transform a Freebox Player to a Gladys device.
 * @param {object} freeboxPlayer - Freebox player ({ id, device_name, api_version, ... }).
 * @returns {object} Gladys device.
 * @example
 * convertPlayer({ id: 1, device_name: 'Freebox Player', api_version: '7.0' });
 */
function convertPlayer(freeboxPlayer) {
  const { id, device_name: name, api_version: apiVersion } = freeboxPlayer;
  const externalId = `freebox:${PLAYER.EXTERNAL_ID_SEGMENT}:${id}`;

  logger.debug(`Freebox convert player "${name}"`);

  // The player API is versioned independently ("7.0" -> "v7" in the URL)
  const [apiVersionMajor] = `${apiVersion}`.split('.');

  const features = PLAYER_FEATURES.map((feature) => ({
    name: feature.name,
    external_id: `${externalId}:${feature.type}`,
    selector: `${externalId}:${feature.type}`,
    category: DEVICE_FEATURE_CATEGORIES.TELEVISION,
    type: feature.type,
    unit: feature.unit,
    read_only: feature.read_only,
    keep_history: feature.keep_history,
    has_feedback: false,
    min: feature.min,
    max: feature.max,
  }));

  return {
    name,
    features,
    external_id: externalId,
    selector: externalId,
    model: PLAYER.MODEL,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_30_SECONDS,
    should_poll: true,
    params: [{ name: PLAYER.API_VERSION_PARAM, value: `v${apiVersionMajor}` }],
  };
}

module.exports = {
  convertPlayer,
};
