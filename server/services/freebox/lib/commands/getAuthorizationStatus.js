const logger = require('../../../../utils/logger');

/**
 * @description Get authorization status.
 * @param {string} trackId - The track id.
 * @returns {Promise} - Resolve when the freebox is connected.
 * @example
 * getAuthorizationStatus('45');
 */
async function getAuthorizationStatus(trackId) {

  return new Promise((resolve, reject) => {

    const checkTrackAuthorizationProgress = async () => {
      
      try {
        const response = await this.trackAuthorizationProgress(trackId);
        const { status } = response.data.result;
          
        if (status === 'granted') {    
          clearInterval(this.intervalTrackAuthorizationProgress);
          logger.info(`Access granted, Gladys is connected to the Freebox`);                                            
          resolve(status);
        } else if (status === 'pending') {
          logger.debug(`Authorization status: ${status}`);
        } else {
          clearInterval(this.intervalTrackAuthorizationProgress);
          reject(status);
        }
      } catch (e) {
        clearInterval(this.intervalTrackAuthorizationProgress);
        reject(e);
      }
    };

    // Every 2 seconds, sends the request to check the status
    this.intervalTrackAuthorizationProgress = setInterval(checkTrackAuthorizationProgress, 2000);

  });

}

module.exports = {
    getAuthorizationStatus,
};
