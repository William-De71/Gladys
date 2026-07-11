const { expect } = require('chai');
const sinon = require('sinon');

const { fake } = sinon;

const SpotifyHandler = require('../../../../services/spotify/lib/index');

const serviceId = 'serviceId';

describe('Spotify configuration and status', () => {
  let spotifyHandler;
  let gladys;

  beforeEach(() => {
    gladys = {
      event: {
        emit: fake.resolves(null),
      },
      variable: {
        getValue: sinon.stub(),
        setValue: fake.resolves(null),
      },
    };
    spotifyHandler = new SpotifyHandler(gladys, serviceId);
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should get the configuration', async () => {
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_ID', serviceId).resolves('client-id');
    gladys.variable.getValue.withArgs('SPOTIFY_CLIENT_SECRET', serviceId).resolves('client-secret');

    const configuration = await spotifyHandler.getConfiguration();
    expect(configuration).to.deep.equal({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
  });

  it('should save the configuration', async () => {
    const result = await spotifyHandler.saveConfiguration({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    expect(result).to.equal(true);
    sinon.assert.calledWith(gladys.variable.setValue, 'SPOTIFY_CLIENT_ID', 'client-id', serviceId);
    sinon.assert.calledWith(gladys.variable.setValue, 'SPOTIFY_CLIENT_SECRET', 'client-secret', serviceId);
    expect(spotifyHandler.configuration.clientId).to.equal('client-id');
  });

  it('should return false if the configuration save fails', async () => {
    gladys.variable.setValue = fake.rejects(new Error('DB error'));
    const result = await spotifyHandler.saveConfiguration({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });
    expect(result).to.equal(false);
  });

  it('should get the status', () => {
    const status = spotifyHandler.getStatus();
    expect(status).to.deep.equal({
      configured: false,
      connected: false,
      status: 'not_initialized',
    });
  });

  it('should save the connected status', () => {
    spotifyHandler.saveStatus({ statusType: 'connected', message: null });
    expect(spotifyHandler.connected).to.equal(true);
    expect(spotifyHandler.configured).to.equal(true);
    expect(spotifyHandler.status).to.equal('connected');
    sinon.assert.called(gladys.event.emit);
  });

  it('should save the disconnected status and stop polling', () => {
    spotifyHandler.pollPlaybackStateInterval = setInterval(() => {}, 100000);
    spotifyHandler.saveStatus({ statusType: 'disconnected', message: null });
    expect(spotifyHandler.connected).to.equal(false);
    expect(spotifyHandler.pollPlaybackStateInterval).to.equal(undefined);
  });
});
