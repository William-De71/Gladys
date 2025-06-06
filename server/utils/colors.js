/**
 * @description Converts int color to RGB object.
 * @param {number} intColor - Color between 0 and 16777215.
 * @returns {Array} [ red, green, blue ] object.
 * @example
 * const rgb = intToRgb(255);
 * {
 *  red: 255,
 *  blue: 0,
 *  green: 0,
 * }
 */
function intToRgb(intColor) {
  // eslint-disable-next-line no-bitwise
  const red = intColor >> 16;
  // eslint-disable-next-line no-bitwise
  const green = (intColor - (red << 16)) >> 8;
  // eslint-disable-next-line no-bitwise
  const blue = intColor - (red << 16) - (green << 8);

  return [red, green, blue];
}

/**
 * @description Convert hsb color to rgb.
 * @param {Array} hsb - Hue, saturation, brightness.
 * @param {number} maxSB - Max saturation and brightness.
 * @returns {Array} [ red, green, blue ] object.
 * @example const [r, g, b] = hsbToRgb([1, 2, 3]);
 */
function hsbToRgb(hsb, maxSB = 100) {
  const h = hsb[0];
  const s = hsb[1];
  const b = hsb[2];
  const sDivided = s / maxSB;
  const bDivided = b / maxSB;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => bDivided * (1 - sDivided * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return [Math.round(255 * f(5)), Math.round(255 * f(3)), Math.round(255 * f(1))];
}

/**
 * @description Convert rgb to hsb.
 * @param {Array} rgb - Rgb color.
 * @param {number} maxSB - Max saturation and brightness.
 * @returns {Array} [ h, s, b] object.
 * @example  const [h, s, b] = rgbToHsb([1, 2, 3]);
 */
function rgbToHsb(rgb, maxSB = 100) {
  let r = rgb[0];
  let g = rgb[1];
  let b = rgb[2];
  r /= 255;
  g /= 255;
  b /= 255;
  const v = Math.max(r, g, b);
  const n = v - Math.min(r, g, b);
  // eslint-disable-next-line no-nested-ternary
  const h = n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
  return [Math.round(60 * (h < 0 ? h + 6 : h)), Math.round(v && (n / v) * maxSB), Math.round(v * maxSB)];
}

/**
 * @description Converts RGB array color to int.
 * @param {Array} rgb - [red, green, blue ] array.
 * @returns {number} IntColor - Color between 0 and 16777215.
 * @example
 * const int = rgbToInt([ 255, 0, 0 ]);
 * console.log(hex === 255);
 */
function rgbToInt(rgb) {
  const [red, green, blue] = rgb;

  // eslint-disable-next-line no-bitwise
  return (red << 16) | (green << 8) | blue;
}

/**
 * @description Converts int color to HEX.
 * @param {number} intColor - Color between 0 and 16777215.
 * @returns {string} Hex string.
 * @example
 * const hex = intToHex(255);
 * console.log(hex === '0000FF');
 */
function intToHex(intColor) {
  return `${intColor.toString(16).padStart(6, '0')}`;
}

/**
 * @description Converts HEX color to int.
 * @param {string} hexColor - Hex string between 0 and FFFFFF.
 * @returns {number} Int color.
 * @example
 * const int = hexToInt('0000FF');
 * console.log(int === 255);
 */
function hexToInt(hexColor) {
  if (hexColor.startsWith('#')) {
    return parseInt(hexColor.substring(1), 16);
  }

  return parseInt(hexColor, 16);
}

/**
 * @description Convert Kelvin to RGB temp color.
 * @param {number} kelvin - Color temperature in Kelvin.
 * @returns {Array} - Return array of RGB.
 * @example const [r, g, b] = kelvinToRGB(2500);
 */
function kelvinToRGB(kelvin) {
  const temperature = kelvin / 100;
  let red;
  let green;
  let blue;

  // Calculate Red
  if (temperature <= 66) {
    red = 255;
  } else {
    red = temperature - 60;
    red = 329.698727446 * red ** -0.1332047592;
    if (red > 255) {
      red = 255;
    }
  }

  // Calculate Green
  if (temperature <= 66) {
    green = temperature;
    green = 99.4708025861 * Math.log(green) - 161.1195681661;
    if (green < 0) {
      green = 0;
    }
    if (green > 255) {
      green = 255;
    }
  } else {
    green = temperature - 60;
    green = 288.1221695283 * green ** -0.0755148492;
  }

  // Calculate Blue
  if (temperature >= 66) {
    blue = 255;
  } else if (temperature <= 19) {
    blue = 0;
  } else {
    blue = temperature - 10;
    blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
    if (blue < 0) {
      blue = 0;
    }
  }

  return [Math.round(red), Math.round(green), Math.round(blue)];
}

/**
 * @description Reverse Gamma correction applied in rgbToXy.
 * @param {number} value - Color value.
 * @returns {number} ReversedGammaCorrectedValue - Color with Gamma added.
 * @example
 * const value = getReversedGammaCorrectedValue(0,5);
 * console.log(value === 0.73535698305);
 */
function getReversedGammaCorrectedValue(value) {
  return value <= 0.0031308 ? 12.92 * value : (1.0 + 0.055) * value ** (1.0 / 2.4) - 0.055;
}

/**
 * @description Converts XY color (CIE 1931 color space) to int.
 * @param {number} x - X color.
 * @param {number} y - Y color.
 * @returns {number} Int color.
 * @example
 * const int = xyToInt(0.701, 0.299);
 * console.log(int === 16711680);
 */
function xyToInt(x, y) {
  const xy = {
    x,
    y,
  };

  // Compute XYZ values
  const Y = 1.0;
  const X = (Y / xy.y) * xy.x;
  const Z = (Y / xy.y) * (1.0 - xy.x - xy.y);

  // Convert to RGB using Wide RGB D50 conversion
  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;

  // Apply gamma Conversion
  r = getReversedGammaCorrectedValue(r);
  g = getReversedGammaCorrectedValue(g);
  b = getReversedGammaCorrectedValue(b);

  const max = Math.max(r, g, b);
  if (max > 1) {
    r /= max;
    g /= max;
    b /= max;
  }

  const red = Math.max(0, Math.round(r * 255));
  const green = Math.max(0, Math.round(g * 255));
  const blue = Math.max(0, Math.round(b * 255));

  // Convert to int
  // eslint-disable-next-line no-bitwise
  return (red << 16) | (green << 8) | blue;
}

/**
 * @description Converts int color to HSB (Hue, Saturation, Brightness).
 * @param {number} intColor - Color between 0 and 16777215.
 * @returns {Array} [hue, saturation, brightness] - Hue (0-360), Saturation (0-100), Brightness (0-100).
 * @example
 * const [h, s, b] = intToHsb(16711680); // Red
 * // Returns approximately [0, 100, 100]
 */
const intToHsb = (intColor) => {
  // Convert int to RGB first
  const [r, g, b] = intToRgb(intColor);
  // Then convert RGB to HSB
  return rgbToHsb([r, g, b]);
};

/**
 * @description Convert mired to kelvin.
 * @param {number} mired - Color temperature in mired.
 * @returns {number} Returns color in kelvin.
 * @example miredToKelvin(300);
 */
function miredToKelvin(mired) {
  return 1e6 / mired;
}

/**
 * @description Convert kelvin to mired.
 * @param {number} kelvin - Color temperature in kelvin.
 * @returns {number} Returns color in mired.
 * @example kelvinToMired(5000);
 */
function kelvinToMired(kelvin) {
  return 1e6 / kelvin;
}

module.exports = {
  intToRgb,
  rgbToInt,
  intToHex,
  hexToInt,
  xyToInt,
  hsbToRgb,
  rgbToHsb,
  intToHsb,
  miredToKelvin,
  kelvinToMired,
  kelvinToRGB,
};
