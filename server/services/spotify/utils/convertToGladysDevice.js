const { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } = require('../../../utils/constants');

/**
 * @description Convert a Spotify Connect device to a Gladys device.
 * @param {string} serviceId - The service id.
 * @param {object} device - The Spotify Connect device.
 * @returns {object} Gladys device.
 * @example
 * convertToGladysDevice('6a37dd9d-48c7-4d09-a7bb-33f257edb78d', { id: '...', name: 'Living room', type: 'Speaker' });
 */
const convertToGladysDevice = (serviceId, device) => {
  return {
    name: device.name,
    external_id: `spotify:${device.id}`,
    service_id: serviceId,
    model: device.type,
    should_poll: false,
    features: [
      {
        name: `${device.name} - Play`,
        external_id: `spotify:${device.id}:play`,
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.PLAY,
        min: 1,
        max: 1,
        keep_history: false,
        read_only: false,
        has_feedback: false,
      },
      {
        name: `${device.name} - Pause`,
        external_id: `spotify:${device.id}:pause`,
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.PAUSE,
        min: 1,
        max: 1,
        keep_history: false,
        read_only: false,
        has_feedback: false,
      },
      {
        name: `${device.name} - Previous`,
        external_id: `spotify:${device.id}:previous`,
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.PREVIOUS,
        min: 1,
        max: 1,
        keep_history: false,
        read_only: false,
        has_feedback: false,
      },
      {
        name: `${device.name} - Next`,
        external_id: `spotify:${device.id}:next`,
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.NEXT,
        min: 1,
        max: 1,
        keep_history: false,
        read_only: false,
        has_feedback: false,
      },
      {
        name: `${device.name} - Volume`,
        external_id: `spotify:${device.id}:volume`,
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.VOLUME,
        min: 0,
        max: 100,
        keep_history: false,
        read_only: false,
        has_feedback: false,
      },
      {
        name: `${device.name} - PlayBack State`,
        external_id: `spotify:${device.id}:playback-state`,
        category: DEVICE_FEATURE_CATEGORIES.MUSIC,
        type: DEVICE_FEATURE_TYPES.MUSIC.PLAYBACK_STATE,
        min: 0,
        max: 1,
        keep_history: false,
        read_only: true,
        has_feedback: false,
      },
    ],
  };
};

module.exports = {
  convertToGladysDevice,
};
