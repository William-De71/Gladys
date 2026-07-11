const crypto = require('crypto');

const logger = require('../../../utils/logger');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');
const { STATUS, API, SCOPES } = require('./utils/spotify.constants');

/**
 * @description Build the Spotify authorization URL (OAuth2 authorization code flow with PKCE).
 * The front adds the redirect_uri and redirects the user to this URL.
 * @returns {Promise<object>} The authorization URL and the anti-CSRF state.
 * @example
 * await spotify.connect();
 */
async function connect() {
  const { clientId, clientSecret } = this.configuration;
  if (!clientId || !clientSecret) {
    this.saveStatus({ statusType: STATUS.NOT_INITIALIZED, message: null });
    throw new ServiceNotConfiguredError('Spotify is not configured.');
  }
  this.saveStatus({ statusType: STATUS.CONNECTING, message: null });
  logger.debug('Connecting to Spotify...');

  this.stateGetAccessToken = crypto.randomBytes(16).toString('hex');
  this.codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(this.codeVerifier)
    .digest('base64url');

  const authUrl =
    `${API.AUTHORIZE}?response_type=code&client_id=${clientId}` +
    `&scope=${encodeURIComponent(SCOPES.join(' '))}` +
    `&state=${this.stateGetAccessToken}` +
    `&code_challenge_method=S256&code_challenge=${codeChallenge}`;
  this.configured = true;
  return { authUrl, state: this.stateGetAccessToken };
}

module.exports = {
  connect,
};
