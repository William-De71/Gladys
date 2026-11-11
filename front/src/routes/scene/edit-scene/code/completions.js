// What the script editor suggests while typing (docs/specs/scene-editor-modes.md D.8): the
// scripting API of D.3, and the real selectors of the instance where the API takes one.
//
// Pure functions, unit-tested with `npm run test-unit` (completions.test.js).

const MEMBERS = {
  gladys: [
    { label: 'device', type: 'namespace' },
    { label: 'light', type: 'namespace' },
    { label: 'switch', type: 'namespace' },
    { label: 'scene', type: 'namespace' },
    { label: 'message', type: 'namespace' },
    { label: 'music', type: 'namespace' },
    { label: 'variable', type: 'namespace' },
    { label: 'house', type: 'namespace' },
    { label: 'user', type: 'namespace' },
    { label: 'time', type: 'namespace' },
    { label: 'http', type: 'namespace' },
    { label: 'action', type: 'function', detail: '(type, params, { saveAs })' },
    { label: 'check', type: 'function', detail: '(type, params)' },
    { label: 'store', type: 'function', detail: '(name, value)' }
  ],
  'gladys.device': [
    { label: 'getValue', type: 'function', detail: '(feature)' },
    { label: 'getFeature', type: 'function', detail: '(feature)' },
    { label: 'setValue', type: 'function', detail: '(feature, value)' },
    { label: 'get', type: 'function', detail: '(device)' },
    { label: 'list', type: 'function', detail: '({ room, category, type })' }
  ],
  'gladys.light': [
    { label: 'turnOn', type: 'function', detail: '(devices)' },
    { label: 'turnOff', type: 'function', detail: '(devices)' },
    { label: 'toggle', type: 'function', detail: '(devices)' },
    { label: 'blink', type: 'function', detail: '(devices, speed, seconds)' }
  ],
  'gladys.switch': [
    { label: 'turnOn', type: 'function', detail: '(devices)' },
    { label: 'turnOff', type: 'function', detail: '(devices)' },
    { label: 'toggle', type: 'function', detail: '(devices)' }
  ],
  'gladys.variable': [
    { label: 'get', type: 'function', detail: '(name)' },
    { label: 'set', type: 'function', detail: '(name, value)' },
    { label: 'remove', type: 'function', detail: '(name)' }
  ],
  'gladys.house': [
    { label: 'isEmpty', type: 'function', detail: '(house)' },
    { label: 'getUsersAtHome', type: 'function', detail: '(house)' },
    { label: 'getAlarmMode', type: 'function', detail: '(house)' },
    { label: 'setAlarmMode', type: 'function', detail: '(mode, house)' },
    { label: 'getSun', type: 'function', detail: '(house)' }
  ],
  'gladys.user': [
    { label: 'setAtHome', type: 'function', detail: '(user, house)' },
    { label: 'setAway', type: 'function', detail: '(user, house)' }
  ],
  'gladys.time': [{ label: 'now', type: 'function', detail: '()' }],
  'gladys.http': [
    { label: 'get', type: 'function', detail: '(url, { headers })' },
    { label: 'post', type: 'function', detail: '(url, body, { headers })' },
    { label: 'request', type: 'function', detail: '(method, url, { body, headers })' }
  ],
  'gladys.music': [{ label: 'say', type: 'function', detail: '(device, text, volume)' }],
  'gladys.scene': [{ label: 'start', type: 'function', detail: '(scene)' }],
  'gladys.message': [{ label: 'send', type: 'function', detail: '(user, text)' }],
  console: [
    { label: 'log', type: 'function' },
    { label: 'info', type: 'function' },
    { label: 'warn', type: 'function' },
    { label: 'error', type: 'function' }
  ]
};

const GLOBALS = [
  { label: 'gladys', type: 'namespace' },
  { label: 'sleep', type: 'function', detail: '(ms)' },
  { label: 'stop', type: 'function', detail: '()' },
  { label: 'event', type: 'variable' },
  { label: 'console', type: 'namespace' }
];

// the first argument of a call, being typed: gladys.device.getValue('liv
const FEATURE_ARGUMENT_REGEX = /gladys\.device\.(?:getValue|getFeature|setValue)\(\s*['"`]([^'"`]*)$/;
// a device where the API takes one, alone or first of a list: gladys.light.turnOn(['liv
const DEVICE_ARGUMENT_REGEX = /gladys\.(?:(?:light|switch)\.(?:turnOn|turnOff|toggle|blink)|device\.get|music\.say)\(\s*(?:\[\s*(?:['"`][^'"`]*['"`]\s*,\s*)*)?['"`]([^'"`]*)$/;
const ACTION_ARGUMENT_REGEX = /gladys\.(action|check)\(\s*['"`]([^'"`]*)$/;
const MEMBER_REGEX = /(?:^|[^\w$.])(gladys\.(?:device|light|switch|scene|message|music|variable|house|user|time|http)|gladys|console)\.(\w*)$/;
const WORD_REGEX = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)$/;

// the devices or features whose selector or name holds what was typed
const bySelectorOrName = (items, text) => {
  const typed = text.toLowerCase();
  return (items || [])
    .filter(item => item.selector.toLowerCase().includes(typed) || (item.name || '').toLowerCase().includes(typed))
    .map(item => ({ label: item.selector, type: 'constant', detail: item.name }));
};

const startingWith = (options, prefix) => options.filter(option => option.label.startsWith(prefix));

/**
 * The suggestions for the text before the cursor: `{ back, options }`, where `back` is the number
 * of characters before the cursor the picked option replaces. Null when there is nothing to
 * suggest.
 * `data`: `{ features: [{ selector, name }], devices: [{ selector, name }], actionTypes: [],
 * conditionTypes: [] }`.
 */
export const getCompletions = (textBefore, data = {}) => {
  const featureArgument = FEATURE_ARGUMENT_REGEX.exec(textBefore);
  if (featureArgument) {
    const options = bySelectorOrName(data.features, featureArgument[1]);
    return options.length > 0 ? { back: featureArgument[1].length, options } : null;
  }

  const deviceArgument = DEVICE_ARGUMENT_REGEX.exec(textBefore);
  if (deviceArgument) {
    const options = bySelectorOrName(data.devices, deviceArgument[1]);
    return options.length > 0 ? { back: deviceArgument[1].length, options } : null;
  }

  const actionArgument = ACTION_ARGUMENT_REGEX.exec(textBefore);
  if (actionArgument) {
    const types = (actionArgument[1] === 'check' ? data.conditionTypes : data.actionTypes) || [];
    const options = types
      .filter(type => type.includes(actionArgument[2]))
      .map(type => ({ label: type, type: 'constant' }));
    return options.length > 0 ? { back: actionArgument[2].length, options } : null;
  }

  const member = MEMBER_REGEX.exec(textBefore);
  if (member) {
    const options = startingWith(MEMBERS[member[1]], member[2]);
    return options.length > 0 ? { back: member[2].length, options } : null;
  }

  const word = WORD_REGEX.exec(textBefore);
  if (word) {
    const options = startingWith(GLOBALS, word[1]);
    return options.length > 0 ? { back: word[1].length, options } : null;
  }
  return null;
};

/**
 * A completion source for CodeMirror over `getCompletions`. `getData` is called at each
 * completion, so the suggestions follow the devices as they load.
 */
export const completionSource = getData => context => {
  const start = Math.max(0, context.pos - 300);
  const result = getCompletions(context.state.sliceDoc(start, context.pos), getData());
  if (!result) {
    return null;
  }
  return { from: context.pos - result.back, options: result.options, filter: false };
};
