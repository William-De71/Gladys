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

describe('Spotify connect', () => {
  let spotifyHandler;

  beforeEach(() => {
    sinon.reset();
    spotifyHandler = new SpotifyHandler(gladys, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should throw an error if spotify is not configured', async () => {
    try {
      await spotifyHandler.connect();
      expect.fail('should have thrown an error');
    } catch (e) {
      expect(e.message).to.equal('Spotify is not configured.');
    }
  });

  it('should return auth url and state if spotify is configured', async () => {
    spotifyHandler.configuration.clientId = 'test-client-id';
    spotifyHandler.configuration.clientSecret = 'test-client-secret';

    const result = await spotifyHandler.connect();
    expect(result).to.have.property('authUrl');
    expect(result).to.have.property('state');
    expect(result.authUrl).to.include('https://accounts.spotify.com/authorize');
    expect(result.authUrl).to.include('client_id=test-client-id');
    expect(result.authUrl).to.include('code_challenge=');
    expect(result.authUrl).to.include('code_challenge_method=S256');
    expect(spotifyHandler.configured).to.equal(true);
    expect(spotifyHandler.codeVerifier).to.be.a('string');
  });
});
