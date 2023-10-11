/**
 * @description Open session.
 * @param {object} sessionStart - Freebox session data.
 * @returns {Promise} Return request response.
 * @example
 * openSession(sessionStart);
 */
async function openSession(sessionStart) {

    return this.request({
        method: 'POST',
        baseURL: this.baseAPIURL,
        url: '/login/session/',
        data: sessionStart,
    });
    
}

module.exports = {
    openSession,
  };