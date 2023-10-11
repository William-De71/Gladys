const logger = require('../../../utils/logger');
const { WEBSOCKET_MESSAGE_TYPES, EVENTS } = require('../../../utils/constants');
const { FREEBOX_APPTOKEN_KEY,  TOKENREQUEST } = require('./utils/constants');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Connect to the Freebox.
 * @returns {Promise} Return Promise.
 * @example
 * connectFreebox();
 */
async function connectFreebox() {
    let appToken = await this.gladys.variable.getValue(FREEBOX_APPTOKEN_KEY, this.serviceId);
    
    if (!appToken){
        // Obtaining an app_token / track_id
        try {
            const authorizationRequestResponse = await this.requestAuthorization(TOKENREQUEST);         

            appToken = authorizationRequestResponse.data.result.app_token;
            const trackId = authorizationRequestResponse.data.result.track_id;

            logger.debug(`app_token: ${appToken}, track_id: ${trackId}`);
            logger.info(`Please check your Freebox Server LCD screen and authorize application access to register your app.`);

            await this.getAuthorizationStatus(trackId);

            this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
                type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.CONNECTED,
            });

            await this.gladys.variable.setValue(FREEBOX_APPTOKEN_KEY, appToken, this.serviceId);
            
        } catch (e) {
            this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
                type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.ERROR,
            });
            logger.error(`There was an error connecting to the freebox. Error: ${e}`);
            throw new ServiceNotConfiguredError(`Freebox: Service is not connected with error ${e}`);
        }
    }

    logger.debug(`app_token: ${appToken}`);

    return appToken;

}

module.exports = {
    connectFreebox,
};