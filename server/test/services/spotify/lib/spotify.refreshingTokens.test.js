const { expect } = require('chai');
const sinon = require('sinon');
const { MockAgent, setGlobalDispatcher, getGlobalDispatcher } = require('undici');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
  variable: {
    setValue: fake.resolves(null),
  },
};
const serviceId = 'serviceId';

describe('Spotify refreshingTokens', () => {
  let spotifyHandler;
  let mockAgent;
  let accountsMock;
  let originalDispatcher;

  beforeEach(() => {
    sinon.reset();
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    setGlobalDispatcher(mockAgent);
    mockAgent.disableNetConnect();
    accountsMock = mockAgent.get('https://accounts.spotify.com');

    spotifyHandler = new SpotifyHandler(gladys, serviceId);
    spotifyHandler.configuration.clientId = 'test-client-id';
    spotifyHandler.configuration.clientSecret = 'test-client-secret';
    spotifyHandler.accessToken = 'old-access-token';
    spotifyHandler.refreshToken = 'valid-refresh-token';
  });

  afterEach(async () => {
    sinon.reset();
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  });

  it('should throw an error if spotify is not configured', async () => {
    spotifyHandler.configuration.clientId = null;
    try {
      await spotifyHandler.refreshingTokens();
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Spotify is not configured.');
    }
  });

  it('should throw an error if there is no refresh token', async () => {
    spotifyHandler.refreshToken = null;
    try {
      await spotifyHandler.refreshingTokens();
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Spotify is not connected.');
    }
  });

  it('should refresh the access token and keep the current refresh token', async () => {
    accountsMock.intercept({ path: '/api/token', method: 'POST' }).reply(200, {
      access_token: 'new-access-token',
      expires_in: 3600,
    });

    const result = await spotifyHandler.refreshingTokens();
    expect(result).to.deep.equal({ success: true });
    expect(spotifyHandler.accessToken).to.equal('new-access-token');
    expect(spotifyHandler.refreshToken).to.equal('valid-refresh-token');
    expect(spotifyHandler.status).to.equal('connected');
  });

  it('should store the new refresh token when spotify returns one', async () => {
    accountsMock.intercept({ path: '/api/token', method: 'POST' }).reply(200, {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    });

    await spotifyHandler.refreshingTokens();
    expect(spotifyHandler.refreshToken).to.equal('new-refresh-token');
  });

  it('should keep tokens on transient HTTP error', async () => {
    accountsMock.intercept({ path: '/api/token', method: 'POST' }).reply(503, 'Service unavailable');

    try {
      await spotifyHandler.refreshingTokens();
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.include('Transient HTTP 503');
    }
    expect(spotifyHandler.refreshToken).to.equal('valid-refresh-token');
  });

  it('should clear tokens on fatal HTTP error', async () => {
    accountsMock.intercept({ path: '/api/token', method: 'POST' }).reply(400, { error: 'invalid_grant' });

    try {
      await spotifyHandler.refreshingTokens();
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.include('HTTP error 400');
    }
    expect(spotifyHandler.refreshToken).to.equal('');
    expect(spotifyHandler.status).to.equal('disconnected');
  });
});
