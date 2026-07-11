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

describe('Spotify retrieveTokens', () => {
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
    spotifyHandler.stateGetAccessToken = 'valid-state';
    spotifyHandler.codeVerifier = 'code-verifier';
    spotifyHandler.pollPlaybackState = fake.returns(null);
  });

  afterEach(async () => {
    sinon.reset();
    await mockAgent.close();
    setGlobalDispatcher(originalDispatcher);
  });

  it('should throw an error if spotify is not configured', async () => {
    spotifyHandler.configuration.clientId = null;
    try {
      await spotifyHandler.retrieveTokens({ codeOAuth: 'code', state: 'valid-state', redirectUri: 'uri' });
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Spotify is not configured.');
    }
  });

  it('should throw an error if the state does not match', async () => {
    try {
      await spotifyHandler.retrieveTokens({ codeOAuth: 'code', state: 'bad-state', redirectUri: 'uri' });
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.include('does not correspond');
    }
  });

  it('should retrieve tokens and start polling', async () => {
    accountsMock.intercept({ path: '/api/token', method: 'POST' }).reply(200, {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
    });

    const result = await spotifyHandler.retrieveTokens({
      codeOAuth: 'code',
      state: 'valid-state',
      redirectUri: 'http://127.0.0.1/callback',
    });
    expect(result).to.deep.equal({ success: true });
    expect(spotifyHandler.accessToken).to.equal('new-access-token');
    expect(spotifyHandler.refreshToken).to.equal('new-refresh-token');
    expect(spotifyHandler.status).to.equal('connected');
    expect(spotifyHandler.connected).to.equal(true);
    sinon.assert.calledOnce(spotifyHandler.pollPlaybackState);
  });

  it('should throw an error if spotify rejects the code', async () => {
    accountsMock.intercept({ path: '/api/token', method: 'POST' }).reply(400, { error: 'invalid_grant' });

    try {
      await spotifyHandler.retrieveTokens({
        codeOAuth: 'bad-code',
        state: 'valid-state',
        redirectUri: 'http://127.0.0.1/callback',
      });
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.include('SPOTIFY: Service is not connected');
    }
    expect(spotifyHandler.status).to.equal('disconnected');
  });
});
