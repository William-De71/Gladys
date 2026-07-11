const logger = require('../../../utils/logger');
const { GLADYS_VARIABLES, TOKEN_EXPIRATION_MARGIN_IN_MS } = require('./utils/spotify.constants');

/**
 * @description Store Spotify tokens.
 * @param {object} tokens - Spotify tokens.
 * @returns {Promise<boolean>} True if the tokens are well stored.
 * @example
 * await spotify.setTokens({ accessToken: '...', refreshToken: '...', expiresIn: 3600 });
 */
async function setTokens(tokens) {
  logger.debug('Storing Spotify tokens...');
  const { serviceId } = this;
  const { accessToken, refreshToken, expiresIn } = tokens;
  try {
    await this.gladys.variable.setValue(GLADYS_VARIABLES.ACCESS_TOKEN, accessToken, serviceId);
    await this.gladys.variable.setValue(GLADYS_VARIABLES.REFRESH_TOKEN, refreshToken, serviceId);
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiresAt = expiresIn ? Date.now() + expiresIn * 1000 - TOKEN_EXPIRATION_MARGIN_IN_MS : 0;
    logger.debug('Spotify tokens well stored');
    return true;
  } catch (e) {
    logger.error('Spotify tokens store errored', e);
    return false;
  }
}

module.exports = {
  setTokens,
};
