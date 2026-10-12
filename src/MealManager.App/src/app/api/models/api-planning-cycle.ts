export interface ApiPlanningCycle {
  id: string;
  startDate: string;
  endDate: string;
  previousPlanningCycleId: string | null;
  nextPlanningCycleId: string | null;
}
