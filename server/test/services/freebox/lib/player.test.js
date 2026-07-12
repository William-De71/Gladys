const { expect } = require('chai');
const sinon = require('sinon');

const { fake, assert } = sinon;

const FreeboxHandler = require('../../../../services/freebox/lib/index');
const { convertPlayer } = require('../../../../services/freebox/lib/player/convertPlayer');
const { PLAYER } = require('../../../../services/freebox/lib/utils/constants');
const { EVENTS, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } = require('../../../../utils/constants');

const serviceId = 'e4ff2e60-46e7-476c-85cc-1c13c2b28fbd';

const freeboxPlayer = {
  api_available: true,
  api_version: '7.0',
  device_name: 'Freebox Player',
  id: 1,
  reachable: true,
  stb_type: 'stb_v8',
  uid: '9f20347c10fcd7751f3e6543d3aafb86',
};

describe('FreeboxHandler player', () => {
  let gladys;
  let freeboxHandler;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.returns(null),
      },
    };
    freeboxHandler = new FreeboxHandler(gladys, serviceId);
    freeboxHandler.baseAPIURL = 'https://mafreebox.freebox.fr/api/v8';
    freeboxHandler.sessionToken = 'session-token';
  });

  afterEach(() => {
    sinon.reset();
  });

  describe('convertPlayer', () => {
    it('should convert a Freebox player to a Gladys device', () => {
      const device = convertPlayer(freeboxPlayer);

      expect(device.name).to.equal('Freebox Player');
      expect(device.external_id).to.equal('freebox:player:1');
      expect(device.model).to.equal(PLAYER.MODEL);
      expect(device.should_poll).to.equal(true);
      expect(device.params).to.deep.equal([{ name: PLAYER.API_VERSION_PARAM, value: 'v7' }]);

      expect(device.features).to.have.lengthOf(10);
      device.features.forEach((feature) => {
        expect(feature.category).to.equal(DEVICE_FEATURE_CATEGORIES.TELEVISION);
      });

      const powerFeature = device.features.find(
        (feature) => feature.type === DEVICE_FEATURE_TYPES.TELEVISION.BINARY,
      );
      expect(powerFeature.external_id).to.equal('freebox:player:1:binary');
      expect(powerFeature.read_only).to.equal(true);

      const volumeFeature = device.features.find(
        (feature) => feature.type === DEVICE_FEATURE_TYPES.TELEVISION.VOLUME,
      );
      expect(volumeFeature.read_only).to.equal(false);
      expect(volumeFeature.min).to.equal(0);
      expect(volumeFeature.max).to.equal(100);
    });
  });

  describe('loadPlayers', () => {
    it('should load players and filter out those without API', async () => {
      freeboxHandler.request = fake.resolves({
        data: {
          success: true,
          result: [freeboxPlayer, { ...freeboxPlayer, id: 2, api_available: false }],
        },
      });

      const players = await freeboxHandler.loadPlayers();

      expect(players).to.have.lengthOf(1);
      expect(players[0].id).to.equal(1);
      assert.calledOnce(freeboxHandler.request);
      assert.calledWithMatch(freeboxHandler.request, {
        method: 'GET',
        url: '/player',
        baseURL: freeboxHandler.baseAPIURL,
        headers: { 'X-Fbx-App-Auth': 'session-token' },
      });
    });

    it('should return an empty list when the Freebox has no player', async () => {
      freeboxHandler.request = fake.resolves({ data: { success: true, result: null } });

      const players = await freeboxHandler.loadPlayers();

      expect(players).to.deep.equal([]);
    });
  });

  describe('pollPlayer', () => {
    it('should emit power, volume and mute states when the player is running', async () => {
      const device = convertPlayer(freeboxPlayer);
      const requestStub = sinon.stub();
      requestStub
        .onFirstCall()
        .resolves({ data: { success: true, result: { power_state: 'running' } } })
        .onSecondCall()
        .resolves({ data: { success: true, result: { target: 'avr', valid: true, mute: false, volume: 64 } } });
      freeboxHandler.request = requestStub;

      await freeboxHandler.poll(device);

      expect(requestStub.firstCall.args[0].url).to.equal('/player/1/api/v7/status/');
      expect(requestStub.secondCall.args[0].url).to.equal('/player/1/api/v7/control/volume');

      assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: 'freebox:player:1:binary',
        state: 1,
      });
      assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: 'freebox:player:1:volume',
        state: 64,
      });
      assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: 'freebox:player:1:volume-mute',
        state: 0,
      });
    });

    it('should only emit power state when the player is in standby', async () => {
      const device = convertPlayer(freeboxPlayer);
      freeboxHandler.request = fake.resolves({ data: { success: true, result: { power_state: 'standby' } } });

      await freeboxHandler.poll(device);

      assert.calledOnce(freeboxHandler.request);
      assert.calledOnceWithExactly(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
        device_feature_external_id: 'freebox:player:1:binary',
        state: 0,
      });
    });
  });

  describe('setPlayerValue', () => {
    let device;

    beforeEach(() => {
      device = convertPlayer(freeboxPlayer);
      freeboxHandler.request = fake.resolves({ data: { success: true } });
    });

    it('should set the volume', async () => {
      const volumeFeature = device.features.find(
        (feature) => feature.type === DEVICE_FEATURE_TYPES.TELEVISION.VOLUME,
      );

      await freeboxHandler.setValue(device, volumeFeature, 50);

      assert.calledOnce(freeboxHandler.request);
      assert.calledWithMatch(freeboxHandler.request, {
        method: 'PUT',
        url: '/player/1/api/v7/control/volume',
        data: { volume: 50 },
      });
    });

    it('should mute the player', async () => {
      const muteFeature = device.features.find(
        (feature) => feature.type === DEVICE_FEATURE_TYPES.TELEVISION.VOLUME_MUTE,
      );

      await freeboxHandler.setValue(device, muteFeature, 1);

      assert.calledOnce(freeboxHandler.request);
      assert.calledWithMatch(freeboxHandler.request, {
        method: 'PUT',
        url: '/player/1/api/v7/control/volume',
        data: { mute: true },
      });
    });

    it('should send a media control command', async () => {
      const playFeature = device.features.find((feature) => feature.type === DEVICE_FEATURE_TYPES.TELEVISION.PLAY);

      await freeboxHandler.setValue(device, playFeature, 1);

      assert.calledOnce(freeboxHandler.request);
      assert.calledWithMatch(freeboxHandler.request, {
        method: 'POST',
        url: '/player/1/api/v7/control/mediactrl',
        data: { cmd: 'play' },
      });
    });

    it('should refresh the session token and retry when it has expired', async () => {
      const playFeature = device.features.find((feature) => feature.type === DEVICE_FEATURE_TYPES.TELEVISION.PLAY);
      const requestStub = sinon.stub();
      requestStub
        .onFirstCall()
        .rejects({ response: { status: 403, data: { error_code: 'auth_required' } } })
        .onSecondCall()
        .resolves({ data: { success: true } });
      freeboxHandler.request = requestStub;
      freeboxHandler.getSessionToken = fake.resolves('new-session-token');

      await freeboxHandler.setValue(device, playFeature, 1);

      assert.calledOnce(freeboxHandler.getSessionToken);
      expect(requestStub.secondCall.args[0].headers['X-Fbx-App-Auth']).to.equal('new-session-token');
    });
  });
});
