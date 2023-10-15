/**
 * @description Restart your freebox session.
 * @returns {Promise} Return request response.
 * @example
 * restartFreebox(sessionToken);
 */
async function restartFreebox() {

    this.sessionToken = await this.getSessionToken();
    
    return this.request({
        method: 'POST',
        baseURL: this.baseAPIURL,
        headers: {'X-Fbx-App-Auth': this.sessionToken},
        url: '/system/reboot/',
    });
}

module.exports = {
    restartFreebox,
  };