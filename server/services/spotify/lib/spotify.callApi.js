const { fetch } = require('undici');

const logger = require('../../../utils/logger');
const { BadParameters, NotFoundError } = require('../../../utils/coreErrors');

/**
 * @description Call the Spotify Web API with a valid access token.
 * @param {string} method - HTTP method.
 * @param {string} url - Full URL to call.
 * @param {object} [body] - Optional JSON body.
 * @returns {Promise<object|null>} Parsed JSON response, or null if the response is empty.
 * @example
 * await spotify.callApi('GET', 'https://api.spotify.com/v1/me/player/devices');
 */
async function callApi(method, url, body = undefined) {
  const accessToken = await this.getAccessToken();
  /** @type {any} */
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  let response = await fetch(url, options);
  if (response.status === 401) {
    // Access token rejected: refresh it once and retry
    await this.refreshingTokens();
    options.headers.Authorization = `Bearer ${this.accessToken}`;
    response = await fetch(url, options);
  }
  const rawBody = await response.text();
  if (!response.ok) {
    if (response.status === 403 && rawBody.includes('PREMIUM_REQUIRED')) {
      throw new BadParameters('SPOTIFY: A Spotify Premium account is required to control playback');
    }
    if (response.status === 403) {
      // Player restriction (redundant command like play while already playing, volume
      // not supported on this device...): harmless, treat as a no-op
      logger.debug(`Spotify API restriction on ${method} ${url}, ignoring: `, rawBody);
      return null;
    }
    if (response.status === 404) {
      throw new NotFoundError('SPOTIFY: Device not found or inactive');
    }
    logger.error(`Spotify API error on ${method} ${url}: `, response.status, rawBody);
    throw new Error(`SPOTIFY: HTTP error ${response.status} - ${rawBody}`);
  }
  return rawBody ? JSON.parse(rawBody) : null;
}

module.exports = {
  callApi,
};
