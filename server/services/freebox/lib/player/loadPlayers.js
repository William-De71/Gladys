const logger = require('../../../../utils/logger');

/**
 * @description Load Freebox Players (set-top boxes).
 * Requires the "player" permission to be granted to the app in Freebox OS
 * (Paramètres de la Freebox > Gestion des accès > Applications).
 * @returns {Promise} List of players ({ id, device_name, api_version, ... }).
 * @example
 * await loadPlayers();
 */
async function loadPlayers() {
  const response = await this.playerRequest({
    method: 'GET',
    url: '/player',
  });

  const { result } = response.data;

  // Log the raw list: a player can be present but filtered out below
  // (api_available false: deep standby, outdated firmware...)
  logger.debug(`Freebox loadPlayers: raw response: ${JSON.stringify(result)}`);

  const players = (result || []).filter((player) => player.api_available);

  logger.debug(`${players.length} Freebox player(s) loaded`);

  return players;
}

module.exports = {
  loadPlayers,
};
