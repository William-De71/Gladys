const { expect } = require('chai');
const sinon = require('sinon');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');

const serviceId = 'serviceId';

describe('Spotify init', () => {
  let spotifyHandler;
  let gladys;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      variable: {
        getValue: sinon.stub().resolves(null),
        setValue: fake.resolves(null),
      },
    };
    spotifyHandler = new SpotifyHandler(gladys, serviceId);
    spotifyHandler.refreshingTokens = fake.resolves({ success: true });
    spotifyHandler.pollPlaybackState = fake.returns(null);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should stay not initialized when there is no configuration', async () => {
    await spotifyHandler.init();
    expect(spotifyHandler.configured).to.equal(false);
    expect(spotifyHandler.status).to.equal('not_initialized');
    sinon.assert.notCalled(spotifyHandler.refreshingTokens);
  });

  it('should be disconnected when configured without tokens', async () => {
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_ID', serviceId).resolves('client-id');
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_SECRET', serviceId).resolves('client-secret');

    await spotifyHandler.init();
    expect(spotifyHandler.configured).to.equal(true);
    expect(spotifyHandler.status).to.equal('disconnected');
    sinon.assert.notCalled(spotifyHandler.refreshingTokens);
  });

  it('should refresh tokens and start polling when tokens exist', async () => {
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_ID', serviceId).resolves('client-id');
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_SECRET', serviceId).resolves('client-secret');
    gladys.variable.getValue.withArgs('SPOTIFY_ACCESS_TOKEN', serviceId).resolves('access-token');
    gladys.variable.getValue.withArgs('SPOTIFY_REFRESH_TOKEN', serviceId).resolves('refresh-token');

    await spotifyHandler.init();
    sinon.assert.calledOnce(spotifyHandler.refreshingTokens);
    sinon.assert.calledOnce(spotifyHandler.pollPlaybackState);
  });

  it('should not throw when the token refresh fails at init', async () => {
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_ID', serviceId).resolves('client-id');
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_SECRET', serviceId).resolves('client-secret');
    gladys.variable.getValue.withArgs('SPOTIFY_ACCESS_TOKEN', serviceId).resolves('access-token');
    gladys.variable.getValue.withArgs('SPOTIFY_REFRESH_TOKEN', serviceId).resolves('refresh-token');
    spotifyHandler.refreshingTokens = fake.rejects(new Error('network error'));

    await spotifyHandler.init();
    sinon.assert.notCalled(spotifyHandler.pollPlaybackState);
  });
});
