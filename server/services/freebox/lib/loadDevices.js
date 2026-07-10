const logger = require('../../../utils/logger');

/**
 * @description Load Freebox devices with their specifications.
 * The `/home/tileset/all` response already contains the full tiles
 * (label, type, action, data...), so a single request is enough.
 * @param {string} sessionToken - Session token.
 * @returns {Promise} List of devices ({ node_id, specifications }).
 * @example
 * await loadDevices(sessionToken);
 */
async function loadDevices(sessionToken) {
  const responsePage = await this.request({
    method: 'GET',
    baseURL: this.baseAPIURL,
    headers: { 'X-Fbx-App-Auth': sessionToken },
    url: '/home/tileset/all',
  });

  const { result } = responsePage.data;

  // Group tiles by node id: a device is made of all the tiles of a same node
  const devicesByNodeId = {};
  result.forEach((tile) => {
    if (!devicesByNodeId[tile.node_id]) {
      devicesByNodeId[tile.node_id] = { node_id: tile.node_id, specifications: [] };
    }
    devicesByNodeId[tile.node_id].specifications.push(tile);
  });

  const devices = Object.values(devicesByNodeId);

  logger.debug(`${devices.length} Freebox devices loaded`);

  return devices;
}

module.exports = {
  loadDevices,
};
