/**
 * @description Close session.
 * @param {string} sessionToken - Freebox Session token.
 * @returns {Promise} Return request response.
 * @example
 * closeSession(sessionToken);
 */
async function closeSession(sessionToken) {

    return this.request({
        method: 'POST',
        baseURL: this.baseAPIURL,
        headers: {'X-Fbx-App-Auth': sessionToken},
        url: '/login/logout/',
    });
    
}

module.exports = {
    closeSession,
  };