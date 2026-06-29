import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../../theme/shared/shared.module';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientList } from '../../../../services/app.models';
import { ServerService } from '../../../../services/server.service';
import { InvoicesPdfService } from '../../../../services/invoices.pdf.service';
import { getAclLevel } from '../../../../services/utility';
import { delay } from 'rxjs';
import { Location } from '@angular/common';
import * as XLSX from 'xlsx-js-style'; 


@Component({
  selector: 'app-client-invoices',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './client-invoices.component.html',
  styleUrls: ['./client-invoices.component.scss']
})
export default class ClientInvoicesComponent implements OnInit {
  invoices: any[] = [];
  filteredInvoices: any[] = [];
  selectedInvoices: any[] = [];
  activeFilter: string = 'all';
  client: ClientList = null;
  clientId = null;
  loading = true;
  
  // NEW: Date Filter Properties
  fromDate: string = '';
  toDate: string = '';
searchQuery: string = '';
  public aclLevel = getAclLevel();
  public finalReviewSelection = new Set<string>();
  public submittedSelection = new Set<string>();
  public reviewSelection = new Set<string>();
  public isSubmittingAll = false;

  constructor(private router: Router, private route: ActivatedRoute, private serverService: ServerService, private invoicesPdfService: InvoicesPdfService, private location: Location) {
  }

  get masterCheckboxState(): 'all' | 'some' | 'none' {
    if (this.finalReviewSelection.size === 0) {
      return 'none';
    }
    if (this.finalReviewSelection.size === this.filteredInvoices.length) {
      return 'all';
    }
    return 'some';
  }

  get masterSubmittedCheckboxState(): 'all' | 'some' | 'none' {
    if (this.submittedSelection.size === 0) {
      return 'none';
    }
    if (this.submittedSelection.size === this.filteredInvoices.length) {
      return 'all';
    }
    return 'some';
  }

  get masterReviewCheckboxState(): 'all' | 'some' | 'none' {
    if (this.reviewSelection.size === 0) {
      return 'none';
    }
    if (this.reviewSelection.size === this.filteredInvoices.length) {
      return 'all';
    }
    return 'some';
  }

  ngOnInit(): void {
    this.fetchClientDetails().then();
  }

  async fetchClientDetails() {
    this.clientId = this.route.snapshot.queryParamMap.get('id');
    if (this.clientId) {
      try {
        this.client = await this.serverService.get<ClientList>(`/admin/get_client_summary?id=${this.clientId}`);
        this.fetchClientInvoices().then();
      } catch (e) {
        this.router.navigateByUrl('admin/clients').then();
      }
    } else {
      this.router.navigateByUrl('admin/clients').then();
    }
    this.loading = false;
  }

  async fetchClientInvoices() {
    try {
      this.invoices = await this.serverService.get<any>(`/admin/list-invoices?client_id=${this.clientId}`);
      this.applyFilters();
    } catch (e) {
      this.invoices = [];
      this.filteredInvoices = [];
    }
  }

  /**
   * New Unified Filter logic combining Status and Date Range
   */
 applyFilters() {
  let temp = [...this.invoices];

  // Status Filter
  if (this.activeFilter !== 'all') {
    temp = temp.filter(inv => inv.status === this.activeFilter);
  }

  // Date Range Filter
  if (this.fromDate) {
    const start = new Date(this.fromDate);
    start.setHours(0, 0, 0, 0);
    temp = temp.filter(inv => new Date(inv.invoiceDate) >= start);
  }

  if (this.toDate) {
    const end = new Date(this.toDate);
    end.setHours(23, 59, 59, 999);
    temp = temp.filter(inv => new Date(inv.invoiceDate) <= end);
  }

  // Search Filter
  if (this.searchQuery?.trim()) {
    const query = this.searchQuery.trim().toLowerCase();
    temp = temp.filter(inv =>
      inv.buyerBusinessName?.toLowerCase().includes(query) ||
      inv.buyerNTNCNIC?.toLowerCase().includes(query) ||
      inv.status?.toLowerCase().includes(query)
    );
  }

  // Sort: max date to min date
  temp.sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime());

