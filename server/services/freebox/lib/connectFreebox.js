const logger = require('../../../utils/logger');
const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../utils/constants');
const { FREEBOX_APPTOKEN_KEY,  TOKENREQUEST } = require('./utils/constants');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Connect to the Freebox.
 * @returns {Promise} Return Promise.
 * @example
 * connectFreebox();
 */
async function connectFreebox() {
    // Get the Freebox app token.
    const freeboxAppToken = await this.gladys.variable.getValue(FREEBOX_APPTOKEN_KEY, this.serviceId);
    
    // If the app token does not exist, request a new one from the Freebox.
    if (!freeboxAppToken) {
        try {
            const authorizationRequestResponse = await this.requestAuthorization(TOKENREQUEST);         

            // appToken = authorizationRequestResponse.data.result.app_token;
            // const trackId = authorizationRequestResponse.data.result.track_id;
            
            const { app_token: appToken, track_id: trackId } = authorizationRequestResponse.data.result;

            logger.debug(`app_token: ${appToken}, track_id: ${trackId}`);
            logger.info(`Please check your Freebox Server LCD screen and authorize application access to register your app.`);

            // Wait for the user to authorize the app.
            await this.getAuthorizationStatus(trackId);

            // Emit a websocket event to notify all clients that the Freebox is connected.
            this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
                type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.CONNECTED,
            });

            // Save the app token to the Gladys database.
            await this.gladys.variable.setValue(FREEBOX_APPTOKEN_KEY, appToken, this.serviceId);

            // Return the app token.
            return appToken;
            
        } catch (error) {
            // Emit a websocket event to notify all clients that there was an error connecting to the Freebox.
            this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
                type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.ERROR,
            });
            // Log the error message to the console.
            logger.error(`There was an error connecting to the freebox. Error: ${error.message}`);

            // Throw an exception to indicate that the Freebox service is not configured.
            throw new ServiceNotConfiguredError(`Freebox: Service is not connected with error ${error.message}`);
        }
    }

    // Return the app token.
    return freeboxAppToken;

}

module.exports = {
    connectFreebox,
};