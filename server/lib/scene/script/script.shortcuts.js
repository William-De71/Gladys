const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

const { ACTIONS, ALARM_MODES_LIST } = require('../../../utils/constants');
const { NotFoundError } = require('../../../utils/coreErrors');

dayjs.extend(utc);
dayjs.extend(timezone);

// The shortcuts of the scripting API (docs/specs/scene-editor-modes.md D.3): what a script does
// most often, without having to know the type and the parameters of a block. Those that change
// something run the action of the matching block, so they behave exactly like it.

// A variable kept by `gladys.variable` lives in the variables of Gladys, under this prefix.
const VARIABLE_PREFIX = 'SCENE_VARIABLE_';
const VARIABLE_NAME_REGEX = /^[A-Za-z0-9_]{1,60}$/;
const VARIABLE_MAX_LENGTH = 10000;
const HTTP_METHODS = ['get', 'post', 'patch', 'put', 'delete'];
const BLINK_SPEEDS = ['slow', 'medium', 'fast'];
const SUN_TIMES = ['dawn', 'sunrise', 'solar_noon', 'sunset', 'dusk'];

/**
 * @description Read a list of selectors given as one selector or as a list.
 * @param {any} selectors - A selector, or a list of selectors.
 * @param {string} label - What the selectors are, for the error.
 * @returns {Array<string>} The selectors.
 * @example
 * toSelectors('living-room-lamp', 'devices'); // ['living-room-lamp']
 */
function toSelectors(selectors, label) {
  const list = Array.isArray(selectors) ? selectors : [selectors];
  if (list.length === 0 || list.some((selector) => typeof selector !== 'string' || selector === '')) {
    throw new Error(`"${label}" must be a selector or a list of selectors`);
  }
  return list;
}

/**
 * @description Describe a device feature for a script.
 * @param {object} feature - The device feature, as kept in memory.
 * @param {object} device - Its device, when known.
 * @returns {object} The description.
 * @example
 * describeFeature(feature, device);
 */
function describeFeature(feature, device) {
  return {
    selector: feature.selector,
    name: feature.name === undefined ? null : feature.name,
    category: feature.category,
    type: feature.type,
    unit: feature.unit === undefined ? null : feature.unit,
    last_value: feature.last_value === undefined ? null : feature.last_value,
    device: device ? device.selector : null,
    room: device && device.room ? device.room.selector : null,
  };
}

/**
 * @description Build the shortcuts of the scripting API for one execution.
 * @param {object} options - Options.
 * @param {object} options.self - The SceneManager.
 * @param {Function} options.runAction - Runs an action of the scene editor: `(type, params)`.
 * @returns {object} The host methods, by name.
 * @example
 * buildScriptShortcuts({ self, runAction });
 */
