const { create } = require('./event-log.create');
const { get } = require('./event-log.get');
const { purge } = require('./event-log.purge');
const { listen } = require('./event-log.listen');

const EventLog = function EventLog(eventManager, stateManager) {
  this.eventManager = eventManager;
  this.stateManager = stateManager;
};

EventLog.prototype.create = create;
EventLog.prototype.get = get;
EventLog.prototype.purge = purge;
EventLog.prototype.listen = listen;

module.exports = EventLog;
