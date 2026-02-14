const Promise = require('bluebird');
const { getDeviceFeaturesAggregates } = require('./device.getDeviceFeaturesAggregates');

/**
 * @description Get all features states aggregates.
 * @param {Array} selectors - Array of device feature selectors.
 * @param {number} intervalInMinutes - Interval.
 * @param {number} [maxStates] - Number of elements to return max.
 * @param {string} [groupBy] - Group results by time period ('hour', 'day', 'week', 'month', 'year').
 * @returns {Promise<any[]>} - Resolve with an array of array of data.
 * @example
 * device.getDeviceFeaturesAggregates('test-device');
 */
async function getDeviceFeaturesAggregatesMulti(selectors, intervalInMinutes, maxStates = 100, groupBy = null) {
  return Promise.map(
    selectors,
    async (selector) => {
      return getDeviceFeaturesAggregates.call(this, selector, intervalInMinutes, maxStates, groupBy);
    },
    { concurrency: 4 },
  );
}

module.exports = {
  getDeviceFeaturesAggregatesMulti,
};
