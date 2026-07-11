const logger = require('../../../utils/logger');
const { STATUS } = require('./utils/spotify.constants');

/**
 * @description Disconnect from Spotify and clear the stored tokens.
 * @returns {Promise} Resolves when disconnected.
 * @example
 * await spotify.disconnect();
 */
async function disconnect() {
  logger.debug('Disconnecting from Spotify...');
  await this.setTokens({ accessToken: '', refreshToken: '', expiresIn: 0 });
  this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
  logger.debug('Spotify disconnected');
}

module.exports = {
  disconnect,
};
