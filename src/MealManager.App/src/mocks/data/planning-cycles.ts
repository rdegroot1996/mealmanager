import { ApiPlanningCycle } from '../../app/api/models/api-planning-cycle';
import { DateTime } from 'luxon';

export const ACTIVE_CYCLE_ID = 'c3';

export function createPlanningCycles(now: DateTime = DateTime.local()): ApiPlanningCycle[] {
  const activeCycleStart = now.startOf('day').minus({ days: 1 });

  return [
    {
      id: 'c1',
      startDate: '2026-05-11',
      endDate: '2026-05-17',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'c2',
    },
    {
      id: 'c2',
      startDate: '2026-05-18',
      endDate: '2026-05-24',
      previousPlanningCycleId: 'c1',
      nextPlanningCycleId: 'c3',
    },
    {
      id: ACTIVE_CYCLE_ID,
      startDate: activeCycleStart.toISODate()!,
      endDate: activeCycleStart.plus({ days: 6 }).toISODate()!,
      previousPlanningCycleId: 'c2',
      nextPlanningCycleId: null,
    },
  ];
}

export const cycles = createPlanningCycles();
