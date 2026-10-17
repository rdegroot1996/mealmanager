import { ApiPlannedEntry, ApiPlanningDayNote } from '../../app/api/models/api-meal-plan';
export interface MockPlannedLeftover {
  id: string;
  originalMealId: string;
  date: string;
  sortOrder: number;
}
export interface MockMealPlan {
  id: string;
  planningCycleId: string;
  meals: ApiPlannedEntry[];
  leftovers: MockPlannedLeftover[];
  notes: ApiPlanningDayNote[];
}
