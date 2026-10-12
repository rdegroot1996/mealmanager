import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/auth.service';
import { UserFormModal } from './user-form-modal';

describe('UserFormModal', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserFormModal],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('validates required create fields before sending a request', () => {
    const fixture = TestBed.createComponent(UserFormModal);
    fixture.detectChanges();
    fixture.componentInstance.save();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Enter a display name.');
    http.expectNone('/api/users');
  });

  it('keeps the current administrator role locked while allowing name edits', () => {
    const currentUser = {
      id: 'admin-id',
      email: 'admin@example.test',
      displayName: 'Admin',
      isAdmin: true,
    };
    TestBed.inject(AuthService).currentUser.set(currentUser);
    const fixture = TestBed.createComponent(UserFormModal);
    fixture.componentInstance.user.set(currentUser);
    fixture.componentInstance.displayName.set(currentUser.displayName);
    fixture.componentInstance.email.set(currentUser.email);
    fixture.componentInstance.isAdmin.set(true);
    fixture.detectChanges();

    const displayName = fixture.nativeElement.querySelector(
      '#user-display-name',
    ) as HTMLInputElement;
    const admin = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(displayName.disabled).toBe(false);
    expect(admin.disabled).toBe(true);
  });

  it('hands removal to confirmation only for another user and while idle', () => {
    const currentUser = {
      id: 'self',
      email: 'self@example.test',
      displayName: 'Self',
      isAdmin: true,
    };
    const otherUser = { ...currentUser, id: 'other', displayName: 'Other' };
    TestBed.inject(AuthService).currentUser.set(currentUser);
    const fixture = TestBed.createComponent(UserFormModal);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const close = vi.spyOn(component.modal(), 'close').mockImplementation(() => {});
    const removed = vi.spyOn(component.removed, 'emit');
    component.user.set(currentUser);
    component.requestRemoval();
    expect(removed).not.toHaveBeenCalled();
    component.user.set(otherUser);
    component.saving.set(true);
    component.requestRemoval();
    expect(removed).not.toHaveBeenCalled();
    component.saving.set(false);
    component.requestRemoval();
    expect(close).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledWith(otherUser);
    http.expectNone('/api/users/other');
  });
});
