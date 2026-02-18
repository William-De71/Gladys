const { Op } = require('sequelize');
const db = require('../../models');

const DEFAULT_OPTIONS = {
  take: 50,
  skip: 0,
  order_dir: 'DESC',
};

/**
 * @description Get event logs with pagination and optional filters.
 * @param {object} [options] - Options.
 * @param {number} [options.take] - Number of items to return.
 * @param {number} [options.skip] - Number of items to skip.
 * @param {string} [options.type] - Filter by event type prefix (e.g. 'alarm.').
 * @param {string} [options.search] - Search term to filter by message.
 * @param {string} [options.from] - ISO date string, start of date range filter.
 * @param {string} [options.to] - ISO date string, end of date range filter.
 * @param {string} [options.order_dir] - Order direction (ASC or DESC).
 * @returns {Promise<object>} Object with rows and count.
 * @example
 * const { rows, count } = await eventLog.get({ take: 20, skip: 0 });
 */
async function get(options = {}) {
  const take = options.take || DEFAULT_OPTIONS.take;
  const skip = options.skip || DEFAULT_OPTIONS.skip;
  const orderDir = options.order_dir || DEFAULT_OPTIONS.order_dir;

  const where = {};

  if (options.type) {
    where.type = {
      [Op.like]: `${options.type}%`,
    };
  }

  if (options.search) {
    where.message = {
      [Op.like]: `%${options.search}%`,
    };
  }

  if (options.from || options.to) {
    where.created_at = {};
    if (options.from) {
      where.created_at[Op.gte] = new Date(options.from);
    }
    if (options.to) {
      where.created_at[Op.lte] = new Date(options.to);
    }
  }

  const { rows, count } = await db.EventLog.findAndCountAll({
    where,
    limit: take,
    offset: skip,
    order: [['created_at', orderDir]],
    raw: true,
  });

  // SQLite stores JSON as text; parse data field if it is a string
  const parsed = rows.map((row) => {
    if (typeof row.data === 'string') {
      try {
        return { ...row, data: JSON.parse(row.data) };
      } catch (e) {
        return row;
      }
    }
    return row;
  });

  return { rows: parsed, count };
}

module.exports = {
  get,
};
