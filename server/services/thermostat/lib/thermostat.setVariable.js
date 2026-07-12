const logger = require('../../../utils/logger');
const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../../utils/constants');

const APPLY_DEBOUNCE_MS = 2000;

/**
 * @description Set a thermostat-related variable, broadcast the matching websocket
 * message so every open dashboard refreshes, and schedule a debounced regulation pass.
 * @param {string} variableKey - Variable key, must start with THERMOSTAT_.
 * @param {string} value - Variable value.
 * @returns {Promise<object>} The saved variable.
 * @example
 * await thermostatHandler.setVariable('THERMOSTAT_MY_DEVICE_PRESET', 'comfort');
 */
async function setVariable(variableKey, value) {
  if (!variableKey || !variableKey.startsWith('THERMOSTAT_')) {
    throw new Error(`Invalid thermostat variable key: ${variableKey}`);
  }
  const variable = await this.gladys.variable.setValue(variableKey, value);

  let messageType = null;
  if (variableKey.startsWith('THERMOSTAT_CONFIG_')) {
    messageType = WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.CONFIG_UPDATED;
  } else if (variableKey.endsWith('_PRESET')) {
    messageType = WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.PRESET_UPDATED;
  } else if (variableKey.endsWith('_MANUAL_MODE')) {
    messageType = WEBSOCKET_MESSAGE_TYPES.THERMOSTAT.MANUAL_MODE_UPDATED;
  }
  if (messageType) {
    this.gladys.event.emit(EVENTS.WEBSOCKET.SEND_ALL, {
      type: messageType,
      payload: { key: variableKey, value },
    });
  }

  this.triggerApplySchedules();
  return variable;
}

/**
 * @description Schedule a debounced applySchedules run, so a burst of variable
 * writes (preset + manual mode + manual setpoint) triggers a single regulation
 * pass a couple of seconds later instead of waiting for the next minute tick.
 * @returns {undefined}
 * @example
 * thermostatHandler.triggerApplySchedules();
 */
function triggerApplySchedules() {
  const handler = this;
  if (handler.applyTimer) {
    clearTimeout(handler.applyTimer);
  }
  handler.applyTimer = setTimeout(async () => {
    handler.applyTimer = null;
    try {
      // @ts-ignore — handler is the ThermostatHandler instance, applySchedules is on its prototype
      await handler.applySchedules();
    } catch (e) {
      logger.warn(`Thermostat: debounced applySchedules failed: ${e.message}`);
    }
  }, APPLY_DEBOUNCE_MS);
}

module.exports = { setVariable, triggerApplySchedules };
