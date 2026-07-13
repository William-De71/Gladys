const { expect } = require('chai');
const sinon = require('sinon');

const { fake, assert } = sinon;

const System = require('../../../lib/system');
const { getLocalIp } = require('../../../lib/system/system.getInfos');
const Job = require('../../../lib/job');

const sequelize = {
  close: fake.resolves(null),
};

const event = {
  on: fake.resolves(null),
  emit: fake.resolves(null),
};

const job = new Job(event);

const config = {
  tempFolder: '/tmp/gladys',
};

describe('system.getInfos', () => {
  let system;

  beforeEach(async () => {
    system = new System(sequelize, event, config, job);
    await system.init();
    // Reset all fakes invoked within init call
    sinon.reset();
  });

  afterEach(() => {
    sinon.reset();
  });

  it('should get infos (no release available)', async () => {
    const infos = await system.getInfos();
    expect(infos).to.have.property('hostname');
    expect(infos).to.have.property('type');
    expect(infos).to.have.property('platform');
    expect(infos).to.have.property('arch');
    expect(infos).to.have.property('release');
    expect(infos).to.have.property('uptime');
    expect(infos).to.have.property('loadavg');
    expect(infos).to.have.property('totalmem');
    expect(infos).to.have.property('freemem');
    expect(infos).to.have.property('cpus');
    expect(infos).to.have.property('network_interfaces');
    expect(infos).to.have.property('local_ip');
    expect(infos).to.have.property('server_port');
    expect(infos).to.have.property('nodejs_version');
    expect(infos).to.have.property('gladys_version');
    expect(infos).to.have.property('latest_gladys_version', undefined);
    expect(infos).to.have.property('new_release_available', false);
    expect(infos.gladys_version.substr(0, 1)).to.equal('v');

    assert.notCalled(sequelize.close);
    assert.notCalled(event.on);
  });

  it('should get infos (new release available)', async () => {
    system.gladysVersion = `v1.0.0`;
    system.latestGladysVersion = `v2.0.0`;

    const infos = await system.getInfos();
    expect(infos).to.have.property('hostname');
    expect(infos).to.have.property('type');
    expect(infos).to.have.property('platform');
    expect(infos).to.have.property('arch');
    expect(infos).to.have.property('release');
    expect(infos).to.have.property('uptime');
    expect(infos).to.have.property('loadavg');
    expect(infos).to.have.property('totalmem');
    expect(infos).to.have.property('freemem');
    expect(infos).to.have.property('cpus');
    expect(infos).to.have.property('network_interfaces');
    expect(infos).to.have.property('nodejs_version');
    expect(infos).to.have.property('gladys_version', 'v1.0.0');
    expect(infos).to.have.property('latest_gladys_version', 'v2.0.0');
    expect(infos).to.have.property('new_release_available', true);
    expect(infos.gladys_version.substr(0, 1)).to.equal('v');

    assert.notCalled(sequelize.close);
    assert.notCalled(event.on);
  });
});

describe('system.getLocalIp', () => {
  it('should prioritize wired connection over wireless', () => {
    const networkInterfaces = {
      lo: [
        { address: '127.0.0.1', family: 'IPv4', internal: true },
        { address: '::1', family: 'IPv6', internal: true },
      ],
      wlan0: [{ address: '192.168.1.51', family: 4, internal: false }],
      eth0: [
        { address: 'fe80::1', family: 'IPv6', internal: false },
        { address: '192.168.1.50', family: 'IPv4', internal: false },
      ],
    };
    expect(getLocalIp(networkInterfaces)).to.equal('192.168.1.50');
  });

  it('should return the wireless address when no wired interface exists', () => {
    const networkInterfaces = {
      wlp2s0: [{ address: '192.168.1.51', family: 'IPv4', internal: false }],
    };
    expect(getLocalIp(networkInterfaces)).to.equal('192.168.1.51');
  });

  it('should ignore virtual docker interfaces', () => {
    const networkInterfaces = {
      docker0: [{ address: '172.17.0.1', family: 'IPv4', internal: false }],
      'br-12345': [{ address: '172.18.0.1', family: 'IPv4', internal: false }],
      vethabc123: [{ address: '169.254.0.1', family: 'IPv4', internal: false }],
      enp3s0: [{ address: '192.168.1.50', family: 'IPv4', internal: false }],
    };
    expect(getLocalIp(networkInterfaces)).to.equal('192.168.1.50');
  });

  it('should return null when no external IPv4 exists', () => {
    expect(getLocalIp({})).to.equal(null);
    expect(getLocalIp({ lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }] })).to.equal(null);
  });
});
