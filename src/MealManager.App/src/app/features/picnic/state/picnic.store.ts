import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiPicnicConnection } from '../../../api/models/api-picnic';

@Injectable({ providedIn: 'root' })
export class PicnicStore {
  private http = inject(HttpClient);
  private readonly url = '/api/integrations/picnic';
  connection() {
    return this.http.get<ApiPicnicConnection>(`${this.url}/connection`);
  }
  connect(email: string, password: string, countryCode: string, resetProductMappings: boolean) {
    return this.http.post<ApiPicnicConnection>(`${this.url}/connect`, {
      email,
      password,
      countryCode,
      resetProductMappings,
    });
  }
  requestCode() {
    return this.http.post<ApiPicnicConnection>(`${this.url}/verification-code`, {});
  }
  verify(code: string) {
    return this.http.post<ApiPicnicConnection>(`${this.url}/verify`, { code });
  }
  disconnect() {
    return this.http.delete<void>(`${this.url}/connection`);
  }
}
