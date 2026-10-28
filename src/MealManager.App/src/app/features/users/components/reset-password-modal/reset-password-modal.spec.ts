import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResetPasswordModal } from './reset-password-modal';
import { ApiUser } from '../../../../api/models/api-user';
import { ToastService } from '../../../../shared/services/toast.service';

describe('ResetPasswordModal', () => {
  it('clears the temporary password and ignores a late response after destruction', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(ResetPasswordModal);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const user: ApiUser = {
      id: 'member',
      email: 'member@example.test',
      displayName: 'Member',
      isAdmin: false,
      mustChangePassword: false,
    };
    fixture.detectChanges();
    vi.spyOn(component.modal(), 'open').mockImplementation(() => {});
    const close = vi.spyOn(component.modal(), 'close');
    component.open(user);
    component.password.set('Temporary123!');
    component.save();
    const reset = http.expectOne('/api/users/member/reset-password');
    expect(reset.request.body).toEqual({ temporaryPassword: 'Temporary123!' });

    fixture.destroy();
    expect(component.password()).toBe('');
    reset.flush(null);
    expect(close).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    http.verify();
  });
});
