const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES } = require('./utils/spotify.constants');

/**
 * @description Loads Spotify stored configuration.
 * @returns {Promise<object>} Spotify configuration.
 * @example
 * await spotify.getConfiguration();
 */
async function getConfiguration() {
  logger.debug('Loading Spotify configuration...');
  const { serviceId } = this;
  this.configuration.clientId = await this.gladys.variable.getValue(GLADYS_VARIABLES.CLIENT_ID, serviceId);
  this.configuration.clientSecret = await this.gladys.variable.getValue(GLADYS_VARIABLES.CLIENT_SECRET, serviceId);
  return this.configuration;
}

module.exports = {
  getConfiguration,
};
