const { fetch } = require('undici');

const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { STATUS, API } = require('./utils/spotify.constants');

/**
 * @description Exchange the OAuth2 authorization code against access and refresh tokens.
 * @param {object} body - Body with the code returned by Spotify.
 * @returns {Promise<object>} Success object.
 * @example
 * await spotify.retrieveTokens({ codeOAuth: '...', state: '...', redirectUri: '...' });
 */
async function retrieveTokens(body) {
  logger.debug('Getting tokens from Spotify API...');
  const { clientId, clientSecret } = this.configuration;
  const { codeOAuth, state, redirectUri } = body;
  if (!clientId || !clientSecret || !codeOAuth) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Spotify is not configured.');
  }
  if (state !== this.stateGetAccessToken) {
    this.saveStatus({ statusType: STATUS.DISCONNECTED, message: null });
    throw new ServiceNotConfiguredError(
      'Spotify did not connect correctly. The return does not correspond to the initial request',
    );
  }
  this.saveStatus({ statusType: STATUS.PROCESSING_TOKEN, message: null });
  const authentificationForm = {
    grant_type: 'authorization_code',
    code: codeOAuth,
    redirect_uri: redirectUri,
    code_verifier: this.codeVerifier,
  };
  try {
    const response = await fetch(API.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams(authentificationForm).toString(),
    });
    const rawBody = await response.text();
    if (!response.ok) {
      logger.error('Error getting new accessToken from Spotify - Details: ', response.status, rawBody);
      throw new Error(`HTTP error ${response.status} - ${rawBody}`);
    }
    const data = JSON.parse(rawBody);
    await this.setTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    });
    this.saveStatus({ statusType: STATUS.CONNECTED, message: null });
    logger.debug('Spotify new access tokens well loaded');
    this.pollPlaybackState();
    return { success: true };
  } catch (e) {
    this.saveStatus({
      statusType: STATUS.ERROR.PROCESSING_TOKEN,
      message: 'get_access_token_fail',
    });
    logger.error('Error getting new accessToken from Spotify - Details: ', e);
    throw new ServiceNotConfiguredError(`SPOTIFY: Service is not connected with error ${e}`);
  }
}

module.exports = {
  retrieveTokens,
};
