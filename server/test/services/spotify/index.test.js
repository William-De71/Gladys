const sinon = require('sinon');
const { expect } = require('chai');
const proxyquire = require('proxyquire').noCallThru();

const { assert, fake } = sinon;

const SpotifyHandlerMock = sinon.stub();
SpotifyHandlerMock.prototype.init = fake.returns(null);
SpotifyHandlerMock.prototype.stopPollPlaybackState = fake.returns(null);
SpotifyHandlerMock.prototype.status = 'not_initialized';

const SpotifyService = proxyquire('../../../services/spotify/index', { './lib': SpotifyHandlerMock });

const gladys = {};
const serviceId = 'ffa13430-df93-488a-9733-5c540e9558e0';

describe('SpotifyService', () => {
  const spotifyService = SpotifyService(gladys, serviceId);

  beforeEach(() => {
    sinon.reset();
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should start service', async () => {
    await spotifyService.start();
    assert.calledOnce(spotifyService.device.init);
  });

  it('should stop service', async () => {
    await spotifyService.stop();
    assert.calledOnce(spotifyService.device.stopPollPlaybackState);
  });

  it('isUsed: should return false, service not connected', async () => {
    const used = await spotifyService.isUsed();
    expect(used).to.equal(false);
  });

  it('isUsed: should return true, service connected', async () => {
    spotifyService.device.status = 'connected';
    const used = await spotifyService.isUsed();
    expect(used).to.equal(true);
    spotifyService.device.status = 'not_initialized';
  });
});
