/**
 * @description Freebox request authorization.
 * @param {object} applicationIdentity - Freebox Identity.
 * @returns {Promise} Return request response.
 * @example
 * requestAuthorization(applicationIdentity);
 */
async function requestAuthorization(applicationIdentity) {

	// Require to be connected to local freebox URL
	return this.request({
		method: 'POST',
		baseURL: this.baseAPIURL,
		url: '/login/authorize/',
		data: applicationIdentity,
	});
}

module.exports = {
    requestAuthorization,
  };