import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  CanActivateChild,
  Router,
  RouterStateSnapshot,
  UrlTree
} from '@angular/router';
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
  // Caches the in-flight status check so concurrent guard invocations
  // (e.g. parent + child route both resolving at once) share one request
  // instead of firing duplicate calls.
  private pendingCheck: Promise<any> | null = null;
  private lastCheckedAt = 0;
  private lastResult: any = null;
  private readonly CACHE_MS = 4000;

  constructor(private serverService: ServerService, private router: Router) {}

  canActivateChild(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return this.check(state.url);
  }

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean | UrlTree> {
    return this.check(state.url);
  }

  private async getStatus(): Promise<any> {
    // Short-lived cache + de-duplication: prevents a burst of guard calls
    // (parent route + child route + re-entrant redirects) from each firing
    // their own /my-account-status request within the same navigation.
    const now = Date.now();
    if (this.lastResult && now - this.lastCheckedAt < this.CACHE_MS) {
      return this.lastResult;
    }
    if (this.pendingCheck) {
      return this.pendingCheck;
    }
    this.pendingCheck = this.serverService.getMyAccountStatus()
      .then((status) => {
        this.lastResult = status;
        this.lastCheckedAt = Date.now();
        return status;
      })
      .finally(() => {
        this.pendingCheck = null;
      });
    return this.pendingCheck;
  }

  private async check(targetUrl: string): Promise<boolean | UrlTree> {
    const token = localStorage.getItem('token');
    if (!token) {
      // Already heading to a public auth page — don't redirect again.
      if (['/login', '/signup', '/forgot-password', '/reset-password', '/'].some(p => targetUrl.split('?')[0] === p)) {
        return true;
      }
      return this.router.createUrlTree(['/login']);
    }

    const userRaw = localStorage.getItem('user');
    const user: User | null = userRaw ? JSON.parse(userRaw) : null;

    // Portal staff (no clientId) are never restricted by the onboarding flow.
    if (!user || !user.clientId) {
      return true;
    }

    const currentPath = targetUrl.split('?')[0];

    try {
      const status = await this.getStatus();

      const stageRoutes: { [key: string]: string } = {
        no_package: '/onboarding/select-package',
        payment_pending: '/onboarding/payment-pending',
        awaiting_verification: '/onboarding/awaiting-verification',
        locked_quota_exhausted: '/onboarding/account-locked',
        locked_expired: '/onboarding/account-locked'
      };

      const targetRoute = stageRoutes[status.stage];

      if (targetRoute) {
        // Already navigating to (or inside) the correct onboarding screen — allow, no redirect.
        if (currentPath === targetRoute || currentPath.startsWith(targetRoute + '/')) {
          return true;
        }
        return this.router.createUrlTree([targetRoute]);
      }

      // stage === 'active' — fully unlocked.
      // If they're heading into /onboarding, bounce them to the dashboard instead.
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
