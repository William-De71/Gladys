const { WEBSOCKET_MESSAGE_TYPES, EVENTS } = require('../../../utils/constants');
const logger = require('../../../utils/logger');
const { STATUS } = require('./utils/spotify.constants');

/**
 * @description Save and broadcast the Spotify service status.
 * @param {object} status - New status.
 * @returns {boolean} True if the status is well saved.
 * @example
 * spotify.saveStatus({ statusType: 'connecting', message: null });
 */
function saveStatus(status) {
  try {
    switch (status.statusType) {
      case STATUS.ERROR.CONNECTING:
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
          type: WEBSOCKET_MESSAGE_TYPES.SPOTIFY.ERROR.CONNECTING,
          payload: { statusType: STATUS.CONNECTING, status: status.message },
        });
        break;
      case STATUS.ERROR.PROCESSING_TOKEN:
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
          type: WEBSOCKET_MESSAGE_TYPES.SPOTIFY.ERROR.PROCESSING_TOKEN,
          payload: { statusType: STATUS.PROCESSING_TOKEN, status: status.message },
        });
        break;
      case STATUS.NOT_INITIALIZED:
        this.configured = false;
        this.status = STATUS.NOT_INITIALIZED;
        this.connected = false;
        this.stopPollPlaybackState();
        break;
      case STATUS.CONNECTING:
        this.configured = true;
        this.status = STATUS.CONNECTING;
        this.connected = false;
        break;
      case STATUS.PROCESSING_TOKEN:
        this.configured = true;
        this.status = STATUS.PROCESSING_TOKEN;
        this.connected = false;
        break;
      case STATUS.CONNECTED:
        this.configured = true;
        this.status = STATUS.CONNECTED;
        this.connected = true;
        break;
      case STATUS.DISCONNECTED:
        this.status = STATUS.DISCONNECTED;
        this.connected = false;
        this.stopPollPlaybackState();
        break;
      default:
        break;
    }
    this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.SPOTIFY.STATUS,
      payload: { status: this.status },
    });
    return true;
  } catch (e) {
    logger.error('Spotify status save errored', e);
    return false;
  }
}

module.exports = {
  saveStatus,
};
