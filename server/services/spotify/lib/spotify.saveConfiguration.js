const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES } = require('./utils/spotify.constants');

/**
 * @description Save Spotify configuration.
 * @param {object} configuration - Configuration to save.
 * @returns {Promise<boolean>} True if the configuration is well saved.
 * @example
 * await spotify.saveConfiguration({ clientId: '...', clientSecret: '...' });
 */
async function saveConfiguration(configuration) {
  logger.debug('Saving Spotify configuration...');
  const { clientId, clientSecret } = configuration;
  try {
    await this.gladys.variable.setValue(GLADYS_VARIABLES.CLIENT_ID, clientId, this.serviceId);
    await this.gladys.variable.setValue(GLADYS_VARIABLES.CLIENT_SECRET, clientSecret, this.serviceId);
    this.configuration.clientId = clientId;
    this.configuration.clientSecret = clientSecret;
    logger.debug('Spotify configuration well stored');
    return true;
  } catch (e) {
    logger.error('Spotify configuration store errored', e);
    return false;
  }
}

module.exports = {
  saveConfiguration,
};
