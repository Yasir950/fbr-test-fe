import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ServerService } from '../../../services/server.service';
import { Package } from '../../../services/app.models';

@Component({
  selector: 'app-select-package',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select-package.component.html',
  styleUrls: ['./select-package.component.scss']
})
export default class SelectPackageComponent implements OnInit {
  packages: Package[] = [];
  loading = true;
  generating = false;
  error: string | null = null;
  selectedId: string | null = null;

  constructor(private serverService: ServerService, private router: Router) {}

  async ngOnInit() {
    try {
      this.packages = await this.serverService.getPackages();
    } catch {
      this.error = 'Failed to load packages. Please refresh the page.';
    }
    this.loading = false;
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
      this.router.navigateByUrl('/onboarding/payment-pending').then();
    } catch (e: any) {
      this.error = e.response?.data?.detail || 'Failed to generate payment voucher. Please try again.';
      this.generating = false;
      this.selectedId = null;
    }
  }

  formatPrice(p: number) {
    return p === 0 ? 'Contact Us' : `Rs. ${p.toLocaleString()}/-`;
  }
}
