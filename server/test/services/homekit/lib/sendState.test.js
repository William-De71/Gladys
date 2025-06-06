const { expect } = require('chai');
const { stub } = require('sinon');
const { sendState } = require('../../../../services/homekit/lib/sendState');
const {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  EVENTS,
  DEVICE_FEATURE_UNITS,
} = require('../../../../utils/constants');

describe('Send state to HomeKit', () => {
  const homekitHandler = {
    serviceId: '7056e3d4-31cc-4d2a-bbdd-128cd49755e6',
    sendState,
    gladys: {
      stateManager: {},
    },
    hap: {
      Characteristic: {
        On: 'ON',
        Brightness: 'BRIGHTNESS',
        Hue: 'HUE',
        Saturation: 'SATURATION',
        ColorTemperature: 'COLORTEMPERATURE',
        ContactSensorState: 'CONTACTSENSORSTATE',
        MotionDetected: 'MOTIONDETECTED',
        CurrentTemperature: 'CURRENTTEMPERATURE',
        CurrentPosition: 'CURRENTPOSITION',
        PositionState: 'POSITIONSTATE',
        TargetPosition: 'TARGETPOSITION',
      },
      Service: {
        ContactSensor: 'CONTACTSENSOR',
        MotionSensor: 'MOTIONSENSOR',
        WindowCovering: 'WINDOWCOVERING',
      },
    },
    notifyTimeouts: {},
  };

  it('should notify binary sensor', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 0,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Light on/off',
      category: DEVICE_FEATURE_CATEGORIES.LIGHT,
      type: DEVICE_FEATURE_TYPES.LIGHT.BINARY,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0]).eql(['ON', 0]);
  });

  it('should notify binary sensor (reversed)', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 0,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Door sensor',
      category: DEVICE_FEATURE_CATEGORIES.OPENING_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0]).eql(['CONTACTSENSORSTATE', 1]);
  });

  it('should notify motion sensor', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 0,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Motion sensor',
      category: DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0]).eql(['MOTIONDETECTED', 0]);
  });

  it('should notify light brightness', async () => {
    const updateCharacteristic = stub().returns();
    const getCharacteristic = stub().returns({
      props: {
        minValue: 0,
        maxValue: 100,
      },
    });
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({
        updateCharacteristic,
        getCharacteristic,
      }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 70,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Bulb brightness',
      category: DEVICE_FEATURE_CATEGORIES.LIGHT,
      type: DEVICE_FEATURE_TYPES.LIGHT.BRIGHTNESS,
      min: 0,
      max: 140,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0][0]).eql('BRIGHTNESS');
    expect(updateCharacteristic.args[0][1]).eql(50);
  });

  it('should notify light color', async () => {
    const updateCharacteristic = stub();
    updateCharacteristic.returns({ updateCharacteristic });

    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 3500000,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Bulb color',
      category: DEVICE_FEATURE_CATEGORIES.LIGHT,
      type: DEVICE_FEATURE_TYPES.LIGHT.COLOR,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.callCount).eq(2);
    expect(updateCharacteristic.args[0]).eql(['HUE', 222]);
    expect(updateCharacteristic.args[1]).eql(['SATURATION', 76]);
  });

  it('should notify light temperature', async () => {
    const updateCharacteristic = stub().returns();
    const getCharacteristic = stub().returns({
      props: {
        minValue: 140,
        maxValue: 500,
      },
    });
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({
        updateCharacteristic,
        getCharacteristic,
      }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 50,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Bulb temperature',
      category: DEVICE_FEATURE_CATEGORIES.LIGHT,
      type: DEVICE_FEATURE_TYPES.LIGHT.TEMPERATURE,
      min: 0,
      max: 100,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0][0]).eql('COLORTEMPERATURE');
    expect(updateCharacteristic.args[0][1]).eql(320);
  });

  it('should notify sensor temperature Kelvin', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 294.15,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Sensor temperature',
      category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
      unit: DEVICE_FEATURE_UNITS.KELVIN,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0]).eql(['CURRENTTEMPERATURE', 21]);
  });

  it('should notify sensor temperature Fahrenheit', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 68,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Sensor temperature',
      category: DEVICE_FEATURE_CATEGORIES.TEMPERATURE_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
      unit: DEVICE_FEATURE_UNITS.FAHRENHEIT,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0]).eql(['CURRENTTEMPERATURE', 20]);
  });

  it('should notify shutter state', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 0,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Shutter state',
      category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
      type: DEVICE_FEATURE_TYPES.SHUTTER.STATE,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.args[0]).eql(['POSITIONSTATE', 2]);
  });

  it('should notify shutter current/target position', async () => {
    const updateCharacteristic = stub();
    updateCharacteristic.returns({ updateCharacteristic });
    const getCharacteristic = stub().returns({
      props: {
        minValue: 0,
        maxValue: 100,
      },
    });

    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic, getCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 60,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Shutter position',
      category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
      type: DEVICE_FEATURE_TYPES.SHUTTER.POSITION,
      min: 0,
      max: 100,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.callCount).eq(2);
    expect(updateCharacteristic.args[0][0]).eql('CURRENTPOSITION');
    expect(updateCharacteristic.args[0][1]).eql(60);
    expect(updateCharacteristic.args[1][0]).eql('TARGETPOSITION');
    expect(updateCharacteristic.args[1][1]).eql(60);
  });

  it('should do nothing wrong device category & type', async () => {
    const updateCharacteristic = stub().returns();
    const accessory = {
      UUID: '4756151c-369e-4772-8bf7-943a6ac70583',
      getService: stub().returns({ updateCharacteristic }),
    };

    const event = {
      type: EVENTS.DEVICE.NEW_STATE,
      last_value: 68,
    };

    const feature = {
      id: '4f7060d7-7960-4c68-b435-8952bf3f40bf',
      device_id: '4756151c-369e-4772-8bf7-943a6ac70583',
      name: 'Sensor temperature',
      category: DEVICE_FEATURE_CATEGORIES.UNKNOWN,
      type: DEVICE_FEATURE_TYPES.UNKNOWN.UNKNOWN,
    };

    await homekitHandler.sendState(accessory, feature, event);

    expect(updateCharacteristic.callCount).eql(0);
  });
});
