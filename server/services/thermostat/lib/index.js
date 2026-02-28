const { createDevice } = require('./thermostat.createDevice');
const { getDevices } = require('./thermostat.getDevices');
const { getSchedules } = require('./thermostat.getSchedules');
const { createSchedule } = require('./thermostat.createSchedule');
const { updateSchedule } = require('./thermostat.updateSchedule');
const { deleteSchedule } = require('./thermostat.deleteSchedule');
const { applySchedules } = require('./thermostat.applySchedules');
const { setValue } = require('./thermostat.setValue');

const ThermostatHandler = function ThermostatHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
};

ThermostatHandler.prototype.createDevice = createDevice;
ThermostatHandler.prototype.getDevices = getDevices;
ThermostatHandler.prototype.getSchedules = getSchedules;
ThermostatHandler.prototype.createSchedule = createSchedule;
ThermostatHandler.prototype.updateSchedule = updateSchedule;
ThermostatHandler.prototype.deleteSchedule = deleteSchedule;
ThermostatHandler.prototype.applySchedules = applySchedules;
ThermostatHandler.prototype.setValue = setValue;

module.exports = ThermostatHandler;
