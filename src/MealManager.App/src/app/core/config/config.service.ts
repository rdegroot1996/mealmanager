import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiConfig } from '../../api/models/api-config';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);

  getConfig() {
    return this.http.get<ApiConfig>('/api/config');
  }

  initialize(command: { adminEmail: string; adminPassword: string; adminDisplayName: string }) {
    return this.http.post<void>('/api/config/initialize', command);
  }
}
