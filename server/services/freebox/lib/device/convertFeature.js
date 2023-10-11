const logger = require('../../../../utils/logger');
const { mappings } = require('./deviceMapping');

/**
 * @description Transforms Freebox feature as Gladys feature.
 * @param {object} freeboxFunctions - Functions from Freebox.
 * @param {string} externalId - Gladys external ID.
 * @returns {object} Gladys feature or undefined.
 * @example
 * convertFeature({ name: 'switch', values: '{}' }, 'freebox:device_id');
 */
function convertFeature(freeboxFunctions, externalId) {
  const { ep_id: epId, label, name } = freeboxFunctions;
    
  let readOnly = false;
  if (freeboxFunctions.ui !== null) {
    const { access } = freeboxFunctions.ui;
    if (access === 'r') {
      readOnly = true;
    }
  }

  let mapping = null;
  if (name === 'trigger') {
    if (label === 'Détection') {
      mapping = 'motion';
    } else if (label === 'État') {
      mapping = 'opening';
    }
  } else {
    mapping = name;
  }
  
  const featuresCategoryAndType = mappings[mapping];
  if (!featuresCategoryAndType) {
    logger.warn(`Freebox function with "${mapping}" is not managed`);
    return undefined;
  }
  
  const feature = {
    name,
    external_id: `${externalId}:${epId}`,
    selector: `${externalId}:${epId}`,
    read_only: readOnly,
    keep_history: true,
    has_feedback: false,
    min: 0,
    max: 1,
    ...featuresCategoryAndType,
  };

  if ((mapping === 'position') || (mapping === 'battery_warning')) {
    feature.max = 100;
  }

  if ((mapping === 'cam') || (mapping === 'state')) {
    feature.max = 0;
    feature.read_only = false;
    feature.keep_history = false;
  }
  
  return feature;
}

module.exports = {
  convertFeature,
};
