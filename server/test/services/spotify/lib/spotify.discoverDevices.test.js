const { expect } = require('chai');
const sinon = require('sinon');
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
};
const serviceId = 'serviceId';

describe('Spotify discoverDevices', () => {
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
  });

  afterEach(async () => {
    sinon.reset();
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  });

  it('should discover spotify connect devices', async () => {
    apiMock.intercept({ path: '/v1/me/player/devices', method: 'GET' }).reply(200, {
      devices: [
        {
          id: 'device-id-1',
          is_active: true,
          is_restricted: false,
          name: 'Living room speaker',
          type: 'Speaker',
          volume_percent: 59,
        },
        {
          id: 'device-id-2',
          is_active: false,
          is_restricted: true,
          name: 'Restricted device',
          type: 'Speaker',
          volume_percent: 100,
        },
      ],
    });

    const devices = await spotifyHandler.discoverDevices();
    expect(devices).to.have.lengthOf(1);
    expect(devices[0].name).to.equal('Living room speaker');
    expect(devices[0].external_id).to.equal('spotify:device-id-1');
    expect(devices[0].model).to.equal('Speaker');
    expect(devices[0].service_id).to.equal(serviceId);
    const featureTypes = devices[0].features.map((f) => f.type);
    expect(featureTypes).to.have.members(['play', 'pause', 'previous', 'next', 'volume', 'playback_state']);
  });

  it('should return an empty list when no device is online', async () => {
    apiMock.intercept({ path: '/v1/me/player/devices', method: 'GET' }).reply(200, { devices: [] });

    const devices = await spotifyHandler.discoverDevices();
    expect(devices).to.deep.equal([]);
  });
});
