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
import { ToastService } from 'src/app/services/toast.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportGroup {
  groupLabel: string;   // customer_name  OR  hs_code
  groupBadge: string;   // customer_ntn   OR  hs_code (shown as badge)
  data: Record<string, any>; // the numeric key→value pairs to display
}

@Component({
  selector: 'app-reporting',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './reporting.component.html',
  styleUrls: ['./reporting.component.scss']
})
export default class ReportingComponent implements OnInit {

  // ── Invoice list state ───────────────────────────────────────────────────
  invoices: any[] = [];
  filteredInvoices: any[] = [];
  selectedInvoices: any[] = [];
  activeFilter: string = 'all';
  client: ClientList = null;
  clientId = null;
  loading = true;

  // ── Date filters ─────────────────────────────────────────────────────────
  fromDate: string = '';
  toDate: string = '';

  // ── Customer modal ────────────────────────────────────────────────────────
  showCustomerModal = false;
  allCustomers: any[] = [];
  searchQuery = '';
  selectedCustomers: any[] = [];
  filteredCustomerSearch: any[] = [];
  hsCodeMap: Map<string, string> = new Map();

  // ── Report output ─────────────────────────────────────────────────────────
  reportGroups: ReportGroup[] = [];
  ledgerData: {
    groupLabel: string;
    groupBadge: string;
    rows: Record<string, any>[];
    headers: string[];
  }[] = [];
  ledgerHeaders: string[] = [];   // column headers for the ledger table
  dataKeys: string[] = [];        // ordered keys for the grouped-summary table
  todayDate: Date = new Date();

