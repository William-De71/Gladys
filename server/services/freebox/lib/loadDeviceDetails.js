const logger = require('../../../utils/logger');

/**
 * @description Load Freebox device details.
 * @param {string} sessionToken - Session token.
 * @param {object} freeboxDeviceId - Freebox device node id.
 * @returns {Promise} Device with details.
 * @example
 * await loadDeviceDetails(sessionToken, freeboxDeviceId);
 */
async function loadDeviceDetails(sessionToken, freeboxDeviceId) {

  logger.debug(`Loading Freebox device id=${freeboxDeviceId} specifications`);

  const responsePage = await this.request({
    method: 'GET',
    baseURL: this.baseAPIURL,
    headers: {'X-Fbx-App-Auth': sessionToken},
    url: `/home/tileset/${freeboxDeviceId}`,
  });

  const { result } = responsePage.data;

  return { ...freeboxDeviceId, specifications: result };
}

module.exports = {
  loadDeviceDetails,
};
