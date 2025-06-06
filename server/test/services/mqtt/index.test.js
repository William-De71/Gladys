const { expect } = require('chai');
const sinon = require('sinon');

const { assert, fake } = sinon;
const proxyquire = require('proxyquire').noCallThru();
const { MockedMqttClient } = require('./mocks.test');

const MqttService = proxyquire('../../../services/mqtt/index', {
  mqtt: MockedMqttClient,
});

const gladys = {
  variable: {
    getValue: fake.resolves('result'),
  },
  system: {
    isDocker: fake.resolves(false),
  },
};

describe('MqttService', () => {
  const mqttService = MqttService(gladys, 'faea9c35-759a-44d5-bcc9-2af1de37b8b4');
  beforeEach(() => {
    sinon.reset();
  });
  it('should start service', async () => {
    await mqttService.start();
    assert.callCount(gladys.variable.getValue, 3);
    assert.calledOnce(MockedMqttClient.internalConnect);
    expect(mqttService.device.mqttClient.disconnected).to.eq(false);
  });

  it('should start service while already started', async () => {
    await mqttService.start();
    assert.callCount(gladys.variable.getValue, 3);
    assert.calledOnce(mqttService.device.mqttClient.internalEnd);
    assert.calledOnce(MockedMqttClient.internalConnect);
    expect(mqttService.device.mqttClient.disconnected).to.eq(false);
  });

  it('should stop service', async () => {
    const { mqttClient } = mqttService.device;
    mqttService.stop();
    assert.calledOnce(mqttClient.internalEnd);
    expect(mqttService.device.mqttClient).to.eq(null);
    expect(mqttClient.disconnected).to.eq(true);
  });
  it('should return true if service is used', async () => {
    mqttService.device.connected = true;
    const isUsed = await mqttService.isUsed();
    expect(isUsed).to.eq(true);
  });
  it('should return false if service is not used', async () => {
    mqttService.device.connected = false;
    const isUsed = await mqttService.isUsed();
    expect(isUsed).to.eq(false);
  });
});
