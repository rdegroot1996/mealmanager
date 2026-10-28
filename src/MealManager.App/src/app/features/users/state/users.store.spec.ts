import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiUser } from '../../../api/models/api-user';
import { UsersStore } from './users.store';

describe('UsersStore', () => {
  let store: UsersStore;
  let http: HttpTestingController;

  const admin: ApiUser = {
    id: 'admin-id',
    email: 'admin@example.test',
    displayName: 'Admin',
    isAdmin: true,
    mustChangePassword: false,
  };
  const member: ApiUser = {
    id: 'member-id',
    email: 'member@example.test',
    displayName: 'Member',
    isAdmin: false,
    mustChangePassword: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(UsersStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads users sorted by display name', () => {
    store.loadUsers().subscribe();
    http.expectOne('/api/users').flush([member, admin]);
    expect(store.users().map(({ displayName }) => displayName)).toEqual(['Admin', 'Member']);
  });

  it('creates and retains the returned user', () => {
    store.users.set([admin]);
    store
      .saveUser(null, {
        email: member.email,
        password: 'Pass123!',
        displayName: member.displayName,
        isAdmin: false,
      })
      .subscribe();

    const request = http.expectOne('/api/users');
    expect(request.request.method).toBe('POST');
    request.flush(member);
    expect(store.users()).toEqual([admin, member]);
  });

  it('updates and removes users in local state', () => {
    store.users.set([admin, member]);
    store.saveUser(member.id, { displayName: 'New name', isAdmin: true }).subscribe();
    const update = http.expectOne(`/api/users/${member.id}`);
    expect(update.request.body).toEqual({ displayName: 'New name', isAdmin: true });
    update.flush({ ...member, displayName: 'New name', isAdmin: true });
    expect(store.users().find(({ id }) => id === member.id)?.isAdmin).toBe(true);

    store.deleteUser(member.id).subscribe();
    http.expectOne(`/api/users/${member.id}`).flush(null);
    expect(store.users()).toEqual([admin]);
  });
});
