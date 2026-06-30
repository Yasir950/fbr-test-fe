import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ServerService } from '../../../services/server.service';

@Component({
  selector: 'app-awaiting-verification',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './awaiting-verification.component.html',
  styleUrls: ['./awaiting-verification.component.scss']
})
export default class AwaitingVerificationComponent implements OnInit, OnDestroy {
  loading = true;
  businessName = '';
  packageName = '';
  private pollHandle: any;

  constructor(private serverService: ServerService, private router: Router) {}

  async ngOnInit() {
    await this.check();
    this.pollHandle = setInterval(() => this.check(), 30000);
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  async check() {
    try {
      const status = await this.serverService.getMyAccountStatus();
      this.businessName = status.client?.sellerBusinessName || '';
      this.packageName = status.subscription?.package?.name || status.subscription?.package_name || '';

      if (status.stage === 'active') {
        this.router.navigateByUrl('/admin/dashboard').then();
      } else if (status.stage === 'locked_quota_exhausted' || status.stage === 'locked_expired') {
        this.router.navigateByUrl('/onboarding/account-locked').then();
      } else if (status.stage === 'payment_pending') {
        this.router.navigateByUrl('/onboarding/payment-pending').then();
      } else if (status.stage === 'no_package') {
        this.router.navigateByUrl('/onboarding/select-package').then();
      }
    } catch {
      // ignore transient errors
    }
    this.loading = false;
  }
}