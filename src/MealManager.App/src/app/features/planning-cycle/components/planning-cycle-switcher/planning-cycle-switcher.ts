import { Component, computed, inject, LOCALE_ID, input, output, signal } from '@angular/core';
import { finalize, Subscription } from 'rxjs';
import { PlanningCycleStore } from '../../state/planning-cycle.store';
import { planningDateParts } from '../../../../shared/utils/planning-date';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-planning-cycle-switcher',
  imports: [AppIcon],
  templateUrl: './planning-cycle-switcher.html',
})
export class PlanningCycleSwitcher {
  cycleStore = inject(PlanningCycleStore);
  private locale = inject(LOCALE_ID);
  readonly title = $localize`:@@planningCycle.chooseTitle:Planning cycles`;
  readonly activeLabel = $localize`:@@planningCycle.active:Active cycle`;
  readonly historicalLabel = $localize`:@@planningCycle.historical:Historical cycle`;
  range = computed(() => {
    const cycle = this.cycleStore.currentCycle();
    if (!cycle) return '';
    const startYear = cycle.startDate.slice(0, 4);
    const endYear = cycle.endDate.slice(0, 4);
    const start = planningDateParts(cycle.startDate, this.locale).shortDate;
    const end = planningDateParts(cycle.endDate, this.locale).shortDate;
    return start + (startYear !== endYear ? ' ' + startYear : '') + ' – ' + end + ' ' + endYear;
  });
  disabled = input(false);
  pending = signal(false);
  error = signal('');
  cycleChanged = output<string>();
  private request?: Subscription;
  private retryId: string | null = null;

  previous() {
    this.navigate(this.cycleStore.currentCycle()?.previousPlanningCycleId ?? null);
  }
  next() {
    this.navigate(this.cycleStore.currentCycle()?.nextPlanningCycleId ?? null);
  }
  returnToActive() {
    this.navigate('active');
  }
  retry() {
    this.navigate(this.retryId);
  }
  private navigate(id: string | null) {
    if (!id || this.disabled() || this.pending()) return;
    this.retryId = id;
    this.pending.set(true);
    this.error.set('');
    this.request = (
      id === 'active' ? this.cycleStore.loadCurrentCycle() : this.cycleStore.loadCycle(id)
    )
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: (cycle) => this.cycleChanged.emit(cycle.id),
        error: () =>
          this.error.set(
            $localize`:@@planning-cycle.planningCycleSwitcher.theCycleCouldNotBeLoadedPlease:The cycle could not be loaded. Please retry.`,
          ),
      });
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
}
