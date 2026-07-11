const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES, STATUS } = require('./utils/spotify.constants');

/**
 * @description Initialize the Spotify service: load configuration and tokens, then start polling.
 * @example
 * await spotify.init();
 */
async function init() {
  await this.getConfiguration();
  const { clientId, clientSecret } = this.configuration;
  if (!clientId || !clientSecret) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    logger.info('Spotify service is not configured');
    return;
  }
  this.configured = true;
  this.accessToken = await this.gladys.variable.getValue(GLADYS_VARIABLES.ACCESS_TOKEN, this.serviceId);
  this.refreshToken = await this.gladys.variable.getValue(GLADYS_VARIABLES.REFRESH_TOKEN, this.serviceId);
  // Force a refresh on the first API call, the stored access token is probably expired
  this.tokenExpiresAt = 0;
  if (!this.refreshToken) {
    this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
    logger.info('Spotify service is configured but not connected');
    return;
  }
  try {
    await this.refreshingTokens();
    this.pollPlaybackState();
  } catch (e) {
    logger.warn('Spotify init: unable to refresh tokens: ', e);
  }
}

module.exports = {
  init,
};
