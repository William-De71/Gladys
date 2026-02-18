const logger = require('../../utils/logger');
const { EVENTS, WEBSOCKET_MESSAGE_TYPES } = require('../../utils/constants');

// Map event types to feather icon names
const EVENT_ICON_MAP = {
  [EVENTS.ALARM.ARM]: 'shield',
  [EVENTS.ALARM.ARMING]: 'shield',
  [EVENTS.ALARM.DISARM]: 'shield-off',
  [EVENTS.ALARM.PARTIAL_ARM]: 'shield',
  [EVENTS.ALARM.PANIC]: 'alert-triangle',
  [EVENTS.HOUSE_ALARM.ARMED]: 'lock',
  [EVENTS.HOUSE_ALARM.DISARMED]: 'unlock',
  [EVENTS.HOUSE_ALARM.TRIGGERED]: 'alert-octagon',
  [EVENTS.HOUSE_ALARM.TRIGGERED_STOPPED]: 'bell-off',
  [EVENTS.USER_PRESENCE.LEFT_HOME]: 'log-out',
  [EVENTS.USER_PRESENCE.BACK_HOME]: 'log-in',
  [EVENTS.DEVICE.NEW_STATE]: 'activity',
  [EVENTS.LIGHT.TURNED_ON]: 'sun',
  [EVENTS.LIGHT.TURNED_OFF]: 'moon',
  [EVENTS.SUN.SUNRISE]: 'sunrise',
  [EVENTS.SUN.SUNSET]: 'sunset',
  [EVENTS.SCENE.TRIGGERED]: 'play',
  [EVENTS.SCENE.SUCCEEDED]: 'check-circle',
  [EVENTS.SCENE.FAILED]: 'x-circle',
  [EVENTS.SYSTEM.START]: 'power',
};

// Map event types to i18n message keys (resolved on the front-end)
const EVENT_MESSAGE_KEY_MAP = {
  [EVENTS.ALARM.ARM]: 'eventLog.events.alarmArm',
  [EVENTS.ALARM.ARMING]: 'eventLog.events.alarmArming',
  [EVENTS.ALARM.DISARM]: 'eventLog.events.alarmDisarm',
  [EVENTS.ALARM.PARTIAL_ARM]: 'eventLog.events.alarmPartialArm',
  [EVENTS.ALARM.PANIC]: 'eventLog.events.alarmPanic',
  [EVENTS.HOUSE_ALARM.ARMED]: 'eventLog.events.houseArmed',
  [EVENTS.HOUSE_ALARM.DISARMED]: 'eventLog.events.houseDisarmed',
  [EVENTS.HOUSE_ALARM.TRIGGERED]: 'eventLog.events.houseTriggered',
  [EVENTS.HOUSE_ALARM.TRIGGERED_STOPPED]: 'eventLog.events.houseTriggeredStopped',
  [EVENTS.USER_PRESENCE.LEFT_HOME]: 'eventLog.events.userLeftHome',
  [EVENTS.USER_PRESENCE.BACK_HOME]: 'eventLog.events.userBackHome',
  [EVENTS.DEVICE.NEW_STATE]: 'eventLog.events.deviceNewState',
  [EVENTS.LIGHT.TURNED_ON]: 'eventLog.events.lightTurnedOn',
  [EVENTS.LIGHT.TURNED_OFF]: 'eventLog.events.lightTurnedOff',
  [EVENTS.SUN.SUNRISE]: 'eventLog.events.sunrise',
  [EVENTS.SUN.SUNSET]: 'eventLog.events.sunset',
  [EVENTS.SCENE.TRIGGERED]: 'eventLog.events.sceneTriggered',
  [EVENTS.SCENE.SUCCEEDED]: 'eventLog.events.sceneSucceeded',
  [EVENTS.SCENE.FAILED]: 'eventLog.events.sceneFailed',
  [EVENTS.SYSTEM.START]: 'eventLog.events.systemStart',
};

// Event types that are emitted via EVENTS.TRIGGERS.CHECK (with data.type)
const TRIGGER_CHECK_TYPES = [
  EVENTS.ALARM.ARM,
  EVENTS.ALARM.ARMING,
  EVENTS.ALARM.DISARM,
  EVENTS.ALARM.PARTIAL_ARM,
  EVENTS.ALARM.PANIC,
  EVENTS.HOUSE_ALARM.ARMED,
  EVENTS.HOUSE_ALARM.DISARMED,
  EVENTS.HOUSE_ALARM.TRIGGERED,
  EVENTS.HOUSE_ALARM.TRIGGERED_STOPPED,
  EVENTS.USER_PRESENCE.LEFT_HOME,
  EVENTS.USER_PRESENCE.BACK_HOME,
  EVENTS.DEVICE.NEW_STATE,
  EVENTS.SYSTEM.START,
];

