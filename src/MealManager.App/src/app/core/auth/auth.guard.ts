import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ConfigService } from '../config/config.service';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const config = inject(ConfigService);
  if (auth.isAuthenticated()) return true;
  return config
    .getConfig()
    .pipe(map((state) => router.createUrlTree([state.appInitialized ? '/login' : '/setup'])));
};