  // ── ACL / selection sets ─────────────────────────────────────────────────
  public aclLevel = getAclLevel();
  public finalReviewSelection = new Set<string>();
  public submittedSelection = new Set<string>();
  public reviewSelection = new Set<string>();
  public isSubmittingAll = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private serverService: ServerService,
    private invoicesPdfService: InvoicesPdfService,
    private location: Location,
    private toastService: ToastService
  ) {}

  // ── Getters ──────────────────────────────────────────────────────────────
  get masterCheckboxState(): 'all' | 'some' | 'none' {
    if (this.finalReviewSelection.size === 0) return 'none';
    if (this.finalReviewSelection.size === this.filteredInvoices.length) return 'all';
    return 'some';
  }
  get masterSubmittedCheckboxState(): 'all' | 'some' | 'none' {
    if (this.submittedSelection.size === 0) return 'none';
    if (this.submittedSelection.size === this.filteredInvoices.length) return 'all';
    return 'some';
  }
  get masterReviewCheckboxState(): 'all' | 'some' | 'none' {
    if (this.reviewSelection.size === 0) return 'none';
    if (this.reviewSelection.size === this.filteredInvoices.length) return 'all';
    return 'some';
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fetchClientDetails().then();
    this.fetchDropdownValues().then();
  }

  async fetchDropdownValues() {
    try {
      const res = await this.serverService.get<any>('/fbr/get_dropdowns');
      if (res?.hscodes && Array.isArray(res.hscodes)) {
        this.hsCodeMap.clear();
        res.hscodes.forEach((item: any) => {
          if (item.code) this.hsCodeMap.set(item.code.trim(), item.description);
        });
      }
    } catch (e) {
      console.error('Error getting dropdown data', e);
    }
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

  applyFilters() {
    let temp = [...this.invoices];
    if (this.activeFilter !== 'all') {
      temp = temp.filter(inv => inv.status === this.activeFilter);
    }
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
    this.filteredInvoices = temp;
    this.selectedInvoices = [];
    this.finalReviewSelection.clear();
    this.submittedSelection.clear();
    this.reviewSelection.clear();
  }

  // ── Report generation ────────────────────────────────────────────────────

  async generateReport() {
    if (!this.clientId) {
      this.toastService.showToast('error', 'No Client ID found.');
      return;
    }
    if (this.selectedCustomers.length === 0 || !this.fromDate || !this.toDate) {
      this.toastService.showToast('error',
        `Please select ${this.activeFilter === 'rejected' ? 'HS Codes' : 'Customers'} and a date range.`);
      return;
    }

    const idList = this.selectedCustomers.map(c => c.ntn);
    const payload: any = { start_date: this.fromDate, end_date: this.toDate };

    try {
      this.loading = true;
      this.reportGroups = [];
      this.ledgerData = [];
      this.ledgerHeaders = [];
      this.dataKeys = [];

      if (this.activeFilter === 'all') {
        payload['customers'] = idList;
        const raw = await this.serverService.postSalesTaxReport(this.clientId, payload);
        this.reportGroups = raw.map((row: any) => {
          const { customer_ntn, customer_name, ...rest } = row;
          return { groupLabel: customer_name, groupBadge: customer_ntn, data: rest };
        });
        this.dataKeys = this.reportGroups.length ? Object.keys(this.reportGroups[0].data) : [];
      }

      else if (this.activeFilter === 'initial_review') {
        payload['customers'] = idList;
        const raw = await this.serverService.postComprehensiveSalesReport(this.clientId, payload);
        this.reportGroups = raw.map((row: any) => {
          const { customer_ntn, customer_name, ...rest } = row;
          return { groupLabel: customer_name, groupBadge: customer_ntn, data: rest };
        });
        this.dataKeys = this.reportGroups.length ? Object.keys(this.reportGroups[0].data) : [];
      }

      else if (this.activeFilter === 'final_review') {
        payload['customers'] = idList;
        const raw = await this.serverService.postSalesTaxWithheldReport(this.clientId, payload);
        this.reportGroups = raw.map((row: any) => {
          const { customer_ntn, customer_name, ...rest } = row;
          return { groupLabel: customer_name, groupBadge: customer_ntn, data: rest };
        });
        this.dataKeys = this.reportGroups.length ? Object.keys(this.reportGroups[0].data) : [];
      }

      else if (this.activeFilter === 'rejected') {
        payload['hscodes'] = idList;
        const raw = await this.serverService.postHsCodeReport(this.clientId, payload);
        this.reportGroups = raw.map((row: any) => {
          const { hs_code, ...rest } = row;
          const description = this.hsCodeMap.get(hs_code?.trim()) || '—';
          return {
            groupLabel: hs_code,
            groupBadge: description,
            data: rest
          };
        });
        this.dataKeys = this.reportGroups.length ? Object.keys(this.reportGroups[0].data) : [];
      }

      else if (this.activeFilter === 'submitted') {
        payload['customers'] = idList;
        const raw = await this.serverService.postCustomerLedgerReport(this.clientId, payload);

        const firstWithData = raw.find((c: any) => c.data?.length > 0);
        this.ledgerHeaders = firstWithData
          ? Object.keys(firstWithData.data[0]).filter(k => k !== 'isSumRow')
          : [];

        this.ledgerData = raw.map((customer: any) => {
          const rows = customer.data ?? [];
          const sumRow = this.calculateCustomerTotals(rows);
          return {
            groupLabel: customer.customer_name,
            groupBadge: customer.customer_ntn,
            rows: [...rows, sumRow],
            headers: this.ledgerHeaders
          };
        });
      }

      this.showCustomerModal = false;

    } catch (error) {
      console.error('Report generation failed:', error);
      this.toastService.showToast('error', 'Failed to generate report. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  /**
   * DIRECT PROGRAMMATIC COMPILER
   * Bypasses window print triggers completely to stream a system file download directly
   */
  downloadReportPDF(): void {
    if (!this.client) return;
    this.todayDate = new Date();

    const doc = new jsPDF('p', 'mm', 'a4');
    
    let reportTitle = '';
    switch(this.activeFilter) {
      case 'all': reportTitle = 'Customer Wise Sales Summary Report'; break;
      case 'initial_review': reportTitle = 'Sales Tax Charged (Output Tax) Summary Report'; break;
      case 'final_review': reportTitle = 'Sales Tax Withheld Summary Report'; break;
      case 'rejected': reportTitle = 'Item / HS Code Wise Summary Report'; break;
      case 'submitted': reportTitle = 'Customer Wise Invoice Ledger'; break;
    }

    // ── FIXED HEADER BOUNDARIES (Prevents Business Name and Title Collision) ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(27, 77, 62);
    // Boundary width capped at 110mm to avoid collision with right title block
    doc.text(this.client.sellerBusinessName.toUpperCase(), 15, 18, { maxWidth: 110 });

    const businessNameLines = doc.splitTextToSize(this.client.sellerBusinessName.toUpperCase(), 110).length;
    const ntnY = 18 + (businessNameLines * 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(85, 85, 85);
    doc.text(`NTN/CNIC: ${this.client.sellerNTNCNIC}`, 15, ntnY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(34, 34, 34);
    // Right title bounded to 70mm max (195mm - 70mm = 125mm, perfectly safe from left block)
    doc.text(reportTitle, 195, 18, { align: 'right', maxWidth: 70 });

    const reportTitleLines = doc.splitTextToSize(reportTitle, 70).length;
    const periodY = 18 + (reportTitleLines * 5);

    if (this.fromDate && this.toDate) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(85, 85, 85);
      doc.text(`Period: ${this.formatPrintDate(this.fromDate)} to ${this.formatPrintDate(this.toDate)}`, 195, periodY, { align: 'right' });
    }

    // Dynamic separator line alignment based on longest column segment
    const headerBottomY = Math.max(ntnY + 4, periodY + 4);
    doc.setDrawColor(27, 77, 62);
    doc.setLineWidth(0.5);
    doc.line(15, headerBottomY, 195, headerBottomY);

    let currentY = headerBottomY + 5; 
    const tableSpacing = 4; // Tight vertical table gap spacing matrix

    // ── SUMMARY DATA TABLES RENDERING ENGINE ──
    if (this.activeFilter !== 'submitted' && this.reportGroups && this.reportGroups.length > 0) {
      this.reportGroups.forEach((group) => {
        const titleLabel = `${this.activeFilter === 'rejected' ? 'HS Code / Item:' : 'Customer Name:'} ${group.groupLabel}`;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let badgeLabel = this.activeFilter === 'rejected' ? `Description: ${group.groupBadge}` : `NTN/CNIC: ${group.groupBadge}`;

        // Dynamic truncation utility loop to bound long item description lengths
        const maxBadgeWidth = 115; 
        if (doc.getTextWidth(badgeLabel) > maxBadgeWidth) {
          while (doc.getTextWidth(badgeLabel + '...') > maxBadgeWidth && badgeLabel.length > 0) {
            badgeLabel = badgeLabel.substring(0, badgeLabel.length - 1);
          }
          badgeLabel += '...';
        }

        if (currentY > 265) { doc.addPage(); currentY = 20; }

        doc.setFillColor(240, 245, 241);
        doc.rect(15, currentY, 180, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(27, 77, 62);
        doc.text(titleLabel, 18, currentY + 4.2, { maxWidth: 60 });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(68, 68, 68);
        doc.text(badgeLabel, 192, currentY + 4.2, { align: 'right' });
        
        currentY += 6;

        const headers = this.dataKeys.map(key => this.formatHeader(key));
        const rowData = [
          this.dataKeys.map(key => {
            const isNum = (key !== 'customer_name' && key !== 'item_description' && key !== 'invoice_date');
            return isNum ? this.formatNumberValue(group.data[key]) : (group.data[key] || '');
          })
        ];

        autoTable(doc, {
          startY: currentY,
          head: [headers],
          body: rowData,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 1.5, font: 'helvetica' },
          headStyles: { fillColor: [250, 250, 250], textColor: [51, 51, 51], fontStyle: 'bold' },
          columnStyles: this.getAlignmentStyles(this.dataKeys),
          margin: { left: 15, right: 15 },
          didDrawPage: (data) => { currentY = data.cursor.y; }
        });

        currentY += tableSpacing;
      });

    // ── LEDGER ACCOUNT TABLES RENDERING ENGINE ──
    } else if (this.activeFilter === 'submitted' && this.ledgerData && this.ledgerData.length > 0) {
      this.ledgerData.forEach((customer) => {
        const titleLabel = `Customer Ledger: ${customer.groupLabel}`;
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        let badgeLabel = `NTN/CNIC: ${customer.groupBadge}`;

        const maxBadgeWidth = 115;
        if (doc.getTextWidth(badgeLabel) > maxBadgeWidth) {
          while (doc.getTextWidth(badgeLabel + '...') > maxBadgeWidth && badgeLabel.length > 0) {
            badgeLabel = badgeLabel.substring(0, badgeLabel.length - 1);
          }
          badgeLabel += '...';
        }

        if (currentY > 265) { doc.addPage(); currentY = 20; }

        doc.setFillColor(240, 245, 241);
        doc.rect(15, currentY, 180, 6, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(27, 77, 62);
        doc.text(titleLabel, 18, currentY + 4.2, { maxWidth: 60 });
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(68, 68, 68);
        doc.text(badgeLabel, 192, currentY + 4.2, { align: 'right' });

        currentY += 6;

        const headers = this.ledgerHeaders.map(h => this.formatHeader(h));
        const rows = customer.rows.map((row: any) => {
          return this.ledgerHeaders.map(h => {
            if (h === 'invoice_date') {
              return row['isSumRow'] ? 'TOTAL SUM' : (row[h] || '');
            }
            return this.formatNumberValue(row[h]);
          });
        });

        autoTable(doc, {
          startY: currentY,
          head: [headers],
          body: rows,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 1.5, font: 'helvetica' },
          headStyles: { fillColor: [250, 250, 250], textColor: [51, 51, 51], fontStyle: 'bold' },
          columnStyles: this.getAlignmentStyles(this.ledgerHeaders),
          margin: { left: 15, right: 15 },
          willDrawCell: (data) => {
            const isTotalSumRow = customer.rows[data.row.index] && customer.rows[data.row.index]['isSumRow'];
            if (isTotalSumRow) {
              doc.setFillColor(244, 247, 252);
              doc.setFont('helvetica', 'bold');
            }
          },
          didDrawPage: (data) => { currentY = data.cursor.y; }
        });

        currentY += tableSpacing;
      });
    }

    // Footer Block Setup
    if (currentY > 255) { doc.addPage(); currentY = 20; }
    currentY += 8;
    
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(153, 153, 153);
    doc.text(`Generated via System Portal on: ${this.todayDate.toLocaleString()}`, 15, currentY);
    doc.text('Confidential Ledger Document - Internal Audit Track', 15, currentY + 4);

    doc.setDrawColor(119, 119, 119);
    doc.setLineWidth(0.2);
    doc.line(145, currentY + 4, 195, currentY + 4);
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(34, 34, 34);
    doc.text('Authorized Signature & Stamp', 170, currentY + 8, { align: 'center' });

  const filterLabelMap: Record<string, string> = {
  'all':            'Customer_Wise_Sales_Summary_Reports',
  'initial_review': 'Sales_Tax_Charged_Output_Tax_Summary_Report',
  'final_review':   'Sales_Tax_Withheld_Summary_Report',
  'rejected':       'Item_HS_Code_Wise_Summary_Report',
  'submitted':      'Customer_Wise_Invoice_Ledger'
};
const randomNo = Math.floor(1000 + Math.random() * 9000);
const filterLabel = filterLabelMap[this.activeFilter] ?? this.activeFilter;
const dateStr = new Date().toISOString().slice(0, 10);
const clientName = this.client?.sellerBusinessName?.replace(/[^a-zA-Z0-9]/g, '_') ?? 'Client';
const fileNameString = `${clientName}_${filterLabel}_${dateStr}_${randomNo}.pdf`;
doc.save(fileNameString);
  }

  getAlignmentStyles(keys: string[]): any {
    const stylesConfig: any = {};
    keys.forEach((key, index) => {
      const isText = (key === 'customer_name' || key === 'item_description' || key === 'invoice_date');
      stylesConfig[index] = { halign: isText ? 'left' : 'right' };
    });
    return stylesConfig;
  }

  formatPrintDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // ── Filter change ─────────────────────────────────────────────────────────
  changeReportFilter(filter: string) {
    this.activeFilter = filter;
    this.reportGroups = [];
    this.ledgerData = [];
    this.ledgerHeaders = [];
    this.dataKeys = [];
    this.selectedCustomers = [];
    this.searchQuery = '';
    this.filteredCustomerSearch = [];
    this.fromDate = '';
    this.toDate = '';
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  formatHeader(key: string): string {
    return key
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  calculateCustomerTotals(data: any[]): any {
    const totals: any = { isSumRow: true, invoice_date: 'SUM' };
    ['value_sales_excluding_st', 'sales_tax_applicable', 'further_tax', 'total_values'].forEach(key => {
      totals[key] = data.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
    });
    return totals;
  }

  clearDateFilters() {
    this.fromDate = '';
    this.toDate = '';
    this.applyFilters();
  }

  getBadgeClass(status: string): string {
    const map: Record<string, string> = {
      initial_review: 'bg-warning',
      final_review: 'bg-info',
      submitted: 'bg-success',
      rejected: 'bg-danger'
    };
    return map[status] ?? 'bg-secondary';
  }

  filterByStatus(status: string) {
    this.activeFilter = status;
    this.applyFilters();
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  toggleSelection(invoice: any, event: any) {
    if (event.target.checked) this.selectedInvoices.push(invoice);
    else this.selectedInvoices = this.selectedInvoices.filter(i => i.id !== invoice.id);
  }
  isSelected(invoice: any): boolean { return this.selectedInvoices.some(i => i.id === invoice.id); }

  downloadAll() {
    const invoicesData = [];
    Array.from(this.submittedSelection).forEach(id => {
      const inv = this.invoices.find(inv => inv.id === id);
      if (inv) invoicesData.push(inv['invoiceData']);
    });
    this.invoicesPdfService.generateInvoicesPdf({
      invoices: invoicesData
    }).then();
  }

  download(invoice: any) {
    this.invoicesPdfService.generateInvoicesPdf({
      invoices: [invoice.invoiceData]
    }).then();
  }

  viewDetails(id: any) { this.router.navigateByUrl(`/admin/invoice-details?id=${id}`).then(); }
  addNewInvoice(client_id: string) { this.router.navigateByUrl(`/admin/invoice-form?client_id=${client_id}`).then(); }
  bulkInvoice(client_id: string) { this.router.navigateByUrl(`/admin/bulk-invoices?client_id=${client_id}`).then(); }
  bulkSubmissions(client_id: string) { this.router.navigateByUrl(`/admin/queue-submissions?client_id=${client_id}`).then(); }

  async deleteInvoice(invoice: any) {
    if (confirm('Are you sure you want to delete this invoice?')) {
      this.loading = true;
      this.client = await this.serverService.delete<any>(`/admin/invoice/delete?invoice_id=${invoice.id}`);
      await this.fetchClientInvoices();
      this.loading = false;
    }
  }

  public toggleInvoiceSelection(id: string) {
    this.finalReviewSelection.has(id) ? this.finalReviewSelection.delete(id) : this.finalReviewSelection.add(id);
  }
  public toggleSubmittedInvoiceSelection(id: string) {
    this.submittedSelection.has(id) ? this.submittedSelection.delete(id) : this.submittedSelection.add(id);
  }
  public toggleReviewInvoiceSelection(id: string) {
    this.reviewSelection.has(id) ? this.reviewSelection.delete(id) : this.reviewSelection.add(id);
  }
  public isInvoiceSelected(id: string): boolean { return this.finalReviewSelection.has(id); }
  public isSubmittedInvoiceSelected(id: string): boolean { return this.submittedSelection.has(id); }
  public isReviewInvoiceSelected(id: string): boolean { return this.reviewSelection.has(id); }

  public toggleMasterSelection() {
    this.finalReviewSelection.size > 0
      ? this.finalReviewSelection.clear()
      : this.filteredInvoices.forEach(inv => this.finalReviewSelection.add(inv.id));
  }
  public toggleSubmittedMasterSelection() {
    this.submittedSelection.size > 0
      ? this.submittedSelection.clear()
      : this.filteredInvoices.forEach(inv => this.submittedSelection.add(inv.id));
  }
  public toggleReviewMasterSelection() {
    this.reviewSelection.size > 0
      ? this.reviewSelection.clear()
      : this.filteredInvoices.forEach(inv => this.reviewSelection.add(inv.id));
  }

  public async submitSelectedInvoices(): Promise<void> {
    const ids = Array.from(this.finalReviewSelection);
    if (!ids.length) return;
    this.isSubmittingAll = true;
    try {
      if (confirm(`Submit ${ids.length} invoices? This is irreversible.`)) {
        await this.serverService.post('/admin/queue-invoices', { invoice_ids: ids });
        alert(`Successfully submitted ${ids.length} invoices.`);
        this.finalReviewSelection.clear();
        this.router.navigateByUrl(`/admin/queue-submissions?client_id=${this.clientId}`).then();
      }
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail ?? 'Unknown error'}`);
    } finally {
      this.isSubmittingAll = false;
    }
  }

  public async markAsReviewedInvoices(): Promise<void> {
    const ids = Array.from(this.reviewSelection);
    if (!ids.length) return;
    this.loading = true;
    try {
      if (confirm(`Mark ${ids.length} invoices for final review?`)) {
        await this.serverService.put('/admin/bulk-mark-reviewed', { invoice_ids: ids });
        this.reviewSelection.clear();
        await this.fetchClientInvoices();
        await delay(200);
        this.filterByStatus('initial_review');
      }
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail ?? 'Unknown error'}`);
    } finally {
      this.isSubmittingAll = false;
      this.loading = false;
    }
  }

  public async deleteAllInvoices(): Promise<void> {
    const ids = Array.from(this.reviewSelection);
    if (!ids.length) return;
    this.loading = true;
    try {
      if (confirm(`Delete ${ids.length} invoices?`)) {
        await this.serverService.put('/admin/bulk-delete', { invoice_ids: ids });
        this.reviewSelection.clear();
        await this.fetchClientInvoices();
        await delay(200);
        this.filterByStatus('initial_review');
      }
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.detail ?? 'Unknown error'}`);
    } finally {
      this.isSubmittingAll = false;
      this.loading = false;
    }
  }

  public exportToExcel(): void {
    if (!this.filteredInvoices.length) { alert('No data to export.'); return; }
    const formatDateToTemplate = (dateStr: string) => {
      const d = new Date(dateStr);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${d.getDate()}-${months[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };
    const rows: any[] = [];
    this.filteredInvoices.forEach(inv => {
      const data = inv.invoiceData;
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
    const ws = XLSX.utils.json_to_sheet(rows);
    const headerStyle = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFFFFF' } },
      font: { color: { rgb: 'C00000' }, bold: true, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } }
    };
    const dataStyle = { alignment: { horizontal: 'center', vertical: 'center' } };
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[addr]) ws[addr].s = R === 0 ? headerStyle : dataStyle;
      }
    }
    ws['!rows'] = [{ hpx: 40 }];
    ws['!cols'] = Object.keys(rows[0]).map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Bulk_Invoices_Export.xlsx');
  }

  // ── Customer modal ────────────────────────────────────────────────────────
  async openCustomerModal() {
    if (!this.clientId) return;
    try {
      this.loading = true;
      this.filteredCustomerSearch = [];
      this.searchQuery = '';
      if (this.activeFilter === 'rejected') {
        const res = await this.serverService.get<string[]>(`/admin/client/hs-codes?client_id=${this.clientId}`);
        this.allCustomers = res.map(code => ({
          name: this.hsCodeMap.get(code.trim()) || 'Description not found',
          ntn: code
        }));
      } else {
        this.allCustomers = await this.serverService.get<any[]>(`/admin/client/customers?client_id=${this.clientId}`);
      }
      this.onCustomerSearch();
      this.showCustomerModal = true;
    } catch (error) {
      console.error('Error fetching modal data', error);
    } finally {
      this.loading = false;
    }
  }

  onCustomerSearch() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredCustomerSearch = q
      ? this.allCustomers.filter(c =>
          c.name?.toLowerCase().includes(q) || c.ntn?.toLowerCase().includes(q))
      : this.allCustomers.slice(0, 50);
  }

  isCustomerSelected(customer: any): boolean {
    return this.selectedCustomers.some(sc => sc.ntn === customer.ntn);
  }

  toggleCustomerSelection(customer: any) {
    const idx = this.selectedCustomers.findIndex(sc => sc.ntn === customer.ntn);
    idx > -1 ? this.selectedCustomers.splice(idx, 1) : this.selectedCustomers.push(customer);
  }

  addAllFiltered() {
    this.filteredCustomerSearch.forEach(c => {
      if (!this.isCustomerSelected(c)) this.selectedCustomers.push(c);
    });
  }

  removeCustomer(index: number) { this.selectedCustomers.splice(index, 1); }

  goBack(): void { this.location.back(); }
  
  formatNumberValue(val: any): string {
    if (val === undefined || val === null || isNaN(Number(val))) return '0.00';
    return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}