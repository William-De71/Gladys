// What the script editor suggests while typing (docs/specs/scene-editor-modes.md D.8): the
// scripting API of D.3, and the real selectors of the instance where the API takes one.
//
// Pure functions, unit-tested with `npm run test-unit` (completions.test.js).

const MEMBERS = {
  gladys: [
    { label: 'device', type: 'namespace' },
    { label: 'scene', type: 'namespace' },
    { label: 'message', type: 'namespace' },
    { label: 'action', type: 'function', detail: '(type, params, { saveAs })' },
    { label: 'check', type: 'function', detail: '(type, params)' },
    { label: 'store', type: 'function', detail: '(name, value)' }
  ],
  'gladys.device': [
    { label: 'getValue', type: 'function', detail: '(feature)' },
    { label: 'getFeature', type: 'function', detail: '(feature)' },
    { label: 'setValue', type: 'function', detail: '(feature, value)' }
  ],
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
const ACTION_ARGUMENT_REGEX = /gladys\.(action|check)\(\s*['"`]([^'"`]*)$/;
const MEMBER_REGEX = /(?:^|[^\w$.])(gladys\.device|gladys\.scene|gladys\.message|gladys|console)\.(\w*)$/;
const WORD_REGEX = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)$/;

const startingWith = (options, prefix) => options.filter(option => option.label.startsWith(prefix));

/**
 * The suggestions for the text before the cursor: `{ back, options }`, where `back` is the number
 * of characters before the cursor the picked option replaces. Null when there is nothing to
 * suggest.
 * `data`: `{ features: [{ selector, name }], actionTypes: [], conditionTypes: [] }`.
 */
export const getCompletions = (textBefore, data = {}) => {
  const featureArgument = FEATURE_ARGUMENT_REGEX.exec(textBefore);
  if (featureArgument) {
    const typed = featureArgument[1].toLowerCase();
    const options = (data.features || [])
      .filter(
        feature => feature.selector.toLowerCase().includes(typed) || (feature.name || '').toLowerCase().includes(typed)
      )
      .map(feature => ({ label: feature.selector, type: 'constant', detail: feature.name }));
    return options.length > 0 ? { back: featureArgument[1].length, options } : null;
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
