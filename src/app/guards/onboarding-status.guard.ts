import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router, UrlTree } from '@angular/router';
import { ServerService } from '../services/server.service';
import { User } from '../services/app.models';

/**
 * Guards every route under /admin and /onboarding for client (submitter) users.
 * Portal staff (no clientId) always pass through untouched.
 *
 * For client users, queries /my-account-status and redirects to the correct
 * onboarding step if they try to access the main admin area before they're
 * fully active, or redirects them OUT of onboarding screens once they are active.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingStatusGuard implements CanActivate, CanActivateChild {
  constructor(private serverService: ServerService, private router: Router) {}

  canActivateChild(): Promise<boolean | UrlTree> {
    return this.canActivate();
  }

  async canActivate(): Promise<boolean | UrlTree> {
    const token = localStorage.getItem('token');
    if (!token) {
      return this.router.createUrlTree(['/login']);
    }

    const userRaw = localStorage.getItem('user');
    const user: User | null = userRaw ? JSON.parse(userRaw) : null;

    // Portal staff (no clientId) are never restricted by the onboarding flow.
    if (!user || !user.clientId) {
      return true;
    }

    try {
      const status = await this.serverService.getMyAccountStatus();
      const currentPath = this.router.url.split('?')[0];

      const stageRoutes: { [key: string]: string } = {
        no_package: '/onboarding/select-package',
        payment_pending: '/onboarding/payment-pending',
        awaiting_verification: '/onboarding/awaiting-verification',
        locked_quota_exhausted: '/onboarding/account-locked',
        locked_expired: '/onboarding/account-locked'
      };

      const targetRoute = stageRoutes[status.stage];

      if (targetRoute) {
        // User must be on their designated onboarding screen.
        if (!currentPath.startsWith(targetRoute)) {
          return this.router.createUrlTree([targetRoute]);
        }
        return true;
      }

      // stage === 'active' — fully unlocked.
      // If they're sitting on an onboarding screen, push them into the dashboard.
      if (currentPath.startsWith('/onboarding')) {
        return this.router.createUrlTree(['/admin/dashboard']);
      }
      return true;
    } catch {
      // If the status check fails for any reason, don't block navigation —
      // fail open so a transient API error doesn't lock a paying user out.
      return true;
    }
  }
}