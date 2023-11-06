const crypto = require('crypto');
const logger = require('../../../utils/logger');
const { WEBSOCKET_MESSAGE_TYPES, EVENTS } = require('../../../utils/constants');
const { FREEBOX_APPTOKEN_KEY, TOKENREQUEST } = require('./utils/constants');
const { ServiceNotConfiguredError } = require('../../../utils/coreErrors');

/**
 * @description Get a session token.
 * @returns {Promise} Return Promise.
 * @example
 * getSessionToken();
 */
async function getSessionToken() {

    const appToken = await this.gladys.variable.getValue(FREEBOX_APPTOKEN_KEY, this.serviceId);
    
    if (!appToken) {
        throw new ServiceNotConfiguredError(`Freebox is not connected`);
    }

    // check and get challenge.
    let challengeResponse = null;
    let sessionResponse = null;
    try {
        challengeResponse = await this.getChallenge();
        const { challenge } = challengeResponse.data.result;
        
        // generate password
        const password = crypto.createHmac('sha1', appToken).update(challenge).digest('hex');

        // open session and get session token.
        const sessionStart = {
            app_id : TOKENREQUEST.app_id,
            password
        };

        sessionResponse = await this.openSession(sessionStart);
        const { session_token: sessionToken, permissions } = sessionResponse.data.result;

        const { settings, camera, home } = permissions;
        if (!settings || !camera || !home) {
            throw new ServiceNotConfiguredError('Freebox: Your app permissions does not allow accessing this API');
        }

        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
            type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.CONNECTED,
        });

        return sessionToken;
        
    } catch (e) {
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
            type: WEBSOCKET_MESSAGE_TYPES.FREEBOX.ERROR,
        });
        logger.error(`There was an error connecting to the freebox. ${e}`);
        throw new ServiceNotConfiguredError(`Freebox: Service is not connected with error ${e}`);
    }
   
}

module.exports = {
    getSessionToken,
};