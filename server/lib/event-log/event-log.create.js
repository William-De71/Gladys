const db = require('../../models');
const logger = require('../../utils/logger');
const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../utils/constants');

/**
 * @description Create a new event log entry.
 * @param {string} type - The type of event (e.g. 'device.new-state', 'alarm.arm').
 * @param {string} message - A human-readable message describing the event.
 * @param {string} [icon] - An icon identifier (feather icon name).
 * @param {object} [data] - Optional additional data.
 * @returns {Promise<object>} The created event log.
 * @example
 * await eventLog.create('alarm.arm', 'Alarme armée', 'shield', { house: 'main-house' });
 */
async function create(type, message, icon = null, data = null) {
  logger.debug(`EventLog: Creating event of type ${type}`);
  const eventLogEntry = await db.EventLog.create({
    type,
    message,
    icon,
    data,
  });

  // send websocket event so the front updates in real-time
  this.eventManager.emit(EVENTS.WEBSOCKET.SEND_ALL, {
    type: WEBSOCKET_MESSAGE_TYPES.EVENT_LOG.NEW,
    payload: eventLogEntry.get({ plain: true }),
  });

  return eventLogEntry;
}

module.exports = {
  create,
};