  this.filteredInvoices = temp;

  // Clear selections
  this.selectedInvoices = [];
  this.finalReviewSelection.clear();
  this.submittedSelection.clear();
  this.reviewSelection.clear();
}

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getBadgeClass(status: string): string {
    switch (status) {
      case 'initial_review':
        return 'bg-warning';
      case 'final_review':
        return 'bg-info';
      case 'submitted':
        return 'bg-success';
      case 'rejected':
        return 'bg-danger';
      default:
        return 'bg-secondary';
    }
  }

  filterByStatus(status: string) {
    this.activeFilter = status;
    this.applyFilters();
  }

  clearDateFilters() {
    this.fromDate = '';
    this.toDate = '';
    this.applyFilters();
  }

  toggleSelection(invoice: any, event: any) {
    if (event.target.checked) {
      this.selectedInvoices.push(invoice);
    } else {
      this.selectedInvoices = this.selectedInvoices.filter(i => i.id !== invoice.id);
    }
  }

  isSelected(invoice: any): boolean {
    return this.selectedInvoices.some(i => i.id === invoice.id);
  }

  downloadAll() {
    const invoicesData = [];
    const inv_ids = Array.from(this.submittedSelection);
    inv_ids.forEach((id) => {
      const inv = this.invoices.find((inv) => {
        return inv.id === id;
      });
      invoicesData.push(inv['invoiceData']);
    });
    const instance = { clientName: this.client.sellerBusinessName, clientNTN: this.client.sellerNTNCNIC, invoices: invoicesData };
    this.invoicesPdfService.generateInvoicesPdf(instance).then();
  }

  viewDetails(id: any) {
    this.router.navigateByUrl(`/admin/invoice-details?id=${id}`).then();
  }

  addNewInvoice(client_id: string) {
    this.router.navigateByUrl(`/admin/invoice-form?client_id=${client_id}`).then();
  }

  bulkInvoice(client_id: string) {
    this.router.navigateByUrl(`/admin/bulk-invoices?client_id=${client_id}`).then();
  }

  bulkSubmissions(client_id: string) {
    this.router.navigateByUrl(`/admin/queue-submissions?client_id=${client_id}`).then();
  }

  download(invoice: any) {
    const instance = { clientName: this.client.sellerBusinessName, clientNTN: this.client.sellerNTNCNIC, FBRInvoice: invoice.FBRInvoice, invoices: [invoice.invoiceData] };
    this.invoicesPdfService.generateInvoicesPdf(instance).then();
  }

  downloadDraft(invoice: any) {
  const instance = {
    clientName: this.client.sellerBusinessName,
    clientNTN: this.client.sellerNTNCNIC,
    invoices: [invoice.invoiceData],
    isDraft: true
  };
  this.invoicesPdfService.generateInvoicesPdf(instance).then();
}
  async deleteInvoice(invoice: any) {
    const c = confirm('Are you sure you want to delete this invoice?');
    if (c) {
      this.loading = true;
      this.client = await this.serverService.delete<any>(`/admin/invoice/delete?invoice_id=${invoice.id}`);
      this.fetchClientInvoices().then(() => {
        this.loading = false;
      });
    }
  }

  public toggleInvoiceSelection(invoiceId: string): void {
    if (this.finalReviewSelection.has(invoiceId)) {
      this.finalReviewSelection.delete(invoiceId);
    } else {
      this.finalReviewSelection.add(invoiceId);
    }
  }

  public toggleSubmittedInvoiceSelection(invoiceId: string): void {
    if (this.submittedSelection.has(invoiceId)) {
      this.submittedSelection.delete(invoiceId);
    } else {
      this.submittedSelection.add(invoiceId);
    }
  }

  public toggleReviewInvoiceSelection(invoiceId: string): void {
    if (this.reviewSelection.has(invoiceId)) {
      this.reviewSelection.delete(invoiceId);
    } else {
      this.reviewSelection.add(invoiceId);
    }
  }

  public isInvoiceSelected(invoiceId: string): boolean {
    return this.finalReviewSelection.has(invoiceId);
  }

  public isSubmittedInvoiceSelected(invoiceId: string): boolean {
    return this.submittedSelection.has(invoiceId);
  }

  public isReviewInvoiceSelected(invoiceId: string): boolean {
    return this.reviewSelection.has(invoiceId);
  }

  public toggleMasterSelection(): void {
    if (this.finalReviewSelection.size > 0) {
      this.finalReviewSelection.clear();
    } else {
      this.filteredInvoices.forEach(invoice => this.finalReviewSelection.add(invoice.id));
    }
  }

  public toggleSubmittedMasterSelection(): void {
    if (this.submittedSelection.size > 0) {
      this.submittedSelection.clear();
    } else {
      this.filteredInvoices.forEach(invoice => this.submittedSelection.add(invoice.id));
    }
  }

  public toggleReviewMasterSelection(): void {
    if (this.reviewSelection.size > 0) {
      this.reviewSelection.clear();
    } else {
      this.filteredInvoices.forEach(invoice => this.reviewSelection.add(invoice.id));
    }
  }

  public async submitSelectedInvoices(): Promise<void> {
    const idsToSubmit = Array.from(this.finalReviewSelection);
    if (idsToSubmit.length === 0) {
      return;
    }
    this.isSubmittingAll = true;
    try {
      const v = confirm(`Are you sure you want to submit ${idsToSubmit.length} invoices? This action is irreversible.`);
      if (v) {
        const payload = { invoice_ids: idsToSubmit };
        await this.serverService.post('/admin/queue-invoices', payload);
        alert(`Successfully submitted ${idsToSubmit.length} invoices for processing.`);
        this.finalReviewSelection.clear();
        this.router.navigateByUrl(`/admin/queue-submissions?client_id=${this.clientId}`).then();
      }
    } catch (error) {
      console.error('Failed to submit invoices:', error);
      // @ts-ignore
      const errDetail = error.response?.data?.detail ?? 'An unknown error occurred.';
      alert(`Error: ${errDetail}`);
    } finally {
      this.isSubmittingAll = false;
    }
  }

  public async markAsReviewedInvoices(): Promise<void> {
    const idsToSubmit = Array.from(this.reviewSelection);
    if (idsToSubmit.length === 0) {
      return;
    }
    this.loading = true;
    try {
      const v = confirm(`Are you sure you want put ${idsToSubmit.length} invoices under final review?`);
      if (v) {
        const payload = { invoice_ids: idsToSubmit };
        await this.serverService.put('/admin/bulk-mark-reviewed', payload);
        this.reviewSelection.clear();
        await this.fetchClientInvoices();
        await delay(200);
        this.filterByStatus('initial_review');
      }
    } catch (error) {
      console.error('Failed to submit invoices:', error);
      // @ts-ignore
      const errDetail = error.response?.data?.detail ?? 'An unknown error occurred.';
      alert(`Error: ${errDetail}`);
    } finally {
      this.isSubmittingAll = false;
    }
  }
  goBack(): void {
    this.location.back();
  }

  /**
   * Delete all selected invoices.
   */
  public async deleteAllInvoices(selectionData:any, status: string): Promise<void> {
    const idsToSubmit = Array.from(selectionData);
    if (idsToSubmit.length === 0) {
      return;
    }

      this.loading = true;
    try {
      const v = confirm(`Are you sure you want delete ${idsToSubmit.length} invoices?`);
      if (v) {
        // The backend expects a JSON object, so we wrap the array.
        const payload = { invoice_ids: idsToSubmit };
        // Assuming you have a 'serverService' for API calls
        await this.serverService.put('/admin/bulk-delete', payload);
        // IMPORTANT: After success, you should refresh the data from the server
        // to reflect the status change, and clear the selection.
        selectionData.clear();
        await this.fetchClientInvoices();
        await delay(200);
        this.filterByStatus(status);
      }
    } catch (error) {
      console.error('Failed to delete invoices:', error);
      // @ts-ignore
      const errDetail = error.response?.data?.detail ?? 'An unknown error occurred.';
      alert(`Error: ${errDetail}`);
    } finally {
      this.isSubmittingAll = false;
    }
  }


