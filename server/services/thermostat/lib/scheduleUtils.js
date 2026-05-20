const DAY_MINUTES = 24 * 60; // 1440

/**
 * @description Convert a "HH:MM" time string to minutes from midnight.
 * @param {string} time - Time string in HH:MM format.
 * @returns {number} Minutes from midnight.
 * @example
 * timeToMinutes('08:30'); // 510
 */
const timeToMinutes = (time) => {
  if (!time) {
    return 0;
  }
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
};

/**
 * @description Convert minutes from midnight to a "HH:MM" time string.
 * Values exceeding DAY_MINUTES wrap around.
 * @param {number} mins - Minutes from midnight (may exceed 1440).
 * @returns {string} Time string in HH:MM format.
 * @example
 * minutesToTime(510); // '08:30'
 */
const minutesToTime = (mins) => {
  const m = ((mins % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * @description Apply a new or edited slot into a day's existing slot list.
 * Overlapping slots are trimmed/dropped and the predecessor is extended to close gaps.
 * A newEnd exceeding DAY_MINUTES generates an overflow slot for the next day.
 * @param {Array} existingDaySlots - Current slots for this day.
 * @param {number} dayOfWeek - Target day (0=Monday … 6=Sunday).
 * @param {number} newStart - Slot start in minutes from midnight.
 * @param {number} newEnd - Slot end in minutes (may exceed 1440 for overnight).
 * @param {string} newPreset - Preset name for the new slot.
 * @param {string|number} newKey - Unique key for the new slot.
 * @param {string|number|null} excludeKey - Key of the slot being replaced (edit), or null.
 * @returns {{ fixedSlots: Array, overflowSlot: object|null }} Adjusted slots and optional overflow.
 * @example
 * applySlotToDay([], 3, 480, 600, 'comfort', 'k1', null);
 */
const applySlotToDay = (existingDaySlots, dayOfWeek, newStart, newEnd, newPreset, newKey, excludeKey) => {
  const clampedEnd = Math.min(newEnd, DAY_MINUTES);
  const overflowMins = newEnd > DAY_MINUTES ? newEnd - DAY_MINUTES : 0;

  const slots = excludeKey ? existingDaySlots.filter((s) => s.key !== excludeKey) : existingDaySlots;

  const sortedByEnd = slots.slice().sort((a, b) => {
    const aEnd = timeToMinutes(a.end_time) || DAY_MINUTES;
    const bEnd = timeToMinutes(b.end_time) || DAY_MINUTES;
    return aEnd - bEnd;
  });

  let predecessorKey = null;
  let predecessorEnd = -1;
  sortedByEnd.forEach((s) => {
    const sEnd = timeToMinutes(s.end_time) || DAY_MINUTES;
    if (sEnd <= newStart && sEnd > predecessorEnd) {
      predecessorEnd = sEnd;
      predecessorKey = s.key;
    }
  });

  const adjusted = [];
  slots.forEach((s) => {
    const sStart = timeToMinutes(s.start_time);
    const sEndRaw = timeToMinutes(s.end_time);
    const sEnd = sEndRaw === 0 ? DAY_MINUTES : sEndRaw;

    if (sEnd <= newStart || sStart >= clampedEnd) {
      if (s.key === predecessorKey && sEnd < newStart) {
        adjusted.push({ ...s, end_time: minutesToTime(newStart) });
      } else {
        adjusted.push(s);
      }
    } else if (sStart < newStart && sEnd > clampedEnd) {
      adjusted.push({ ...s, end_time: minutesToTime(newStart) });
      adjusted.push({ ...s, start_time: minutesToTime(clampedEnd), key: `split-${s.key}` });
    } else if (sStart < newStart) {
      adjusted.push({ ...s, end_time: minutesToTime(newStart) });
    } else if (sEnd > clampedEnd) {
      adjusted.push({ ...s, start_time: minutesToTime(clampedEnd) });
    }
  });

  adjusted.push({
    day_of_week: dayOfWeek,
    start_time: minutesToTime(newStart),
    end_time: minutesToTime(clampedEnd),
    preset: newPreset,
    key: newKey,
  });

  const overflowSlot =
    overflowMins > 0
      ? {
          start_time: '00:00',
          end_time: minutesToTime(overflowMins),
          preset: newPreset,
          key: `overflow-${newKey}`,
        }
      : null;

  return { fixedSlots: adjusted, overflowSlot };
};

/**
 * @description Merge fixed day slots and optional overflow into the global slots array.
 * Overflow replaces next-day slots starting at 00:00.
 * @param {Array} allSlots - All slots across all days.
 * @param {number} dayOfWeek - The day whose slots were rebuilt.
 * @param {Array} taggedFixed - Rebuilt slots for dayOfWeek (already tagged with day_of_week).
 * @param {object|null} overflowSlot - Overflow slot for the next day, or null.
 * @returns {Array} Updated full slots array.
 * @example
 * // Replace all slots for day 0, no overflow:
 * mergeIntoSlots(allSlots, 0, fixedSlots, null);
 */
const mergeIntoSlots = (allSlots, dayOfWeek, taggedFixed, overflowSlot) => {
  if (!overflowSlot) {
    return [...allSlots.filter((s) => s.day_of_week !== dayOfWeek), ...taggedFixed];
  }
  const nextDay = (dayOfWeek + 1) % 7;
  const nextDayKept = allSlots.filter(
    (s) => s.day_of_week === nextDay && timeToMinutes(s.start_time) > 0,
  );
  const otherDays = allSlots.filter((s) => s.day_of_week !== dayOfWeek && s.day_of_week !== nextDay);
  return [...otherDays, ...taggedFixed, ...nextDayKept, { ...overflowSlot, day_of_week: nextDay }];
};

module.exports = { applySlotToDay, mergeIntoSlots, timeToMinutes, minutesToTime, DAY_MINUTES };
