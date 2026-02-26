const { createDevice } = require('./thermostat.createDevice');
const { getDevices } = require('./thermostat.getDevices');

const ThermostatHandler = function ThermostatHandler(gladys, serviceId) {
  this.gladys = gladys;
  this.serviceId = serviceId;
};

ThermostatHandler.prototype.createDevice = createDevice;
ThermostatHandler.prototype.getDevices = getDevices;

module.exports = ThermostatHandler;
