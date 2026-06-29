import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ChargeClientComponent } from './charge-client/charge-client.component';
import { UtilityService } from '../../../../../services/utility';
import { Client } from '../../../../../services/app.models';
import { ServerService } from '../../../../../services/server.service';
import { ToastService } from '../../../../../services/toast.service';
import { BillingPdfService, PdfBillData } from '../../../../../services/billing-pdf.service';

interface OtherExpense {
  expenseAmount: number; // Amount of the expense
  expenseDescription: string; // Description of the expense
}

interface BillRequest {
  _id: string;
  amount: number;
  costPerInvoice: number;
  totalInvoices: number;
  otherExpenses: OtherExpense[]; // Defaults to empty array in Python
  totalChargeableAmount: number;
  created_at: string;
  updated_at: string;
  status: 'PAID' | 'UNPAID';
}

// Interface for strong typing our Bill object
export interface Bill {
  id: number;
  month: string; // Using ISO date string for easy piping
  invoicesSubmitted: number;
  status: 'PAID' | 'UNPAID';
  bill: BillRequest,
  created_at: string
}

@Component({
  selector: 'app-client-billing',
  templateUrl: './client-billing.component.html',
  styleUrls: ['./client-billing.component.scss']
})
export class ClientBillingComponent implements OnInit {

  @Input() client: Client;
  bills: Bill[] = [];
  loading = true;

  constructor(public activeModal: NgbActiveModal, private modalService: NgbModal, private utility: UtilityService,
              private serverService: ServerService, private toast: ToastService, private billPdfService: BillingPdfService) {
  }

  ngOnInit(): void {
    // In a real app, this data would be fetched from an API
    this.getBillingData().then((data: Array<Bill>) => {
      this.bills = data;
      this.loading = false;
    });
  }

  /**
   * Returns the appropriate Bootstrap badge class based on the bill's status.
   */
  getStatusBadge(status: 'PAID' | 'UNPAID'): string {
    switch (status) {
      case 'PAID':
        return 'bg-success';
      case 'UNPAID':
        return 'bg-warning';
      default:
        return 'bg-success';
    }
  }

  generateBill(bill: Bill): void {
    const modal = this.modalService.open(ChargeClientComponent, this.utility.getModalOptions());
    modal.componentInstance.client = this.client;
    modal.componentInstance.bill = bill;
    const sub = modal['dismissed'].subscribe((data: any) => {
      if (data?.success == true) {
        this.loading = true;
        this.ngOnInit();
      }
      sub.unsubscribe();
    });
  }

  // --- Action Handlers ---

  markAsPaid(billToUpdate: Bill): void {
    try {
      this.serverService.put(`/admin/update-client-bill-status?bill_id=${billToUpdate.bill._id}`, { 'status': 'PAID' }).then(() => {
        this.toast.showToast('notification', 'Status updated successfully');
        billToUpdate.status = 'PAID';
        billToUpdate.bill.status = 'PAID';
      });
    } catch (e) {
      console.log(e);
    }
  }

  markAsUnpaid(billToUpdate: Bill): void {
    try {
      this.serverService.put(`/admin/update-client-bill-status?bill_id=${billToUpdate.bill._id}`, { 'status': 'UNPAID' }).then(() => {
        this.toast.showToast('notification', 'Status updated successfully');
        billToUpdate.status = 'UNPAID';
        billToUpdate.bill.status = 'UNPAID';
      });
    } catch (e) {
      console.log(e);
    }
  }

  downloadPdf(bill: Bill): void {
    const billData: PdfBillData = { company: { name: 'Rizwan & Co.' }, client: { name: this.client.sellerBusinessName, ntn: this.client.sellerNTNCNIC }, bill };
    this.billPdfService.generateClientBill(billData);
  }

  /**
   * Generates mock data covering all required scenarios.
   */
  private async getBillingData() {
    try {
      return await this.serverService.get(`/admin/client-invoices-summary?client_id=${this.client.id}`);
    } catch (e) {
      return [];
    }
  }
}
