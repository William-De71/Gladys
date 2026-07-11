const { expect } = require('chai');
const sinon = require('sinon');
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');
const { EVENTS, MUSIC_PLAYBACK_STATE, WEBSOCKET_MESSAGE_TYPES } = require('../../../../utils/constants');

const serviceId = 'serviceId';

describe('Spotify refreshPlaybackState', () => {
  let spotifyHandler;
  let mockAgent;
  let apiMock;
  let originalDispatcher;
  let gladys;

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);
    mockAgent.disableNetConnect();
    apiMock = mockAgent.get('https://api.spotify.com');

    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      stateManager: {
        get: fake.returns({ last_value: null }),
      },
    };

    spotifyHandler = new SpotifyHandler(gladys, serviceId);
    spotifyHandler.configuration.clientId = 'test-client-id';
    spotifyHandler.configuration.clientSecret = 'test-client-secret';
    spotifyHandler.accessToken = 'valid-access-token';
    spotifyHandler.refreshToken = 'valid-refresh-token';
    spotifyHandler.tokenExpiresAt = Date.now() + 3600 * 1000;
  });

  afterEach(async () => {
    spotifyHandler.stopPollPlaybackState();
    sinon.reset();
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  });

  it('should emit playback state, volume and websocket playback of the active device', async () => {
    apiMock.intercept({ path: '/v1/me/player', method: 'GET' }).reply(200, {
      is_playing: true,
      progress_ms: 12000,
      device: {
        id: 'device-id-1',
        name: 'Living room speaker',
        volume_percent: 42,
      },
      item: {
        name: 'Around the World',
        duration_ms: 180000,
        artists: [{ name: 'Daft Punk' }],
        album: {
          name: 'Homework',
          images: [
            { url: 'https://image.spotify/large.jpg', height: 640, width: 640 },
            { url: 'https://image.spotify/medium.jpg', height: 300, width: 300 },
          ],
        },
      },
    });

    const playback = await spotifyHandler.refreshPlaybackState();

    sinon.assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-1:playback-state',
      state: MUSIC_PLAYBACK_STATE.PLAYING,
    });
    sinon.assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-1:volume',
      state: 42,
    });
    expect(playback).to.deep.equal({
      isPlaying: true,
      trackName: 'Around the World',
      artists: 'Daft Punk',
      albumName: 'Homework',
      artworkUrl: 'https://image.spotify/medium.jpg',
      deviceId: 'device-id-1',
      deviceName: 'Living room speaker',
      volumePercent: 42,
      progressMs: 12000,
      durationMs: 180000,
    });
    sinon.assert.calledWith(gladys.event.emit, EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.SPOTIFY.PLAYBACK,
      payload: playback,
    });
    expect(spotifyHandler.lastActiveDeviceId).to.equal('device-id-1');
  });

  it('should mark the previous active device as paused when playback moved', async () => {
    spotifyHandler.lastActiveDeviceId = 'device-id-old';
    apiMock.intercept({ path: '/v1/me/player', method: 'GET' }).reply(200, {
      is_playing: false,
      device: {
        id: 'device-id-1',
        name: 'Living room speaker',
        volume_percent: 42,
      },
    });

    await spotifyHandler.refreshPlaybackState();

    sinon.assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-old:playback-state',
      state: MUSIC_PLAYBACK_STATE.PAUSED,
    });
    sinon.assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-1:playback-state',
      state: MUSIC_PLAYBACK_STATE.PAUSED,
    });
  });

  it('should handle empty response when nothing is playing', async () => {
    spotifyHandler.lastActiveDeviceId = 'device-id-1';
    apiMock.intercept({ path: '/v1/me/player', method: 'GET' }).reply(204);

    const playback = await spotifyHandler.refreshPlaybackState();

    sinon.assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-1:playback-state',
      state: MUSIC_PLAYBACK_STATE.PAUSED,
    });
    expect(playback).to.equal(null);
    sinon.assert.calledWith(gladys.event.emit, EVENTS.WEBSOCKET.SEND_ALL, {
      type: WEBSOCKET_MESSAGE_TYPES.SPOTIFY.PLAYBACK,
      payload: null,
    });
    expect(spotifyHandler.lastActiveDeviceId).to.equal(null);
  });

  it('should not emit the polled volume right after a volume command', async () => {
    spotifyHandler.lastVolumeCommandAt = Date.now();
    apiMock.intercept({ path: '/v1/me/player', method: 'GET' }).reply(200, {
      is_playing: true,
      device: {
        id: 'device-id-1',
        name: 'Living room speaker',
        volume_percent: 42,
      },
    });

    await spotifyHandler.refreshPlaybackState();

    sinon.assert.calledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-1:playback-state',
      state: MUSIC_PLAYBACK_STATE.PLAYING,
    });
    sinon.assert.neverCalledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE, {
      device_feature_external_id: 'spotify:device-id-1:volume',
      state: 42,
    });
  });

  it('should not emit device states when the feature does not exist in Gladys', async () => {
    gladys.stateManager.get = fake.returns(null);
    apiMock.intercept({ path: '/v1/me/player', method: 'GET' }).reply(200, {
      is_playing: true,
      device: {
        id: 'device-id-1',
        name: 'Living room speaker',
        volume_percent: 42,
      },
    });

    await spotifyHandler.refreshPlaybackState();
    sinon.assert.neverCalledWith(gladys.event.emit, EVENTS.DEVICE.NEW_STATE);
  });

  it('should not throw when the API call fails', async () => {
    apiMock.intercept({ path: '/v1/me/player', method: 'GET' }).reply(500, 'Internal error');
    await spotifyHandler.refreshPlaybackState();
    sinon.assert.notCalled(gladys.event.emit);
  });
});
