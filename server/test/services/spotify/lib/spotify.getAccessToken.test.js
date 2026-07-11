const { expect } = require('chai');
const sinon = require('sinon');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');

const gladys = {
  event: {
    emit: fake.resolves(null),
  },
};
const serviceId = 'serviceId';

describe('Spotify getAccessToken', () => {
  let spotifyHandler;

  beforeEach(() => {
    sinon.reset();
    spotifyHandler = new SpotifyHandler(gladys, serviceId);
    spotifyHandler.refreshingTokens = fake(async () => {
      spotifyHandler.accessToken = 'refreshed-access-token';
      spotifyHandler.tokenExpiresAt = Date.now() + 3600 * 1000;
      return { success: true };
    });
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should throw an error if there is no refresh token', async () => {
    try {
      await spotifyHandler.getAccessToken();
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Spotify is not connected.');
    }
  });

  it('should return the current access token if still valid', async () => {
    spotifyHandler.refreshToken = 'refresh-token';
    spotifyHandler.accessToken = 'valid-access-token';
    spotifyHandler.tokenExpiresAt = Date.now() + 3600 * 1000;

    const accessToken = await spotifyHandler.getAccessToken();
    expect(accessToken).to.equal('valid-access-token');
    sinon.assert.notCalled(spotifyHandler.refreshingTokens);
  });

  it('should refresh the access token if expired', async () => {
    spotifyHandler.refreshToken = 'refresh-token';
    spotifyHandler.accessToken = 'expired-access-token';
    spotifyHandler.tokenExpiresAt = Date.now() - 1000;

    const accessToken = await spotifyHandler.getAccessToken();
    expect(accessToken).to.equal('refreshed-access-token');
    sinon.assert.calledOnce(spotifyHandler.refreshingTokens);
  });
});