// Event types that are emitted directly on the event bus
const DIRECT_EVENT_TYPES = [
  EVENTS.LIGHT.TURNED_ON,
  EVENTS.LIGHT.TURNED_OFF,
  EVENTS.SUN.SUNRISE,
  EVENTS.SUN.SUNSET,
];

// Websocket error types to capture as service errors
const SERVICE_ERROR_TYPES = [
  WEBSOCKET_MESSAGE_TYPES.MQTT.ERROR,
  WEBSOCKET_MESSAGE_TYPES.ZWAVEJS_UI.ERROR,
  WEBSOCKET_MESSAGE_TYPES.EWELINK.ERROR,
  WEBSOCKET_MESSAGE_TYPES.NUKI.ERROR,
];

/**
 * @description Log an event from its type and data.
 * @param {string} eventType - The event type.
 * @param {object} data - The event data.
 * @returns {Promise} Resolve when done.
 * @example
 * await logEvent.call(this, 'alarm.arm', { house: 'main' });
 */
async function logEvent(eventType, data) {
  const icon = EVENT_ICON_MAP[eventType] || 'info';
  const messageKey = EVENT_MESSAGE_KEY_MAP[eventType] || eventType;
  await this.create(eventType, messageKey, icon, data || null);
}

/**
 * @description Enrich device event data with device name and room name from stateManager.
 * @param {object} stateManager - The state manager instance.
 * @param {object} data - The trigger data containing device_feature selector.
 * @returns {object} Enriched data with device_name and room_name.
 * @example
 * const enriched = enrichDeviceData(stateManager, { device_feature: 'my-sensor' });
 */
function enrichDeviceData(stateManager, data) {
  const enriched = { ...data };
  try {
    if (data.device_feature) {
      const feature = stateManager.get('deviceFeature', data.device_feature);
      if (feature) {
        if (feature.unit) {
          enriched.unit = feature.unit;
        }
        if (feature.category) {
          enriched.feature_category = feature.category;
        }
        if (feature.type) {
          enriched.feature_type = feature.type;
        }
        if (feature.device_id) {
          const device = stateManager.get('deviceById', feature.device_id);
          if (device) {
            enriched.device_name = device.name || device.selector;
            if (device.room && device.room.name) {
              enriched.room_name = device.room.name;
            }
          }
        }
      }
    }
  } catch (e) {
    logger.debug(`EventLog: Could not enrich device data: ${e.message}`);
  }
  return enriched;
}

/**
 * @description Start listening to events and create log entries.
 * @example
 * eventLog.listen();
 */
function listen() {
  // Listen to direct events (light, sun)
  DIRECT_EVENT_TYPES.forEach((eventType) => {
    this.eventManager.on(eventType, async (data) => {
      try {
        await logEvent.call(this, eventType, data || null);
      } catch (e) {
        logger.warn(`EventLog: Failed to log event ${eventType}: ${e.message}`);
      }
    });
  });

  // Listen to trigger.check events (alarm, presence, device, scene, system)
  this.eventManager.on(EVENTS.TRIGGERS.CHECK, async (data) => {
    try {
      if (!data || !data.type) {
        return;
      }

      // Only log event types we care about
      if (!TRIGGER_CHECK_TYPES.includes(data.type)) {
        return;
      }

      // For device state changes, only log if value actually changed
      if (data.type === EVENTS.DEVICE.NEW_STATE) {
        if (data.previous_value === data.last_value) {
          return;
        }
        // Enrich with device name and room
        const enrichedData = enrichDeviceData(this.stateManager, data);
        await logEvent.call(this, data.type, enrichedData);
        return;
      }

      await logEvent.call(this, data.type, data);
    } catch (e) {
      logger.warn(`EventLog: Failed to log trigger event: ${e.message}`);
    }
  });

  // Listen to scene events (emitted directly)
  this.eventManager.on(EVENTS.SCENE.TRIGGERED, async (sceneSelector) => {
    try {
      await logEvent.call(this, EVENTS.SCENE.TRIGGERED, {
        scene_selector: sceneSelector,
      });
    } catch (e) {
      logger.warn(`EventLog: Failed to log scene triggered: ${e.message}`);
    }
  });

  // Listen to websocket sends to capture service errors
  this.eventManager.on(EVENTS.WEBSOCKET.SEND_ALL, async (wsEvent) => {
    try {
      if (!wsEvent || !wsEvent.type) {
        return;
      }
      if (!SERVICE_ERROR_TYPES.includes(wsEvent.type)) {
        return;
      }
      // Extract service name from type (e.g. "mqtt.error" -> "mqtt")
      const serviceName = wsEvent.type.split('.')[0];
      await this.create(
        `service.error`,
        'eventLog.events.serviceError',
        'alert-circle',
        { service: serviceName, error: wsEvent.payload ? String(wsEvent.payload) : null },
      );
    } catch (e) {
      logger.warn(`EventLog: Failed to log service error: ${e.message}`);
    }
  });

  logger.info('EventLog: Listening for events');
}

module.exports = {
  listen,
};
