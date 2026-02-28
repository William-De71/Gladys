module.exports = (sequelize, DataTypes) => {
  const thermostatScheduleSlot = sequelize.define(
    't_thermostat_schedule_slot',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      schedule_id: {
        allowNull: false,
        type: DataTypes.UUID,
        references: {
          model: 't_thermostat_schedule',
          key: 'id',
        },
      },
      day_of_week: {
        allowNull: false,
        type: DataTypes.INTEGER,
      },
      start_time: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      end_time: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      preset: {
        allowNull: false,
        type: DataTypes.STRING,
      },
    },
    {},
  );

  thermostatScheduleSlot.associate = (models) => {
    thermostatScheduleSlot.belongsTo(models.ThermostatSchedule, {
      foreignKey: 'schedule_id',
      as: 'schedule',
    });
  };

  return thermostatScheduleSlot;
};
