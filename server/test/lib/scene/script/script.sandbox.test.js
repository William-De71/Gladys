const { expect } = require('chai');
const sinon = require('sinon').createSandbox();

const {
  compileScript,
  runScript,
  describeError,
  getErrorPosition,
  freeSandbox,
} = require('../../../../lib/scene/script/script.sandbox');

describe('scene script sandbox', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('compileScript', () => {
    it('should accept a valid script, with top-level await and return', async () => {
      const result = await compileScript('await sleep(10);\nreturn 1;');
      expect(result).to.deep.equal({ valid: true });
    });
    it('should give the position of a syntax error on the first line, in the user code', async () => {
      const result = await compileScript('let x = ;');
      expect(result).to.deep.equal({
        valid: false,
        message: "unexpected token in expression: ';'",
        line: 1,
        column: 9,
      });
    });
    it('should give the line of a syntax error further down', async () => {
      const result = await compileScript('const a = 1;\nconst b = a +;');
      expect(result.valid).to.equal(false);
      expect(result.line).to.equal(2);
    });
  });

  describe('runScript', () => {
    it('should run a script calling the API, with the trigger event', async () => {
      const onLog = sinon.fake();
      const api = { action: sinon.fake.resolves({ last_value: 12 }) };
      const result = await runScript({
        code: `
          const value = await gladys.action('device.get-value', { device_feature: 'temp' });
          console.log('value', value.last_value, event.type, { nested: true });
          console.warn('warning');
          console.error(new TypeError('bad'));
          console.info(undefined);
        `,
        api,
        event: { type: 'device.new-state' },
        onLog,
      });
      expect(result.status).to.equal('success');
      sinon.assert.calledOnceWithExactly(api.action, 'device.get-value', { device_feature: 'temp' }, null);
      expect(onLog.args).to.deep.equal([
        ['info', 'value 12 device.new-state {"nested":true}'],
        ['warn', 'warning'],
        ['error', 'TypeError: bad'],
        ['info', 'undefined'],
      ]);
    });
    it('should expose every method of the API', async () => {
      const calls = [];
      const record = (name) => async (...args) => {
        calls.push([name, ...args]);
        return name === 'check' ? true : null;
      };
      const api = {
        action: record('action'),
        check: record('check'),
        'device.getValue': record('device.getValue'),
        'device.getFeature': record('device.getFeature'),
        'device.setValue': record('device.setValue'),
        'scene.start': record('scene.start'),
        'message.send': record('message.send'),
        sleep: record('sleep'),
        store: record('store'),
      };
      const result = await runScript({
        code: `
          await gladys.action('delay', { value: 1 }, { saveAs: 'wait' });
          await gladys.check('house.is-empty', { house: 'main' });
          await gladys.device.getValue('temp');
          await gladys.device.getFeature('temp');
          await gladys.device.setValue('lamp', 1);
          await gladys.scene.start('other');
          await gladys.message.send('john', 'hello');
          await sleep(5);
          await gladys.store('total', 3);
        `,
        api,
      });
      expect(result.status).to.equal('success');
      expect(calls).to.deep.equal([
        ['action', 'delay', { value: 1 }, { saveAs: 'wait' }],
        ['check', 'house.is-empty', { house: 'main' }, null],
        ['device.getValue', 'temp'],
        ['device.getFeature', 'temp'],
        ['device.setValue', 'lamp', 1],
        ['scene.start', 'other'],
        ['message.send', 'john', 'hello'],
        ['sleep', 5],
        ['store', 'total', 3],
      ]);
    });
    it('should give back what the script returns', async () => {
      expect(await runScript({ code: 'return { answer: 42 };', api: {} })).to.deep.equal({
        status: 'success',
        value: { answer: 42 },
      });
      expect(await runScript({ code: 'const a = 1;', api: {} })).to.deep.equal({ status: 'success', value: undefined });
    });
    it('should give `undefined` as event when the scene was started by hand', async () => {
      const onLog = sinon.fake();
      await runScript({ code: 'console.log(typeof event)', api: {}, onLog });
      sinon.assert.calledOnceWithExactly(onLog, 'info', 'undefined');
    });
    it('should log a value that cannot be serialized', async () => {
      const onLog = sinon.fake();
      await runScript({ code: 'const a = {}; a.self = a; console.log(a)', api: {}, onLog });
      sinon.assert.calledOnceWithExactly(onLog, 'info', '[object Object]');
    });
    it('should not expose Node to the script, and keep the API read-only', async () => {
      const onLog = sinon.fake();
      const result = await runScript({
        code: `
          console.log(typeof require, typeof process, typeof fetch, typeof setTimeout, typeof __host);
          try { gladys.device = null; } catch (e) { console.log(e.name); }
        `,
        api: {},
        onLog,
      });
      expect(result.status).to.equal('success');
      expect(onLog.args).to.deep.equal([
        ['info', 'undefined undefined undefined undefined undefined'],
        ['info', 'TypeError'],
      ]);
    });
    it('should throw an API error into the script, which can catch it', async () => {
      const onLog = sinon.fake();
      const api = {
        action: sinon.fake.rejects(new Error('Device not found')),
        check: async () => {
          throw 'not an error'; // eslint-disable-line no-throw-literal
        },
      };
      const result = await runScript({
        code: `
          try { await gladys.action('device.set-value', {}); } catch (e) { console.log('caught', e.message); }
          try { await gladys.check('x', {}); } catch (e) { console.log('caught', e.message); }
          try { await gladys.unknown(); } catch (e) { console.log(e.name); }
        `,
        api,
        onLog,
      });
      expect(result.status).to.equal('success');
      expect(onLog.args).to.deep.equal([
        ['info', 'caught Device not found'],
        ['info', 'caught not an error'],
        ['info', 'TypeError'],
      ]);
    });
    it('should refuse a method the API does not have', async () => {
      const result = await runScript({ code: "await gladys.device.getValue('temp')", api: {} });
      expect(result.status).to.equal('error');
      expect(result.error).to.include({ name: 'Error', message: 'Unknown method "device.getValue"' });
    });
    it('should return the error of a failing script, with its position', async () => {
      const result = await runScript({ code: 'await sleep(1);\nnull.x', api: { sleep: async () => null } });
      expect(result).to.deep.equal({
        status: 'error',
        error: { name: 'TypeError', message: "cannot read property 'x' of null", line: 2, column: 5 },
      });
    });
    it('should return a syntax error', async () => {
      const result = await runScript({ code: 'let x = ;', api: {} });
      expect(result.status).to.equal('error');
      expect(result.error).to.include({ name: 'SyntaxError', line: 1, column: 9 });
    });
    it('should interrupt a script hogging the CPU', async () => {
      const result = await runScript({ code: 'while (true) {}', api: {}, maxSyncExecutionMs: 50 });
      expect(result.status).to.equal('error');
      expect(result.error.name).to.equal('InternalError');
      expect(result.error.message).to.match(/without awaiting Gladys and was interrupted/);
    });
    it('should give each awaited call a new time budget', async () => {
      const result = await runScript({
        code: `
          for (let i = 0; i < 4; i += 1) {
            const start = Date.now();
            while (Date.now() - start < 30) {}
            await sleep(1);
          }
        `,
        api: {
          sleep: () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(null), 1);
            }),
        },
        maxSyncExecutionMs: 60,
      });
      expect(result.status).to.equal('success');
    });
    it('should stop a runaway recursion with an error, and allow a deep one', async () => {
      const overflow = await runScript({ code: 'function f() { return f() + 1; }\nf();', api: {} });
      expect(overflow.status).to.equal('error');
      expect(overflow.error).to.include({ name: 'InternalError', message: 'stack overflow' });
      const asyncOverflow = await runScript({ code: 'const g = async () => g();\nawait g();', api: {} });
      expect(asyncOverflow.status).to.equal('error');
      const onLog = sinon.fake();
      const deep = await runScript({
        code: 'const depth = (n) => (n === 0 ? 0 : 1 + depth(n - 1));\nconsole.log(depth(500));',
        api: {},
        onLog,
      });
      expect(deep.status).to.equal('success');
      sinon.assert.calledOnceWithExactly(onLog, 'info', '500');
    });
    it('should resume the script once, when several calls settle at the same time', async () => {
      const onLog = sinon.fake();
      const result = await runScript({
        code: "const first = await Promise.race([gladys.action('a'), gladys.action('b')]);\nconsole.log(first);",
        api: { action: async (type) => type },
        onLog,
      });
      expect(result.status).to.equal('success');
      sinon.assert.calledOnceWithExactly(onLog, 'info', 'a');
    });
    it('should give null to the script for a method returning nothing', async () => {
      const onLog = sinon.fake();
      await runScript({ code: "console.log(await gladys.action('a'));", api: { action: async () => {} }, onLog });
      sinon.assert.calledOnceWithExactly(onLog, 'info', 'null');
    });
    it('should stop a script using too much memory', async () => {
      const result = await runScript({
        code: 'const buffers = []; for (;;) { buffers.push(new ArrayBuffer(1024 * 1024)); }',
        api: {},
        maxSyncExecutionMs: 20000,
      });
      expect(result.status).to.equal('error');
      expect(result.error.message).to.equal('out of memory');
    }).timeout(10000);
    it('should stop quietly when the script calls stop(), even inside a try / catch', async () => {
      const onLog = sinon.fake();
      const result = await runScript({
        code: "try { stop(); } catch (e) { console.log('ignored'); } while (true) {}",
        api: {},
        onLog,
      });
      expect(result).to.deep.equal({ status: 'stopped' });
      sinon.assert.notCalled(onLog);
    });
    it('should stop quietly when an API call meets a stop error', async () => {
      const stopError = new Error('CONDITION_NOT_VERIFIED');
      const api = { action: sinon.fake.rejects(stopError), sleep: sinon.fake.resolves(null) };
      const result = await runScript({
        code: "try { await gladys.action('house.is-empty', {}); } catch (e) {} await sleep(1);",
        api,
        isStopError: (error) => error === stopError,
      });
      expect(result).to.deep.equal({ status: 'stopped' });
      sinon.assert.notCalled(api.sleep);
    });
    it('should abort a script waiting on an API call', async () => {
      const abortController = new AbortController();
      const api = {
        sleep: () =>
          new Promise((resolve) => {
            setTimeout(() => resolve(null), 5000);
          }),
      };
      setTimeout(() => abortController.abort(), 20);
      const result = await runScript({ code: 'await sleep(5000);', api, abortSignal: abortController.signal });
      expect(result).to.deep.equal({ status: 'aborted' });
    });
    it('should abort a script waiting on a promise that never settles', async () => {
      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 20);
      const result = await runScript({
        code: 'await new Promise(() => {});',
        api: {},
        abortSignal: abortController.signal,
      });
      expect(result).to.deep.equal({ status: 'aborted' });
    });
    it('should keep the sandbox usable after scripts were stopped while waiting', async () => {
      // A runtime freed with live objects would abort the whole WebAssembly module
      for (let i = 0; i < 3; i += 1) {
        const abortController = new AbortController();
        setTimeout(() => abortController.abort(), 5);
        // eslint-disable-next-line no-await-in-loop
        const result = await runScript({
          code: 'const pending = new Promise(() => {}); globalThis.keep = [pending]; await pending;',
          api: {},
          abortSignal: abortController.signal,
        });
        expect(result).to.deep.equal({ status: 'aborted' });
      }
      expect(await runScript({ code: 'return 1;', api: {} })).to.deep.equal({ status: 'success', value: 1 });
    });
    it('should not start a script whose scene is already aborted', async () => {
      const abortController = new AbortController();
      abortController.abort();
      const api = { action: sinon.fake.resolves(null) };
      const result = await runScript({
        code: "await gladys.action('x', {});",
        api,
        abortSignal: abortController.signal,
      });
      expect(result).to.deep.equal({ status: 'aborted' });
      sinon.assert.notCalled(api.action);
    });
    it('should not call the API once the scene is aborted', async () => {
      const abortController = new AbortController();
      const api = {
        sleep: async () => {
          abortController.abort();
          return null;
        },
        action: sinon.fake.resolves(null),
      };
      const result = await runScript({
        code: "await sleep(1); await gladys.action('x', {});",
        api,
        abortSignal: abortController.signal,
      });
      expect(result).to.deep.equal({ status: 'aborted' });
      sinon.assert.notCalled(api.action);
    });
    it('should ignore the result of an API call settling after the end of the script', async () => {
      let resolveLateCall;
      const api = {
        action: () =>
          new Promise((resolve) => {
            resolveLateCall = resolve;
          }),
      };
      const result = await runScript({ code: "gladys.action('x', {}); return 1;", api });
      expect(result.status).to.equal('success');
      resolveLateCall({ late: true });
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
    });
    it('should ignore the failure of an API call settling after the end of the script', async () => {
      let rejectLateCall;
      const api = {
        action: () =>
          new Promise((resolve, reject) => {
            rejectLateCall = reject;
          }),
      };
      const result = await runScript({ code: "gladys.action('x', {}).catch(() => {}); return 1;", api });
      expect(result.status).to.equal('success');
      rejectLateCall(new Error('late'));
      await new Promise((resolve) => {
        setImmediate(resolve);
      });
    });
  });

  describe('freeSandbox', () => {
    it('should only log when QuickJS cannot free a sandbox', () => {
      const context = { dispose: sinon.fake() };
      const runtime = {
        dispose: () => {
          throw new Error('Aborted(Assertion failed)');
        },
      };
      freeSandbox(context, runtime);
      sinon.assert.calledOnce(context.dispose);
    });
  });

  describe('describeError', () => {
    it('should say how long the script ran when it was interrupted', () => {
      expect(describeError({ name: 'InternalError', message: 'interrupted' }, 50).message).to.equal(
        'The script ran for more than 50 ms without awaiting Gladys and was interrupted',
      );
    });
    it('should describe a thrown value that is not an error', () => {
      expect(describeError('boom')).to.deep.equal({ name: 'Error', message: 'boom', line: null, column: null });
    });
    it('should describe an error without name nor message', () => {
      expect(describeError({})).to.deep.equal({ name: 'Error', message: '[object Object]', line: null, column: null });
    });
  });

  describe('getErrorPosition', () => {
    it('should return no position without a stack', () => {
      expect(getErrorPosition({})).to.deep.equal({ line: null, column: null });
      expect(getErrorPosition(null)).to.deep.equal({ line: null, column: null });
    });
    it('should never return a column before the user code on the first line', () => {
      expect(getErrorPosition({ stack: 'at scene.js:1:2' })).to.deep.equal({ line: 1, column: 1 });
    });
  });
});
