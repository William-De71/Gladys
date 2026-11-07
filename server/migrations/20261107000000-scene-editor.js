// How a scene is edited: classic step list, graph canvas or code, with the layout of the canvas
// (docs/specs/scene-editor-modes.md B.1). Null is the classic mode, so existing scenes are
// unchanged.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('t_scene', 'editor', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },
  // Purely additive: an older Gladys ignores the extra nullable column.
  down: async () => {},
};
