import { ApiPlanningEntry, ApiPlanningNote } from '../../app/api/models/api-planning';
export interface MockPlanningLeftover {
  id: string;
  originalMealId: string;
  date: string;
  sortOrder: number;
}
export interface MockPlanning {
  id: string;
  planningCycleId: string;
  meals: ApiPlanningEntry[];
  leftovers: MockPlanningLeftover[];
  notes: ApiPlanningNote[];
}
