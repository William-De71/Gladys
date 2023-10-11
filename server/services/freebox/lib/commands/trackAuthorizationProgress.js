/**
 * @description Freebox request authorization.
 * @param {string} trackId - Freebox track_id.
 * @returns {Promise} Return request response.
 * @example
 * trackAuthorizationProgress(trackId);
 */
async function trackAuthorizationProgress(trackId) {
  return this.request({
    method: 'GET',
    baseURL: this.baseAPIURL,
    url: `/login/authorize/${trackId}`,
  });
}

module.exports = {
  trackAuthorizationProgress,
  };