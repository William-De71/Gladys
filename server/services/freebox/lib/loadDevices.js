const logger = require('../../../utils/logger');

/**
 * @description Discover Freebox devices.
 * @param {string} sessionToken - Session token.
 * @returns {Promise} List of discovered devices.
 * @example
 * await loadDevices();
 */
async function loadDevices(sessionToken) {

  const responsePage = await this.request({
    method: 'GET',
    baseURL: this.baseAPIURL,
    headers: {'X-Fbx-App-Auth': sessionToken},
    url: '/home/tileset/all',
  });
  
  const { result } = responsePage.data;

  const list = [];

  result.forEach((device) => list.push(device.node_id));

  logger.debug(`${list.length} Freebox devices loaded`);

  return list;

}

module.exports = {
  loadDevices,
};
