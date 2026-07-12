const { PLAYER } = require('../utils/constants');

/**
 * @description Build the base URL of the player API of a Gladys player device.
 * @param {object} device - Gladys device (external_id "freebox:player:{id}").
 * @returns {string} Base URL, e.g. "/player/1/api/v6".
 * @example
 * getPlayerBaseUrl(device);
 */
function getPlayerBaseUrl(device) {
  const [, , playerId] = device.external_id.split(':');

  const apiVersionParam = (device.params || []).find((param) => param.name === PLAYER.API_VERSION_PARAM);
  const apiVersion = apiVersionParam ? apiVersionParam.value : PLAYER.DEFAULT_API_VERSION;

  return `/player/${playerId}/api/${apiVersion}`;
}

module.exports = {
  getPlayerBaseUrl,
};
