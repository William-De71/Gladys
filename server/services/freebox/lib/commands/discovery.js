/**
 * @description Discover Freebox on the local network.
 * @returns {Promise} Return request response.
 * @example
 * discovery();
 */
async function discovery() {

    return this.request({
        method: 'GET',
        baseURL: this.baseURL,
        url: 'api_version',
    });
    
}

module.exports = {
    discovery,
  };