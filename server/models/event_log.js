module.exports = (sequelize, DataTypes) => {
  const eventLog = sequelize.define(
    't_event_log',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      type: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      message: {
        allowNull: false,
        type: DataTypes.STRING,
      },
      icon: {
        allowNull: true,
        type: DataTypes.STRING,
      },
      data: {
        allowNull: true,
        type: DataTypes.JSON,
      },
    },
    {},
  );

  return eventLog;
};
