import { planningDateLabel, planningDateParts } from './planning-date';

describe('Planning date formatting', () => {
  it('uses the shared meal plan weekday and calendar-date format', () => {
    expect(planningDateParts('2026-08-22')).toEqual({ weekday: 'Sat', shortDate: '22 Aug' });
    expect(planningDateLabel('2026-08-22')).toBe('Sat 22 Aug');
  });

  it('uses Dutch weekday and day-month order in Dutch mode', () => {
    expect(planningDateParts('2026-08-22', 'nl-NL')).toEqual({
      weekday: 'za',
      shortDate: '22 aug',
    });
    expect(planningDateLabel('2026-08-22', 'nl-NL')).toBe('za 22 aug');
  });

  it('follows the selected locale when date order differs', () => {
    expect(planningDateParts('2026-08-22', 'en-US').shortDate).toBe('Aug 22');
    expect(planningDateParts('2026-08-22', 'ja-JP').shortDate).toBe('8月22日');
    expect(planningDateLabel('2026-08-22', 'en-US')).toBe('Sat, Aug 22');
    expect(planningDateLabel('2026-08-22', 'ja-JP')).toBe('8月22日(土)');
  });
});