function buildScriptShortcuts({ self, runAction }) {
  const onDevices = (type) => async (devices) => {
    await runAction(type, { devices: toSelectors(devices, 'devices') });
    return null;
  };

  // A house may be left out when Gladys has a single one
  const resolveHouse = async (selector) => {
    if (selector !== undefined && selector !== null) {
      if (typeof selector !== 'string') {
        throw new Error('"house" must be the selector of a house');
      }
      return selector;
    }
    const houses = await self.house.get();
    if (houses.length !== 1) {
      throw new Error(`Gladys has ${houses.length} houses: give the selector of the house`);
    }
    return houses[0].selector;
  };

  const variableKey = (name) => {
    if (typeof name !== 'string' || !VARIABLE_NAME_REGEX.test(name)) {
      throw new Error(`Invalid variable name "${name}": 1 to 60 letters, digits or "_"`);
    }
    // the variables of Gladys have upper case names: "total" and "TOTAL" are the same variable
    return `${VARIABLE_PREFIX}${name.toUpperCase()}`;
  };

  const httpRequest = async (method, url, options) => {
    const { body, headers } = options || {};
    if (typeof method !== 'string' || !HTTP_METHODS.includes(method.toLowerCase())) {
      throw new Error(`Unknown HTTP method "${method}": ${HTTP_METHODS.join(', ')}`);
    }
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error('The URL of a request must start with http:// or https://');
    }
    if (headers !== undefined && headers !== null) {
      if (typeof headers !== 'object' || Object.values(headers).some((value) => typeof value !== 'string')) {
        throw new Error('The headers of a request must be an object of texts');
      }
    }
    const response = await self.http.request(
      method.toLowerCase(),
      url,
      body === null ? undefined : body,
      headers || undefined,
    );
    return {
      status: response.status,
      data: response.data === undefined ? null : response.data,
      headers: response.headers,
    };
  };

  return {
    'light.turnOn': onDevices(ACTIONS.LIGHT.TURN_ON),
    'light.turnOff': onDevices(ACTIONS.LIGHT.TURN_OFF),
    'light.toggle': onDevices(ACTIONS.LIGHT.TOGGLE),
    'light.blink': async (devices, speed, seconds) => {
      const blinkingSpeed = speed === undefined || speed === null ? 'fast' : speed;
      const blinkingTime = seconds === undefined || seconds === null ? 5 : seconds;
      if (!BLINK_SPEEDS.includes(blinkingSpeed)) {
        throw new Error(`Unknown blinking speed "${blinkingSpeed}": ${BLINK_SPEEDS.join(', ')}`);
      }
      if (typeof blinkingTime !== 'number' || !(blinkingTime > 0)) {
        throw new Error('The blinking time is a number of seconds');
      }
      await runAction(ACTIONS.LIGHT.BLINK, {
        devices: toSelectors(devices, 'devices'),
        blinking_speed: blinkingSpeed,
        blinking_time: blinkingTime,
      });
      return null;
    },
    'switch.turnOn': onDevices(ACTIONS.SWITCH.TURN_ON),
    'switch.turnOff': onDevices(ACTIONS.SWITCH.TURN_OFF),
    'switch.toggle': onDevices(ACTIONS.SWITCH.TOGGLE),

    // values kept from an execution to the next, and shared by every script
    'variable.get': async (name) => {
      const value = await self.variable.getValue(variableKey(name));
      return value === null ? null : JSON.parse(value);
    },
    'variable.set': async (name, value) => {
      const key = variableKey(name);
      const json = JSON.stringify(value === undefined ? null : value);
      if (json.length > VARIABLE_MAX_LENGTH) {
        throw new Error(`The value of a variable takes at most ${VARIABLE_MAX_LENGTH} characters as JSON`);
      }
      await self.variable.setValue(key, json);
      return null;
    },
    'variable.remove': async (name) => {
      await self.variable.destroy(variableKey(name));
      return null;
    },

    'house.isEmpty': async (house) => self.house.isEmpty(await resolveHouse(house)),
    'house.getUsersAtHome': async (house) => {
      const users = await self.house.getUsersAtHome(await resolveHouse(house));
      return users.map((user) => user.selector);
    },
    'house.getAlarmMode': async (house) => {
      const { alarm_mode: alarmMode } = await self.house.getBySelector(await resolveHouse(house));
      return alarmMode;
    },
    'house.setAlarmMode': async (mode, house) => {
      if (!ALARM_MODES_LIST.includes(mode)) {
        throw new Error(`Unknown alarm mode "${mode}": ${ALARM_MODES_LIST.join(', ')}`);
      }
      await runAction(ACTIONS.ALARM.SET_ALARM_MODE, { house: await resolveHouse(house), alarm_mode: mode });
      return null;
    },
    'house.getSun': async (house) => {
      const houseWithLocation = await self.house.getBySelector(await resolveHouse(house));
      if (typeof houseWithLocation.latitude !== 'number' || typeof houseWithLocation.longitude !== 'number') {
        throw new Error(`The house "${houseWithLocation.selector}" has no location: set it in the house settings`);
      }
      const now = new Date();
      const sun = await self.house.getSunState(houseWithLocation, now);
      const times = {};
      SUN_TIMES.forEach((name) => {
        times[name] = sun[name] ? sun[name].toISOString() : null;
      });
      return {
        ...times,
        elevation: sun.elevation,
        azimuth: sun.azimuth,
        is_day: Boolean(sun.sunrise && sun.sunset && now >= sun.sunrise && now < sun.sunset),
      };
    },
    'user.setAtHome': async (user, house) => {
      await runAction(ACTIONS.USER.SET_SEEN_AT_HOME, { user, house: await resolveHouse(house) });
      return null;
    },
    'user.setAway': async (user, house) => {
      await runAction(ACTIONS.USER.SET_OUT_OF_HOME, { user, house: await resolveHouse(house) });
      return null;
    },

    'device.get': async (selector) => {
      const device = self.stateManager.get('device', selector);
      if (!device) {
        throw new NotFoundError(`Device "${selector}" not found`);
      }
      return {
        selector: device.selector,
        name: device.name,
        room: device.room ? device.room.selector : null,
        features: (device.features || []).map((feature) => describeFeature(feature, device)),
      };
    },
    'device.list': async (filter) => {
      const { room, category, type } = filter || {};
      return self.stateManager
        .getAllKeys('deviceFeature')
        .map((selector) => {
          const feature = self.stateManager.get('deviceFeature', selector);
          return describeFeature(feature, self.stateManager.get('deviceById', feature.device_id));
        })
        .filter(
          (feature) =>
            (room === undefined || room === null || feature.room === room) &&
            (category === undefined || category === null || feature.category === category) &&
            (type === undefined || type === null || feature.type === type),
        );
    },

    'http.request': httpRequest,
    'http.get': (url, options) => httpRequest('get', url, options),
    'http.post': (url, body, options) => httpRequest('post', url, { ...(options || {}), body }),

    // the local time of the instance: the sandbox has no time zone of its own
    'time.now': async () => {
      const now = dayjs.tz(dayjs(), self.timezone);
      return {
        iso: now.toISOString(),
        date: now.format('YYYY-MM-DD'),
        time: now.format('HH:mm'),
        hour: now.hour(),
        minute: now.minute(),
        second: now.second(),
        // 1 is Monday, 7 is Sunday
        day_of_week: now.day() === 0 ? 7 : now.day(),
        timestamp: now.valueOf(),
        timezone: self.timezone,
      };
    },

    'music.say': async (device, text, volume) => {
      const params = { device, text };
      if (volume !== undefined && volume !== null) {
        params.volume = volume;
      }
      await runAction(ACTIONS.MUSIC.PLAY_NOTIFICATION, params);
      return null;
    },
  };
}

module.exports = {
  buildScriptShortcuts,
  VARIABLE_PREFIX,
};
