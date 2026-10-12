import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileSelect } from './profile-select';

@Component({
  imports: [ProfileSelect],
  template:
    '<app-profile-select [profiles]="profiles" [(selectedProfileId)]="selectedProfileId" />',
})
class HostComponent {
  profiles = [{ id: 'profile-1', name: 'Default', servings: 4 }];
  selectedProfileId = signal('');
}

describe('ProfileSelect', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('updates the selected profile', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'profile-1';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.selectedProfileId()).toBe('profile-1');
  });
});
