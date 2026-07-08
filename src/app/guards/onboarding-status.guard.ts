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
 * Guards `/onboarding/*` (the standalone first-purchase flow) and `/admin/*`.
 *
 * Design:
 *  - Client (submitter) users can log in and browse the whole app right after
 *    signup — dashboard, clients, reports, etc. — without a package, payment,
 *    or FBR production token. They just can't perform the specific invoice
 *    creation/submission actions until their account is fully `active`
 *    (package paid + FBR-verified + quota remaining). The backend enforces
 *    this independently (see account_lock.py), this guard just gives a
 *    better UX by redirecting away from those specific routes up front,
 *    with a friendly explanation, instead of letting them fill out a whole
 *    form only to have the final submit call fail.
 *  - Portal staff (no clientId) are never restricted.
 *  - `/onboarding/*` (a separate, full-page guided flow used the first time a
 *    client selects a package) keeps its original step-by-step behavior for
 *    anyone who lands there directly.
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

  // Only these /admin/* routes require an active (paid + verified + in-quota)
  // account. Everything else under /admin is freely viewable.
  private readonly GATED_ADMIN_ROUTES = ['/admin/invoice-form', '/admin/edit-invoice-form', '/admin/bulk-invoices'];

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
    this.pendingCheck = this.serverService
      .getMyAccountStatus()
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
    const currentPath = targetUrl.split('?')[0];

    if (!token) {
      // Already heading to a public auth page — don't redirect again.
      if (['/login', '/signup', '/forgot-password', '/reset-password', '/'].some((p) => currentPath === p)) {
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

    // The standalone, full-page onboarding flow keeps its original guided,
    // step-by-step behavior for anyone who navigates there directly.
    if (currentPath.startsWith('/onboarding')) {
      return this.checkOnboardingRoute(currentPath);
    }

    // Everywhere else in /admin (dashboard, clients, reports, sandbox testing,
    // package page, etc.) is viewable regardless of subscription stage.
    const isGatedRoute = this.GATED_ADMIN_ROUTES.some((p) => currentPath === p || currentPath.startsWith(p + '/'));
    if (!isGatedRoute) {
      return true;
    }

    try {
      const status = await this.getStatus();
      if (status.stage === 'active') {
        return true;
      }
      // Send them to the in-app package page with a reason so it can explain why.
      return this.router.createUrlTree(['/admin/package'], { queryParams: { reason: status.stage } });
    } catch {
      // If the status check fails for any reason, don't block navigation —
      // fail open so a transient API error doesn't lock a paying user out.
      return true;
    }
  }

  private async checkOnboardingRoute(currentPath: string): Promise<boolean | UrlTree> {
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

      // stage === 'active' — fully unlocked, no need for the onboarding flow.
      return this.router.createUrlTree(['/admin/dashboard']);
    } catch {
      return true;
    }
  }
}
