import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ServerService } from '../../../services/server.service';

@Component({
  selector: 'app-payment-pending',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payment-pending.component.html',
  styleUrls: ['./payment-pending.component.scss']
})
export default class PaymentPendingComponent implements OnInit, OnDestroy {
  loading = true;
  payment: any = null;
  copied = '';
  private pollHandle: any;

  constructor(private serverService: ServerService, private router: Router) {}

  async ngOnInit() {
    await this.check();
    this.pollHandle = setInterval(() => this.check(), 15000);
  }

  ngOnDestroy() {
    if (this.pollHandle) clearInterval(this.pollHandle);
  }

  async check() {
    try {
      const status = await this.serverService.getMyAccountStatus();
      if (status.stage === 'payment_pending') {
        this.payment = status.pending_payment;
      } else if (status.stage === 'awaiting_verification') {
        this.router.navigateByUrl('/onboarding/awaiting-verification').then();
      } else if (status.stage === 'active') {
        this.router.navigateByUrl('/admin/dashboard').then();
      } else if (status.stage === 'no_package') {
        this.router.navigateByUrl('/onboarding/select-package').then();
      }
    } catch {
      // ignore transient errors during polling
    }
    this.loading = false;
  }

  copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    this.copied = key;
    setTimeout(() => (this.copied = ''), 2000);
  }
}