const { expect } = require('chai');
const sinon = require('sinon').createSandbox();
const Sequelize = require('sequelize');

const db = require('../../models');
const migration = require('../../migrations/20261107000000-scene-editor');

describe('migration 20261107000000-scene-editor', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should add a nullable JSON editor column to the scenes', async () => {
    const queryInterface = { addColumn: sinon.fake.resolves(null) };

    await migration.up(queryInterface, Sequelize);

    sinon.assert.calledOnceWithExactly(queryInterface.addColumn, 't_scene', 'editor', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  });

  it('should leave the existing scenes in the classic mode', async () => {
    const columns = await db.sequelize.getQueryInterface().describeTable('t_scene');
    expect(columns.editor).to.include({ allowNull: true });
    const scene = await db.Scene.findOne({ where: { selector: 'test-scene' }, raw: true });
    expect(scene.editor).to.equal(null);
  });

  it('should have nothing to undo', async () => {
    await migration.down();
  });
});
