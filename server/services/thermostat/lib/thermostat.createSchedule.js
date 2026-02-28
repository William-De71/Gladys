const db = require('../../../models');
const { slugify } = require('../../../utils/slugify');
const logger = require('../../../utils/logger');

/**
 * @description Create a thermostat schedule with its slots.
 * @param {object} scheduleData - Schedule data: { name, slots }.
 * @returns {Promise<object>} Created schedule.
 * @example
 * await thermostatHandler.createSchedule({ name: 'Vacances', slots: [] });
 */
async function createSchedule(scheduleData) {
  logger.info(`Thermostat: Creating schedule "${scheduleData.name}"`);

  const existing = await db.ThermostatSchedule.findOne({ where: { name: scheduleData.name } });
  if (existing) {
    throw new Error(`A schedule with the name "${scheduleData.name}" already exists`);
  }

  const selector = slugify(`${scheduleData.name}-${Date.now()}`, true);

  const created = await db.ThermostatSchedule.create(
    {
      name: scheduleData.name,
      selector,
      slots: (scheduleData.slots || []).map((slot) => ({
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
        preset: slot.preset,
      })),
    },
    { include: [{ model: db.ThermostatScheduleSlot, as: 'slots' }] },
  );

  const result = await db.ThermostatSchedule.findByPk(created.id, {
    include: [{ model: db.ThermostatScheduleSlot, as: 'slots' }],
  });
  return result.get({ plain: true });
}

module.exports = { createSchedule };
