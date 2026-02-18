module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('t_event_log', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
      },
      type: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      message: {
        allowNull: false,
        type: Sequelize.STRING,
      },
      icon: {
        allowNull: true,
        type: Sequelize.STRING,
      },
      data: {
        allowNull: true,
        type: Sequelize.JSON,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    await queryInterface.addIndex('t_event_log', ['type']);
    await queryInterface.addIndex('t_event_log', ['created_at']);
  },
  down: async (queryInterface, Sequelize) => queryInterface.dropTable('t_event_log'),
};