public exportToExcel(): void {
  if (this.filteredInvoices.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Helper to format date as 1-Jan-26
  const formatDateToTemplate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = date.getDate(); // e.g. 1
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()]; // e.g. Jan
    const year = String(date.getFullYear()).slice(-2); // e.g. 26
    return `${day}-${month}-${year}`; // Results in 1-Jan-26
  };

  const rows: any[] = [];
  this.filteredInvoices.forEach(inv => {
    const data = inv.invoiceData;
    console.log(data)
    data.items.forEach((item: any) => {
      rows.push({
        'FBR_Invoice_ID*': data.FBRInvoice,
        'Internal_Invoice_ID*': data.csvInvoiceId,
        'Invoice_Date_YYYY-MM-DD*': formatDateToTemplate(data.invoiceDate),
        'Invoice_Type*': data.invoiceType,
        'Buyer_NTN_CNIC*': data.buyerNTNCNIC,
        'Buyer_Business_Name*': data.buyerBusinessName,
        'Buyer_Province*': data.buyerProvince,
        'Buyer_Address*': data.buyerAddress,
        'Buyer_Registration_Type*': data.buyerRegistrationType,
        'Invoice_Ref_No': data.invoiceRefNo || '0',
        'Reason': data.reason || '0',
        'Item_HS_Code*': item.hsCode,
        'Item_Product_Description*': item.productDescription,
        'Item_Rate*': item.rate,
        'Item_UoM*': item.uoM,
        'Item_Quantity*': item.quantity,
        'Item_Total_Values*': item.totalValues,
        'Item_Value_Sales_Excluding_ST*': item.valueSalesExcludingST,
        'Item_Fixed_Notified_Value_Or_Retail_Price*': item.fixedNotifiedValueOrRetailPrice,
        'Item_Sales_Tax_Applicable*': item.salesTaxApplicable,
        'Item_Sales_Tax_Withheld_At_Source*': item.salesTaxWithheldAtSource,
        'Item_Extra_Tax*': item.extra_tax || 0,
        'Item_Further_Tax*': item.furtherTax,
        'Item_FED_Payable*': item.fedPayable,
        'Item_Discount*': item.discount,
        'Item_Sale_Type*': item.saleType,
        'Item_SRO_Schedule_No': item.sroScheduleNo || '',
        'Item_SRO_Item_Serial_No': item.sroItemSerialNo || ''
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // 1. Header Style: White BG, Red Bold Font, Centered
  const headerStyle = {
    fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
    font: { color: { rgb: "C00000" }, bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } }
    }
  };

  // 2. Data Style: Centered
  const dataStyle = {
    alignment: { horizontal: "center", vertical: "center" }
  };

  // 3. Apply styles to all cells
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[address]) continue;
      
      // First row (R=0) gets headerStyle, others get dataStyle (centered)
      worksheet[address].s = (R === 0) ? headerStyle : dataStyle;
    }
  }

  // 4. Increase Header Height (40px)
  worksheet['!rows'] = [{ hpx: 40 }]; 
  
  // 5. Column Widths
  worksheet['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  XLSX.writeFile(workbook, `Bulk_Invoices_Export.xlsx`);
}
clearSearch(): void {
  this.searchQuery = '';
  this.applyFilters();
}


}
