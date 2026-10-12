import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets setup state and posts the initial administrator details', () => {
    service.getConfig().subscribe();
    http.expectOne('/api/config').flush({ appInitialized: false });

    const command = {
      adminEmail: 'admin@example.com',
      adminPassword: 'Pass123!',
      adminDisplayName: 'Admin',
    };
    service.initialize(command).subscribe();
    const request = http.expectOne('/api/config/initialize');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(command);
    request.flush(null);
  });
});
