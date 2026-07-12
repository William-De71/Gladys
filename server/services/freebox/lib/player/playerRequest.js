/**
 * @description Send an authenticated request to the Freebox API,
 * refreshing the session token and retrying once if it has expired.
 * @this {any}
 * @param {object} options - Axios request options (method, url, data...).
 * @returns {Promise} Request response.
 * @example
 * await playerRequest({ method: 'GET', url: '/player' });
 */
async function playerRequest(options) {
  // Ensure Freebox has been discovered (baseAPIURL is set)
  if (!this.baseAPIURL) {
    await this.discoverFreebox();
  }

  // Token is null, we need to get a session token to login
  if (this.sessionToken === null) {
    this.sessionToken = await this.getSessionToken();
  }

  const buildConfig = () => ({
    baseURL: this.baseAPIURL,
    headers: { 'X-Fbx-App-Auth': this.sessionToken },
    ...options,
  });

  try {
    return await this.request(buildConfig());
  } catch (error) {
    if (!error.response) {
      throw error;
    }

    const { status, data } = error.response;
    const { error_code: errorCode } = data;
    const isTokenExpired = status === 403 && errorCode === 'auth_required';

    if (!isTokenExpired) {
      throw error;
    }

    // Token has expired, we need to login and retry
    this.sessionToken = await this.getSessionToken();
    return this.request(buildConfig());
  }
}

module.exports = {
  playerRequest,
};
