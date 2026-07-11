const { fetch } = require('undici');

const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { STATUS, API } = require('./utils/spotify.constants');

/**
 * @description Refresh the Spotify access token with the stored refresh token.
 * @returns {Promise<object>} Success object.
 * @example
 * await spotify.refreshingTokens();
 */
async function refreshingTokens() {
  const { clientId, clientSecret } = this.configuration;
  if (!clientId || !clientSecret) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Spotify is not configured.');
  }
  if (!this.refreshToken) {
    logger.debug('Spotify: no refresh token');
    this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
    throw new ServiceNotConfiguredError('Spotify is not connected.');
  }
  logger.debug('Refreshing Spotify tokens...');
  const authentificationForm = {
    grant_type: 'refresh_token',
    refresh_token: this.refreshToken,
  };
  let response;
  let rawBody;
  try {
    response = await fetch(API.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(authentificationForm).toString(),
    });
    rawBody = await response.text();
  } catch (e) {
    // Network error: keep the tokens, the next poll will retry
    logger.warn('Spotify refresh token network error, keeping tokens for retry: ', e);
    throw new Error(`SPOTIFY: Network error during token refresh - ${e.message}`);
  }

  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) {
      // Transient error: keep the tokens, the next poll will retry
      logger.warn(`Spotify refresh token transient HTTP error ${response.status}, keeping tokens for retry`);
      throw new Error(`SPOTIFY: Transient HTTP ${response.status} during token refresh - ${rawBody}`);
    }
    logger.error('Spotify refresh token fatal error, clearing tokens: ', response.status, rawBody);
    await this.setTokens({ accessToken: '', refreshToken: '', expiresIn: 0 });
    this.saveStatus({ statusType: STATUS.ERROR.PROCESSING_TOKEN, message: 'refresh_token_fail' });
    throw new ServiceNotConfiguredError(`SPOTIFY: HTTP error ${response.status} - ${rawBody}`);
  }

  const data = JSON.parse(rawBody);
  await this.setTokens({
    accessToken: data.access_token,
    // Spotify does not always return a new refresh token, keep the current one in that case
    refreshToken: data.refresh_token || this.refreshToken,
    expiresIn: data.expires_in,
  });
  this.saveStatus({ statusType: STATUS.CONNECTED, message: null });
  logger.debug('Spotify access token well refreshed');
  return { success: true };
}

module.exports = {
  refreshingTokens,
};
