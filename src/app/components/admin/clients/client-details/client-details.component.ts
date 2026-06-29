import { Component } from '@angular/core';
import { SharedModule } from '../../../../theme/shared/shared.module';
import { ActivatedRoute, Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { getAclLevel, UtilityService } from '../../../../services/utility';
import { AssignManagersComponent } from './assign-managers/assign-managers.component';
import { ClientManagersComponent } from './client-managers/client-managers.component';
import { ClientBillingComponent } from './client-billing/client-billing.component';
import { Client, SubmissionStats } from '../../../../services/app.models';
import { ServerService } from '../../../../services/server.service';
import { ToastService } from '../../../../services/toast.service';
import { merge, Observable, OperatorFunction, Subject } from 'rxjs';
import { dropDownValues } from '../../../../services/field.values';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { Location } from '@angular/common';


@Component({
  selector: 'app-client-details',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './client-details.component.html',
  styleUrls: ['./client-details.component.scss']
})
export default class ClientDetailsComponent {

  // We use an observable stream to handle the data asynchronously in the template
  client: Client;
  clientId: string = null;
  error: string | null = null;
  loading = true;
  copiedState: { [key: string]: boolean } = { sandbox: false, production: false };
  currentStats = [
    {
      title: 'Pending',
      amount: '0',
      border: 'border-primary',
      color: 'text-primary',
      subText: 'Total invoices waiting for submission',
      key: 'pending'
    },
    {
      title: 'Under Initial Review',
      amount: '0',
      border: 'border-info',
      color: 'text-info',
      subText: 'Invoices under initial review',
      key: 'initial_review'
    },
    {
      title: 'Under Final Review',
      amount: '0',
      border: 'border-warning',
      color: 'text-warning',
      subText: 'Invoices under final review',
      key: 'final_review'
    },
    {
      title: 'Rejected',
      amount: '0',
      border: 'border-danger',
      color: 'text-danger',
      subText: 'Invoices rejected by managers',
      key: 'rejected'
    }
  ];

  submissionStats = [
    {
      title: 'Today',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR today',
      key: 'submitted_today'
    },
    {
      title: 'Last 7 Days',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR this week',
      key: 'submitted_this_week'
    },
    {
      title: 'This Month',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR this month',
      key: 'submitted_this_month'
    },
    {
      title: 'This Year',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR this year',
      key: 'submitted_this_year'
    }
  ];

  isLoading: any = {
    sandboxToken: false,
    productionToken: false,
    sellerProvince: false,
    sellerAddress: false,
    sellerName: false
  };
  focusSearchProvinces$ = new Subject<string>();
  dropDowns = dropDownValues;
  public aclLevel = getAclLevel();
  private apiMap: any = {
    sandboxToken: '/admin/clients/update/sandbox_token',
    productionToken: '/admin/clients/update/production_token',
    sellerProvince: '/admin/clients/update/seller_province',
    sellerAddress: '/admin/clients/update/seller_address',
    sellerBusinessName: '/admin/clients/update/seller_business_name'
  };

  constructor(private route: ActivatedRoute, private router: Router, private modalService: NgbModal, private utility: UtilityService, private serverService: ServerService, private toastService: ToastService, private location: Location) {
  }

  ngOnInit(): void {
    this.clientId = this.route.snapshot.queryParamMap.get('id');
    if (this.clientId) {
      this.fetchClientDetails().then(() => {
        this.loading = false;
      });
    } else {
      this.router.navigateByUrl('admin/clients').then();
    }
  }

  async fetchClientDetails() {
    try {
      this.client = await this.serverService.get<Client>(`/admin/get_client?id=${this.clientId}`);
      console.log(this.client);
      const counts = await this.serverService.get<SubmissionStats>(`/admin/client-stats?client_id=${this.clientId}`);
      ['initial_review', 'final_review', 'rejected', 'pending'].forEach((key) => {
        const item = this.currentStats.find((s) => {
          return s.key === key;
        });
        item.amount = counts[key];
      });
      ['submitted_today', 'submitted_this_week', 'submitted_this_month', 'submitted_this_year'].forEach((key) => {
        const item = this.submissionStats.find((s) => {
          return s.key === key;
        });
        item.amount = counts[key];
      });
    } catch (e) {
      this.router.navigateByUrl('admin/clients').then();
    }
  }

  copyToClipboard(text: string, type: 'sandbox' | 'production'): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedState[type] = true;
      // Reset the "Copied!" message after 2 seconds
      setTimeout(() => {
        this.copiedState[type] = false;
      }, 2000);
    });
  }

  navigateToInvoices(id: string) {
    this.router.navigateByUrl(`/admin/client-invoices?id=${id}`).then();
  }

  openAssignManagersView() {
    const modal = this.modalService.open(AssignManagersComponent, this.utility.getModalOptions());
    modal.componentInstance.client = this.client;
    this.utility.registerOnModalClose(modal);
  }

  openAddManagersView() {
    const modal = this.modalService.open(ClientManagersComponent, this.utility.getModalOptions());
    modal.componentInstance.client = this.client;
    this.utility.registerOnModalClose(modal);
  }

  openBillingsView() {
    const modal = this.modalService.open(ClientBillingComponent, this.utility.getModalOptions());
    modal.componentInstance.client = this.client;
    this.utility.registerOnModalClose(modal);
  }

  async updateField(key: string, value: string) {
    this.isLoading[key] = true;
    try {
      await this.serverService.put(`${this.apiMap[key]}?client_id=${this.clientId}`, { [key]: value });
      this.toastService.showToast('notification', `Client details updated successfully`);
    } catch (error: any) {
      this.toastService.showToast('error', error?.message || `Failed to update ${key}`);
    } finally {
      this.isLoading[key] = false;
    }
  }

  searchProvinces: OperatorFunction<string, readonly string[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    return merge(debouncedText$, this.focusSearchProvinces$).pipe(
      map(term =>
        (term === ''
            ? this.dropDowns.provinces.slice(0, 20)
            : this.dropDowns.provinces.filter(v => v.toLowerCase().indexOf(term.toLowerCase()) > -1)
        ).slice(0, 10)
      )
    );
  };
  goBack(): void {
    this.location.back();
  }
}
