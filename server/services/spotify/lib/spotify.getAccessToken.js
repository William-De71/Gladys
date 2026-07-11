const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Return a valid access token, refreshing it first if it is expired.
 * @returns {Promise<string>} A valid Spotify access token.
 * @example
 * const accessToken = await spotify.getAccessToken();
 */
async function getAccessToken() {
  if (!this.refreshToken) {
    throw new ServiceNotConfiguredError('Spotify is not connected.');
  }
  if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
    await this.refreshingTokens();
  }
  return this.accessToken;
}

module.exports = {
  getAccessToken,
};
