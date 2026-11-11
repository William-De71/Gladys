// Unit tests of the suggestions of the script editor: `npm run test-unit` (node --test).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getCompletions, completionSource } from './completions.js';

const DATA = {
  features: [
    { selector: 'living-room-temperature', name: 'Salon — Température' },
    { selector: 'living-room-lamp', name: 'Salon — Lampe' },
    { selector: 'kitchen-fan', name: 'Cuisine — Ventilateur' }
  ],
  devices: [
    { selector: 'living-room-lamp-device', name: 'Lampe du salon' },
    { selector: 'kitchen-speaker', name: 'Enceinte cuisine' }
  ],
  actionTypes: ['light.turn-on', 'light.turn-off', 'delay', 'condition.only-continue-if'],
  conditionTypes: ['condition.only-continue-if']
};
const labels = result => result.options.map(option => option.label);

describe('getCompletions', () => {
  it('should suggest the globals of the API from the first letter', () => {
    assert.deepEqual(labels(getCompletions('const x = gl', DATA)), ['gladys']);
    assert.deepEqual(labels(getCompletions('s', DATA)), ['sleep', 'stop']);
    assert.equal(getCompletions('s', DATA).back, 1);
    assert.equal(getCompletions('const ', DATA), null);
    assert.equal(getCompletions('foo.sl', DATA), null);
    assert.equal(getCompletions('zzz', DATA), null);
  });

  it('should suggest the members of gladys, its namespaces and the console', () => {
    assert.deepEqual(labels(getCompletions('await gladys.', DATA)), [
      'device',
      'light',
      'switch',
      'scene',
      'message',
      'music',
      'variable',
      'house',
      'user',
      'time',
      'http',
      'action',
      'check',
      'store'
    ]);
    assert.deepEqual(labels(getCompletions('await gladys.light.t', DATA)), ['turnOn', 'turnOff', 'toggle']);
    assert.deepEqual(labels(getCompletions('gladys.house.get', DATA)), ['getUsersAtHome', 'getAlarmMode', 'getSun']);
    assert.deepEqual(labels(getCompletions('gladys.variable.', DATA)), ['get', 'set', 'remove']);
    assert.deepEqual(labels(getCompletions('gladys.http.', DATA)), ['get', 'post', 'request']);
    assert.deepEqual(labels(getCompletions('gladys.time.', DATA)), ['now']);
    assert.deepEqual(labels(getCompletions('gladys.music.', DATA)), ['say']);
    assert.deepEqual(labels(getCompletions('gladys.user.setA', DATA)), ['setAtHome', 'setAway']);
    assert.deepEqual(labels(getCompletions('gladys.switch.to', DATA)), ['toggle']);
    assert.deepEqual(labels(getCompletions('await gladys.device.get', DATA)), ['getValue', 'getFeature', 'get']);
    assert.equal(getCompletions('await gladys.device.get', DATA).back, 3);
    assert.deepEqual(labels(getCompletions('gladys.scene.', DATA)), ['start']);
    assert.deepEqual(labels(getCompletions('gladys.message.s', DATA)), ['send']);
    assert.deepEqual(labels(getCompletions('console.w', DATA)), ['warn']);
    assert.equal(getCompletions('gladys.device.zzz', DATA), null);
    assert.equal(getCompletions('mygladys.', DATA), null);
  });

  it('should suggest the device features where the API takes one, by selector or by name', () => {
    assert.deepEqual(labels(getCompletions("await gladys.device.getValue('", DATA)), [
      'living-room-temperature',
      'living-room-lamp',
      'kitchen-fan'
    ]);
    const byName = getCompletions('gladys.device.setValue("vent', DATA);
    assert.deepEqual(byName, {
      back: 4,
      options: [{ label: 'kitchen-fan', type: 'constant', detail: 'Cuisine — Ventilateur' }]
    });
    assert.deepEqual(labels(getCompletions('gladys.device.getFeature( `LAMP', DATA)), ['living-room-lamp']);
    assert.equal(getCompletions("gladys.device.getValue('zzz", DATA), null);
    // the argument is closed: nothing more to suggest there
    assert.equal(getCompletions("gladys.device.getValue('kitchen-fan', ", DATA), null);
    assert.equal(getCompletions("gladys.device.getValue('", {}), null);
  });

  it('should suggest the devices where the API takes one, alone or in a list', () => {
    assert.deepEqual(labels(getCompletions("await gladys.light.turnOn('", DATA)), [
      'living-room-lamp-device',
      'kitchen-speaker'
    ]);
    assert.deepEqual(getCompletions("gladys.music.say('ence", DATA), {
      back: 4,
      options: [{ label: 'kitchen-speaker', type: 'constant', detail: 'Enceinte cuisine' }]
    });
    assert.deepEqual(labels(getCompletions("gladys.switch.toggle(['kitchen-speaker', 'lamp", DATA)), [
      'living-room-lamp-device'
    ]);
    assert.deepEqual(labels(getCompletions('gladys.device.get("kit', DATA)), ['kitchen-speaker']);
    assert.deepEqual(labels(getCompletions("gladys.light.blink(['", DATA)), [
      'living-room-lamp-device',
      'kitchen-speaker'
    ]);
    // the text of an announcement is not a device
    assert.equal(getCompletions("gladys.music.say('kitchen-speaker', 'kit", DATA), null);
    assert.equal(getCompletions("gladys.light.turnOn('zzz", DATA), null);
    assert.equal(getCompletions("gladys.light.turnOn('", {}), null);
  });

  it('should suggest the action types, and only the conditions for a check', () => {
    assert.deepEqual(labels(getCompletions("gladys.action('light", DATA)), ['light.turn-on', 'light.turn-off']);
    assert.deepEqual(labels(getCompletions("gladys.check('", DATA)), ['condition.only-continue-if']);
    assert.equal(getCompletions("gladys.check('light", DATA), null);
    assert.equal(getCompletions("gladys.action('", {}), null);
  });
});

describe('completionSource', () => {
  const context = text => ({ pos: text.length, state: { sliceDoc: (from, to) => text.slice(from, to) } });

  it('should give CodeMirror where the suggestion starts', () => {
    const source = completionSource(() => DATA);
    const result = source(context("await gladys.device.getValue('kit"));
    assert.equal(result.from, "await gladys.device.getValue('".length);
    assert.equal(result.filter, false);
    assert.deepEqual(labels(result), ['kitchen-fan']);
    assert.equal(source(context('const ')), null);
  });

  it('should only read the end of a long script', () => {
    const text = `${'x = 1;\n'.repeat(200)}gladys.`;
    const result = completionSource(() => DATA)(context(text));
    assert.equal(result.from, text.length);
  });
});
