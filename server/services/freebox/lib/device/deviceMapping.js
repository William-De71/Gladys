const { DEVICE_FEATURE_TYPES, DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_UNITS, COVER_STATE } = require('../../../../utils/constants');

const OPENING = 'opening';
const OCCUPANCY = 'motion';
const BATTERY = 'battery_warning';
const CONTROL = 'stop';
const POSITION = 'position';

const CAMERA = 'cam';
/*
const STATE = 'state';
const PUSHED = 'pushed';
const ALARM1 = 'alarm1';
*/

const mappings = {

  [OPENING]: {
    category: DEVICE_FEATURE_CATEGORIES.OPENING_SENSOR,
    type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
  },
    
  [OCCUPANCY]: {
    category: DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR,
    type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
  },
 
  [BATTERY]: {
    category: DEVICE_FEATURE_CATEGORIES.BATTERY,
    type: DEVICE_FEATURE_TYPES.BATTERY.INTEGER,
    unit: DEVICE_FEATURE_UNITS.PERCENT,
  },
  
  [CONTROL]: {
    category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
    type: DEVICE_FEATURE_TYPES.SHUTTER.STATE,
  },

  [POSITION]: {
    category: DEVICE_FEATURE_CATEGORIES.SHUTTER,
    type: DEVICE_FEATURE_TYPES.SHUTTER.POSITION,
  },
  
  [CAMERA]: {
    category: DEVICE_FEATURE_CATEGORIES.CAMERA,
    type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
  },

  /*
  [PUSHED]: {
    category: DEVICE_FEATURE_CATEGORIES.BUTTON,
    type: DEVICE_FEATURE_TYPES.BUTTON.CLICK,
  },

  [ALARM1]: {
    category: DEVICE_FEATURE_CATEGORIES.SWITCH,
    type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
  },

  [STATE]: {
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
  },
  */
};

const writeValues = {
  /*
  [DEVICE_FEATURE_CATEGORIES.SWITCH]: {
    [DEVICE_FEATURE_TYPES.SWITCH.BINARY]: (valueFromGladys) => {
      return valueFromGladys;  
    }
  },
  */
  [DEVICE_FEATURE_CATEGORIES.SHUTTER]: {
    [DEVICE_FEATURE_TYPES.SHUTTER.STATE]: (valueFromGladys) => {
      return valueFromGladys;
    },
    [DEVICE_FEATURE_TYPES.SHUTTER.POSITION]: (valueFromGladys) => {
      return 100 -  parseInt(valueFromGladys, 10);
    },
  },
};

const readValues = {
  [DEVICE_FEATURE_CATEGORIES.OPENING_SENSOR]: {
    [DEVICE_FEATURE_TYPES.SENSOR.BINARY]: (valueFromDevice) => {
      return valueFromDevice === true ? 1 : 0;       
    },
  },

  [DEVICE_FEATURE_CATEGORIES.MOTION_SENSOR]: {
    [DEVICE_FEATURE_TYPES.SENSOR.BINARY]: (valueFromDevice) => {
      return valueFromDevice === true ? 1 : 0;
    },
  },

  [DEVICE_FEATURE_CATEGORIES.BATTERY]: {
    [DEVICE_FEATURE_TYPES.BATTERY.INTEGER]: (valueFromDevice) => {
      return valueFromDevice;
    },
  },
  
  [DEVICE_FEATURE_CATEGORIES.SHUTTER]: {
    [DEVICE_FEATURE_TYPES.SHUTTER.STATE]: (valueFromDevice) => {
      return COVER_STATE.STOP;
    },
    [DEVICE_FEATURE_TYPES.SHUTTER.POSITION]: (valueFromDevice) => {
      return 100 - parseInt(valueFromDevice, 10);
    },
  },

  [DEVICE_FEATURE_CATEGORIES.CAMERA]: {
    [DEVICE_FEATURE_TYPES.CAMERA.IMAGE]: (valueFromDevice) => {
      return valueFromDevice;
    },
  },

  /*
  [DEVICE_FEATURE_CATEGORIES.BUTTON]: {
    [DEVICE_FEATURE_TYPES.BUTTON.CLICK]: (valueFromDevice) => {
      if (valueFromDevice === 1) {
        return BUTTON_STATUS.ARM_ALL_ZONES;
      }
      if (valueFromDevice === 2) {
        return BUTTON_STATUS.DISARM;
      }
      if (valueFromDevice === 3) {
        return BUTTON_STATUS.ARM_DAY_ZONES;
      }
      return BUTTON_STATUS.OFF;
    }
  },

  [DEVICE_FEATURE_CATEGORIES.TEXT]: {
    [DEVICE_FEATURE_TYPES.TEXT.TEXT]: (valueFromDevice) => {
      return valueFromDevice;
    }
  },
  */
};

module.exports = { mappings, readValues, writeValues };
