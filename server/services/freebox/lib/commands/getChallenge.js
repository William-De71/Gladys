/**
 * @description Get challenge value.
 * @returns {Promise} Return request response.
 * @example
 * getChallenge();
 */
async function getChallenge() {

    return this.request({
        method: 'GET',
        baseURL: this.baseAPIURL,
        url: '/login/',
    });
    
}

module.exports = {
    getChallenge,
  };