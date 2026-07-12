const { createDevice } = require('./thermostat.createDevice');
const { getDevices } = require('./thermostat.getDevices');
const { getSchedules } = require('./thermostat.getSchedules');
const { createSchedule } = require('./thermostat.createSchedule');
const { updateSchedule } = require('./thermostat.updateSchedule');
const { deleteSchedule } = require('./thermostat.deleteSchedule');
const { applySchedules } = require('./thermostat.applySchedules');
const { onDeviceNewState } = require('./thermostat.onWindowOpen');
const { setValue } = require('./thermostat.setValue');
const { setVariable, triggerApplySchedules } = require('./thermostat.setVariable');

const ThermostatHandler = function ThermostatHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
  this.applyTimer = null;
};

ThermostatHandler.prototype.createDevice = createDevice;
ThermostatHandler.prototype.getDevices = getDevices;
ThermostatHandler.prototype.getSchedules = getSchedules;
ThermostatHandler.prototype.createSchedule = createSchedule;
ThermostatHandler.prototype.updateSchedule = updateSchedule;
ThermostatHandler.prototype.deleteSchedule = deleteSchedule;
ThermostatHandler.prototype.applySchedules = applySchedules;
ThermostatHandler.prototype.onDeviceNewState = onDeviceNewState;
ThermostatHandler.prototype.setValue = setValue;
ThermostatHandler.prototype.setVariable = setVariable;
ThermostatHandler.prototype.triggerApplySchedules = triggerApplySchedules;

module.exports = ThermostatHandler;
