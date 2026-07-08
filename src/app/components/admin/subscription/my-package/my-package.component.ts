import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ServerService } from '../../../../services/server.service';
import { Package } from '../../../../services/app.models';

/**
 * my-package.component.ts
 * In-app "Subscription" page, reachable at all times from the sidebar nav.
 * Unlike the standalone /onboarding/* screens (which take over the whole page
 * and are only used for the very first package purchase), this page renders
 * inside the normal admin layout so client users can check on their package,
 * remaining invoice quota, and pending payments without losing access to the
 * rest of the app.
 */
@Component({
  selector: 'app-my-package',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-package.component.html',
  styleUrls: ['./my-package.component.scss']
})
export default class MyPackageComponent implements OnInit, OnDestroy {
  loading = true;
  status: any = null;
  isPortalStaff = false;
  reason: string | null = null;

  // package selection (stage === 'no_package')
  packages: Package[] = [];
  packagesLoading = false;
  selectedId: string | null = null;
  generating = false;

  // upgrade voucher (generated on demand while active / quota exhausted)
  upgradePayment: any = null;
  generatingUpgrade = false;

  error: string | null = null;
  copied = '';

  private pollHandle: any;

  constructor(private serverService: ServerService, private route: ActivatedRoute) {}

  async ngOnInit() {
    this.reason = this.route.snapshot.queryParamMap.get('reason');
    await this.refresh();
    // Keep pending payments / verification status fresh without a manual reload.
    this.pollHandle = setInterval(() => this.refresh(true), 15000);
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  async refresh(silent = false) {
    try {
      this.status = await this.serverService.getMyAccountStatus();
      this.isPortalStaff = !this.status.client_id;

      if (this.status.stage === 'no_package' && this.packages.length === 0) {
        await this.loadPackages();
      }
      // Once the subscription is active again (quota topped up / renewed),
      // clear any locally-tracked upgrade voucher — it's served its purpose.
      if (this.upgradePayment && this.status.stage === 'active') {
        this.upgradePayment = null;
      }
      this.error = null;
    } catch {
      if (!silent) {
        this.error = 'Failed to load your account status. Please refresh the page.';
      }
    }
    this.loading = false;
  }

  async loadPackages() {
    this.packagesLoading = true;
    try {
      this.packages = await this.serverService.getPackages();
    } catch {
      this.error = 'Failed to load packages. Please refresh the page.';
    }
    this.packagesLoading = false;
  }

  async choose(pkg: Package) {
    if (pkg.contact_for_more) {
      return; // handled by template — shows the phone number instead
    }
    this.selectedId = pkg.id;
    this.generating = true;
    this.error = null;
    try {
      await this.serverService.selectPackageSelf(pkg.id);
      await this.refresh();
    } catch (e: any) {
      this.error = e.response?.data?.detail || 'Failed to generate payment voucher. Please try again.';
    }
    this.generating = false;
    this.selectedId = null;
  }

  async requestUpgrade() {
    this.generatingUpgrade = true;
    this.error = null;
    try {
      const response = await this.serverService.upgradePackageSelf();
      this.upgradePayment = response.payment;
    } catch (e: any) {
      this.error = e.response?.data?.detail || 'Failed to generate upgrade payment. Please try again.';
    }
    this.generatingUpgrade = false;
  }

  copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    this.copied = key;
    setTimeout(() => (this.copied = ''), 2000);
  }

  formatPrice(p: number) {
    return p === 0 ? 'Contact Us' : `Rs. ${p.toLocaleString()}/-`;
  }

  formatDate(d: string) {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  }

  get quotaPercent(): number {
    if (!this.status || !this.status.invoices_quota) return 0;
    return Math.min(100, Math.round((this.status.invoices_used / this.status.invoices_quota) * 100));
  }

  get reasonMessage(): string | null {
    const messages: { [key: string]: string } = {
      no_package: 'Select a package below to enable invoice submission.',
      payment_pending: 'Your payment is still pending — invoice submission will unlock once it clears.',
      awaiting_verification: 'Your account is awaiting FBR verification — invoice submission will unlock shortly.',
      locked_quota_exhausted: "You've used all the invoices in your package — upgrade below to keep submitting.",
      locked_expired: 'Your subscription has expired — renew below to keep submitting.'
    };
    return this.reason ? messages[this.reason] || null : null;
  }
}
