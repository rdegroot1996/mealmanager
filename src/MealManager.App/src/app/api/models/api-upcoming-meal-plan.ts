import { ApiPlannedEntry } from './api-meal-plan';

export interface ApiUpcomingMealPlan {
  fromDate: string;
  plannedDates: string[];
  entries: ApiPlannedEntry[];
}
