import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ServerService } from '../../../services/server.service';

@Component({
  selector: 'app-account-locked',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-locked.component.html',
  styleUrls: ['./account-locked.component.scss']
})
export default class AccountLockedComponent implements OnInit, OnDestroy {
  loading = true;
  stage: 'locked_quota_exhausted' | 'locked_expired' | null = null;
  subscription: any = null;
  invoicesUsed = 0;
  invoicesQuota = 0;
  generatingUpgrade = false;
  upgradePayment: any = null;
  error: string | null = null;
  copied = '';
  private pollHandle: any;

  constructor(private serverService: ServerService, private router: Router) {}

  async ngOnInit() {
    await this.check();
    this.pollHandle = setInterval(() => this.check(), 20000);
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  async check() {
    try {
      const status = await this.serverService.getMyAccountStatus();
      if (status.stage === 'active') {
        this.router.navigateByUrl('/admin/dashboard').then();
        return;
      }
      if (status.stage === 'locked_quota_exhausted' || status.stage === 'locked_expired') {
        this.stage = status.stage;
        this.subscription = status.subscription;
        this.invoicesUsed = status.invoices_used;
        this.invoicesQuota = status.invoices_quota;
        // Clear a stale "generated" voucher once quota check shows we have headroom again
        // (this will happen automatically via the redirect above once the webhook lands).
      } else if (status.stage === 'no_package') {
        this.router.navigateByUrl('/onboarding/select-package').then();
      }
    } catch {
      // ignore transient errors
    }
    this.loading = false;
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
}