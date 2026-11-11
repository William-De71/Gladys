const sinon = require('sinon').createSandbox();
const proxyquire = require('proxyquire').noCallThru();

const GladysGatewayClientMock = require('./GladysGatewayClientMock.test');

const { fake, assert } = sinon;
const Gateway = proxyquire('../../../lib/gateway', {
  '@gladysassistant/gladys-gateway-js': GladysGatewayClientMock,
});

describe('gateway.forwardWebsockets', () => {
  const variable = {};

  let gateway;

  beforeEach(async () => {
    const job = {
      wrapper: (type, func) => {
        return async () => {
          return func();
        };
      },
      updateProgress: fake.resolves({}),
    };

    variable.destroy = fake.resolves(null);

    const scheduler = {
      scheduleJob: (rule, callback) => {
        return {
          callback,
          rule,
          cancel: () => {},
        };
      },
    };

    const event = {
      on: fake.returns(null),
      emit: fake.returns(null),
    };

    gateway = new Gateway(variable, event, {}, {}, {}, {}, {}, {}, job, scheduler);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should forward a websocket message when connected', () => {
    gateway.connected = true;

    const websocketMessage = {
      type: 'device.new',
      payload: {},
    };
    gateway.forwardWebsockets(websocketMessage);
    assert.calledWith(gateway.gladysGatewayClient.newEventInstance, websocketMessage.type, websocketMessage.payload);
  });
  it('should forward a websocket message to the administrators only', async () => {
    gateway.connected = true;
    gateway.user = { getByRole: fake.resolves([{ id: 'admin-1' }, { id: 'admin-2' }]) };
    gateway.gladysGatewayClient.newEventInstanceUser = fake.resolves(null);
    await gateway.forwardWebsocketsToAdmins({ type: 'scene.script-log', payload: { message: 'hello' } });
    assert.calledOnceWithExactly(gateway.user.getByRole, 'admin');
    assert.calledTwice(gateway.gladysGatewayClient.newEventInstanceUser);
    assert.calledWith(gateway.gladysGatewayClient.newEventInstanceUser, 'scene.script-log', 'admin-2', {
      message: 'hello',
    });
  });
  it('should not forward to the administrators when not connected, and survive a failure', async () => {
    gateway.user = { getByRole: fake.rejects(new Error('database closed')) };
    await gateway.forwardWebsocketsToAdmins({ type: 'scene.script-log', payload: {} });
    assert.notCalled(gateway.user.getByRole);
    gateway.connected = true;
    await gateway.forwardWebsocketsToAdmins({ type: 'scene.script-log', payload: {} });
    assert.calledOnce(gateway.user.getByRole);
  });
  it('should prevent forwarding a websocket message when not connected', () => {
    const websocketMessage = {
      type: 'device.new',
      payload: {},
    };
    gateway.forwardWebsockets(websocketMessage);
    assert.notCalled(gateway.gladysGatewayClient.newEventInstance);
  });
});
