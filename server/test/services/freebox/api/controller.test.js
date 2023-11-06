const sinon = require('sinon');
const FreeboxController = require('../../../../services/freebox/api/freebox.controller');

const { assert, fake } = sinon;

const freeboxManager = {
  discoverFreebox: fake.resolves([]),
  connectFreebox: fake.resolves([]),
  getSessionToken: fake.resolves([]),
  discoverDevices: fake.resolves([]),
  restartFreebox: fake.resolves([]),
};

describe('FreeboxController GET /api/v1/service/freebox/discovery', () => {
  let controller;

  beforeEach(() => {
    controller = FreeboxController(freeboxManager);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should return discovered freebox', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['get /api/v1/service/freebox/discovery'].controller(req, res);
    assert.calledOnce(freeboxManager.discoverFreebox);
    assert.calledOnce(res.json);
  });

});

describe('FreeboxController POST /api/v1/service/freebox/connect', () => {
  let controller;

  beforeEach(() => {
    controller = FreeboxController(freeboxManager);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should connect Gladys to Freebox', async () => {
    const req = {};
    const res = {
      json: fake.returns(null),
    };

    await controller['post /api/v1/service/freebox/connect'].controller(req, res);
    assert.calledOnce(freeboxManager.connectFreebox);
    assert.calledOnce(res.json);
  });

});

describe('FreeboxController POST /api/v1/service/freebox/sessionToken', () => {
  let controller;

  beforeEach(() => {
    controller = FreeboxController(freeboxManager);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should return session token', async () => {
    const req = {};
    const res = {
      json: fake.returns([]),
    };

    await controller['post /api/v1/service/freebox/sessionToken'].controller(req, res);
    assert.calledOnce(freeboxManager.getSessionToken);
    assert.calledOnce(res.json);
  });

});

describe('FreeboxController GET /api/v1/service/freebox/discover', () => {
  let controller;

  beforeEach(() => {
    controller = FreeboxController(freeboxManager);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should return discovered devices', async () => {
    const req = {};
    const res = {
      json: fake.returns([]),
    };

    await controller['get /api/v1/service/freebox/discover'].controller(req, res);
    assert.calledOnce(freeboxManager.discoverDevices);
    assert.calledOnce(res.json);
  });

});

describe('FreeboxController POST /api/v1/service/freebox/restart', () => {
  let controller;

  beforeEach(() => {
    controller = FreeboxController(freeboxManager);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should restart Freebox', async () => {
    const req = {};
    const res = {
      json: fake.returns([]),
    };

    await controller['post /api/v1/service/freebox/restart'].controller(req, res);
    assert.calledOnce(freeboxManager.restartFreebox);
    assert.calledOnce(res.json);
  });

});