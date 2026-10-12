import { ApiPlanningEntry } from './api-planning';

export interface ApiUpcomingPlanning {
  fromDate: string;
  plannedDates: string[];
  entries: ApiPlanningEntry[];
}
