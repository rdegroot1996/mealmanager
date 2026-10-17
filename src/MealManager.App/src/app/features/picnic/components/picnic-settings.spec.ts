import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { PicnicSettings } from './picnic-settings';
import { PicnicStore } from '../state/picnic.store';
import { ApiPicnicConnection } from '../../../api/models/api-picnic';

describe('Picnic settings management', () => {
  const disconnected: ApiPicnicConnection = {
    status: 'Disconnected',
    accountLabel: null,
    countryCode: 'NL',
  };
  const verification: ApiPicnicConnection = {
    ...disconnected,
    status: 'VerificationRequired',
    accountLabel: 'home@example.test',
  };
  const connected: ApiPicnicConnection = { ...verification, status: 'Connected' };
  async function setup(connection = disconnected) {
    const store = {
      connection: vi.fn(() => of(connection)),
      connect: vi.fn(() => of(verification)),
      requestCode: vi.fn(() => of(verification)),
      verify: vi.fn(() => of(connected)),
      disconnect: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: PicnicStore, useValue: store }] });
    const fixture = TestBed.createComponent(PicnicSettings);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const open = vi.spyOn(component.management()!, 'open').mockImplementation(() => {});
    const close = vi.spyOn(component.management()!, 'close').mockImplementation(() => {});
    return { fixture, component, store, open, close };
  }
  it('opens a fresh connection draft and clears credentials on dismissal', async () => {
    const { component, open } = await setup();
    component.manage();
    expect(open).toHaveBeenCalledOnce();
    expect(component.editing()).toBe(true);
    component.password = 'unsaved';
    component.code = '1234';
    component.closeManagement();
    expect(component.password).toBe('');
    expect(component.code).toBe('');
    expect(component.editing()).toBe(false);
  });
  it('protects entered credentials and verification drafts without prompting on an untouched form', async () => {
    const { component } = await setup();
    const discard = vi.spyOn(component.discardModal(), 'confirmDiscard').mockResolvedValue(false);
    component.manage();
    expect(await component.beforeDismiss()).toBe(true);
    component.password = 'unsaved';
    expect(await component.beforeDismiss()).toBe(false);
    component.connection.set(verification);
    component.code = '';
    expect(await component.beforeDismiss()).toBe(true);
    component.code = '123456';
    expect(await component.beforeDismiss()).toBe(false);
    component.closeManagement();
    expect(component.password).toBe('');
    expect(component.code).toBe('');
    expect(discard).toHaveBeenCalledTimes(2);
  });
  it('retains SMS verification inside management and closes after successful verification', async () => {
    const { component, store, close } = await setup();
    component.manage();
    component.email = 'home@example.test';
    component.password = 'test-password';
    component.connect();
    expect(store.connect).toHaveBeenCalledWith('home@example.test', 'test-password', 'NL', false);
    expect(component.password).toBe('');
    expect(component.connection()?.status).toBe('VerificationRequired');
    expect(store.requestCode).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    component.code = '1234';
    component.verify();
    expect(store.verify).toHaveBeenCalledWith('1234');
    expect(close).toHaveBeenCalledOnce();
    expect(component.connection()?.status).toBe('Connected');
  });
  it('shows a connected account without opening an unnecessary reconnect draft', async () => {
    const { component, store, close } = await setup(connected);
    component.manage();
    expect(component.editing()).toBe(false);
    component.disconnect();
    expect(store.disconnect).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('focuses SMS entry after the code request re-enables its controls', async () => {
    const { fixture, component, store } = await setup(connected);
    const codeRequest = new Subject<ApiPicnicConnection>();
    store.requestCode.mockReturnValue(codeRequest);
    const focus = vi.spyOn(component.management()!, 'focusFirstControl');
    component.manage();
    component.start();
    component.connect();
    await fixture.whenStable();
    expect(component.busy()).toBe(true);
    focus.mockClear();
    codeRequest.next(verification);
    codeRequest.complete();
    await fixture.whenStable();
    expect(component.busy()).toBe(false);
    expect(fixture.nativeElement.querySelector('#picnic-code').disabled).toBe(false);
    expect(focus).toHaveBeenCalledOnce();
  });
});
