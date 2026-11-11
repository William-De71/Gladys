const logger = require('../../utils/logger');
const { USER_ROLE } = require('../../utils/constants');

/**
 * @description Forward websocket message to Gateway.
 * @param {object} event - Websocket event.
 * @example
 * forwardWebsockets({
 *   type: ''
 *   payload: {}
 * });
 */
async function forwardWebsockets(event) {
  if (!this.connected) {
    logger.debug('Gateway: not connected. Prevent forwarding event.');

    return;
  }

  logger.debug(`Gateway : Forward websocket message : ${event.type}`);
  try {
    if (event.userId) {
      await this.gladysGatewayClient.newEventInstanceUser(event.type, event.userId, event.payload);
    } else {
      await this.gladysGatewayClient.newEventInstance(event.type, event.payload);
    }
  } catch (e) {
    logger.debug('Unable to forward websocket to Gladys Gateway');
    logger.debug(e);
  }
}

/**
 * @description Forward a websocket message to the administrators only, through the Gateway.
 * @param {object} event - Websocket event.
 * @returns {Promise} Resolve when the message was forwarded.
 * @example
 * forwardWebsocketsToAdmins({
 *   type: ''
 *   payload: {}
 * });
 */
async function forwardWebsocketsToAdmins(event) {
  if (!this.connected) {
    return;
  }
  try {
    const admins = await this.user.getByRole(USER_ROLE.ADMIN);
    await Promise.all(
      admins.map((admin) => this.gladysGatewayClient.newEventInstanceUser(event.type, admin.id, event.payload)),
    );
  } catch (e) {
    logger.debug('Unable to forward websocket to Gladys Gateway');
    logger.debug(e);
  }
}

module.exports = {
  forwardWebsockets,
  forwardWebsocketsToAdmins,
};
