const { expect } = require('chai');
const sinon = require('sinon');
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');
const { DEVICE_FEATURE_TYPES } = require('../../../../utils/constants');

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
};
const serviceId = 'serviceId';
const device = { external_id: 'spotify:device-id-1' };

describe('Spotify setValue', () => {
  let spotifyHandler;
  let mockAgent;
  let apiMock;
  let originalDispatcher;

  beforeEach(() => {
    sinon.reset();
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);
    mockAgent.disableNetConnect();
    apiMock = mockAgent.get('https://api.spotify.com');

    spotifyHandler = new SpotifyHandler(gladys, serviceId);
    spotifyHandler.configuration.clientId = 'test-client-id';
    spotifyHandler.configuration.clientSecret = 'test-client-secret';
    spotifyHandler.accessToken = 'valid-access-token';
    spotifyHandler.refreshToken = 'valid-refresh-token';
    spotifyHandler.tokenExpiresAt = Date.now() + 3600 * 1000;
    spotifyHandler.refreshPlaybackStateSoon = fake.returns(null);
  });

  afterEach(async () => {
    sinon.reset();
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  });

  it('should play on the device', async () => {
    apiMock.intercept({ path: '/v1/me/player/play', query: { device_id: 'device-id-1' }, method: 'PUT' }).reply(204);
    await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.PLAY }, 1);
    mockAgent.assertNoPendingInterceptors();
  });

  it('should pause on the device', async () => {
    apiMock.intercept({ path: '/v1/me/player/pause', query: { device_id: 'device-id-1' }, method: 'PUT' }).reply(204);
    await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.PAUSE }, 1);
    mockAgent.assertNoPendingInterceptors();
  });

  it('should skip to next track', async () => {
    apiMock.intercept({ path: '/v1/me/player/next', query: { device_id: 'device-id-1' }, method: 'POST' }).reply(204);
    await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.NEXT }, 1);
    mockAgent.assertNoPendingInterceptors();
  });

  it('should skip to previous track', async () => {
    apiMock
      .intercept({ path: '/v1/me/player/previous', query: { device_id: 'device-id-1' }, method: 'POST' })
      .reply(204);
    await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.PREVIOUS }, 1);
    mockAgent.assertNoPendingInterceptors();
  });

  it('should set the volume', async () => {
    apiMock
      .intercept({
        path: '/v1/me/player/volume',
        query: { volume_percent: '42', device_id: 'device-id-1' },
        method: 'PUT',
      })
      .reply(204);
    await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.VOLUME }, 42);
    mockAgent.assertNoPendingInterceptors();
    expect(spotifyHandler.lastVolumeCommandAt).to.be.greaterThan(0);
  });

  it('should throw a clear error when premium is required', async () => {
    apiMock.intercept({ path: '/v1/me/player/play', query: { device_id: 'device-id-1' }, method: 'PUT' }).reply(403, {
      error: { status: 403, message: 'Player command failed: Premium required', reason: 'PREMIUM_REQUIRED' },
    });

    try {
      await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.PLAY }, 1);
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.include('Premium');
    }
  });

  it('should ignore a redundant command rejected by Spotify (restriction violated)', async () => {
    apiMock.intercept({ path: '/v1/me/player/play', query: { device_id: 'device-id-1' }, method: 'PUT' }).reply(403, {
      error: { status: 403, message: 'Player command failed: Restriction violated', reason: 'RESTRICTION_VIOLATED' },
    });
    await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.PLAY }, 1);
    mockAgent.assertNoPendingInterceptors();
    sinon.assert.calledOnce(spotifyHandler.refreshPlaybackStateSoon);
  });

  it('should throw a not found error when the device is offline', async () => {
    apiMock
      .intercept({ path: '/v1/me/player/play', query: { device_id: 'device-id-1' }, method: 'PUT' })
      .reply(404, { error: { status: 404, message: 'Device not found' } });

    try {
      await spotifyHandler.setValue(device, { type: DEVICE_FEATURE_TYPES.MUSIC.PLAY }, 1);
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.include('Device not found');
    }
  });
});
