# Scene scripts — user guide

Gladys scenes can run JavaScript in two places:

- the **Advanced** mode of the scene editor, where the actions of the scene are one script;
- a **Function** block, in the middle of a classic or graph scene.

Both run in the same sandbox, with the same API. The triggers of a scene always stay blocks: a
script only replaces the actions.

The reference of the design is [`docs/specs/scene-editor-modes.md`](specs/scene-editor-modes.md)
(section D). The graph and code modes are inspired by the Node-RED-style canvas prototyped by Hizo
(Hizoka76), branch `Hizoka76/Gladys:feat/canvas_style`.

## The basics

A script is the body of an `async` function: use `await` on everything that talks to Gladys.

```js
const temperature = await gladys.device.getValue('living-room-temperature');
if (temperature > 26) {
  await gladys.device.setValue('living-room-fan', 1);
  await gladys.message.send('john', `It is ${temperature} °C, the fan is on`);
}
```

- In the Advanced mode, `return` ends the scene.
- In a Function block, `return value` gives a result to the next blocks: they read it as
  `{{<path of the block>.result}}`, picked from the variables list like any other variable.
- `stop()` ends the whole scene quietly, like a condition that is not met.

The editor suggests the API while you type, and the real selectors of your devices inside
`gladys.device.getValue('…')`. The "Insert a device" list writes a selector for you.

## API

| Call                                            | Returns               | What it does                                                   |
| ----------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| `event`                                         | object or `undefined` | What triggered the scene (`undefined` when started by hand)    |
| `await gladys.device.getValue(feature)`         | number or `null`      | Last value of a device feature                                 |
| `await gladys.device.getFeature(feature)`       | object                | The whole device feature (unit, min, max, last value…)         |
| `await gladys.device.setValue(feature, value)`  | `null`                | Changes the value of a device feature                          |
| `await gladys.scene.start(scene)`               | `null`                | Starts another scene                                           |
| `await gladys.message.send(user, text)`         | `null`                | Sends a message to a user                                      |
| `await gladys.action(type, params, { saveAs })` | the result            | Runs any block of the scene editor, with the same parameters   |
| `await gladys.check(type, params)`              | `true` / `false`      | Checks a condition block without stopping the scene            |
| `await gladys.store(name, value)`               | `null`                | Keeps a value for the `{{name}}` templates of the next actions |
| `await sleep(ms)`                               | `null`                | Waits; interrupted when the scene is stopped                   |
| `stop()`                                        | —                     | Ends the scene without error                                   |
| `console.log(…)`, `.info`, `.warn`, `.error`    | —                     | Writes to the console of the editor and to the Gladys logs     |

Selectors (`feature`, `scene`, `user`) are the ones shown in Gladys, for example
`living-room-temperature`.

## Examples

### Run any block: `gladys.action`

Every block of the editor can be run from a script, with the parameters it has in a scene. The
easiest way to learn them is to build the block in the classic mode, then switch a copy of the
scene to the Advanced mode: the conversion writes the call for you.

```js
await gladys.action('light.turn-on', { devices: ['living-room-lamp'] });
await gladys.action('delay', { value: 5, unit: 'seconds' });
await gladys.action('light.turn-off', { devices: ['living-room-lamp'] });
```

### Several things at the same time

```js
await Promise.all([
  gladys.device.setValue('kitchen-light', 1),
  gladys.device.setValue('living-room-light', 1)
]);
```

### A condition that does not stop the scene

```js
const isEarly = await gladys.check('condition.check-time', { before: '08:00' });
await gladys.device.setValue('hall-light-brightness', isEarly ? 10 : 80);
```

### Keep a value for a message template

```js
const values = await Promise.all([
  gladys.device.getValue('bedroom-temperature'),
  gladys.device.getValue('living-room-temperature')
]);
await gladys.store('average', Math.round((values[0] + values[1]) / 2));
await gladys.message.send('john', 'Average temperature: {{average}} °C');
```

### Loop until something happens

```js
// wait for the door to close, 10 minutes at most
for (let i = 0; i < 600; i += 1) {
  if ((await gladys.device.getValue('front-door-opening')) === 0) {
    return;
  }
  await sleep(1000);
}
await gladys.message.send('john', 'The front door is still open');
```

### A Function block that decides for the next blocks

```js
const temperature = await gladys.device.getValue('living-room-temperature');
return temperature > 26 ? 'hot' : 'fine';
```

The next block can then compare `{{1.0.result}}` (the path depends on where the block is).

## Trying a script

The **Try** button runs the code as it is written, without saving the scene. The script really
runs: lights turn on, messages are sent. The console shows what it logs, how it ended and what
it returned. While it runs, the button becomes **Stop**.

A Function block is tried alone: the results of the blocks before it are not available.

## Limits

A script cannot harm Gladys, and Gladys stops it when it goes too far:

- no access to files, the network or Node: only the API above;
- 32 MB of memory;
- 1 second of computing between two `await` on Gladys, and 30 seconds of computing in all for one
  execution. Waiting (`sleep`, an action) does not count: a script that mostly waits can run for
  days;
- `sleep` takes at most about 24.8 days;
- 1 000 log lines per execution, 2 000 characters per line;
- `gladys.store` and `saveAs` cannot use the names Gladys keeps for itself (`abortSignal`,
  `sceneSelector`, `alreadyExecutedScenes`, `triggerEvent`).

Errors show in the console with their line and column. A script that does not compile cannot be
saved.

## Moving a device

When a device is migrated to another one, Gladys rewrites the selectors written as plain strings
in scripts (`'old-selector'`). A selector built at runtime (`'old-' + name`) cannot be found:
check those scripts by hand after a migration.
