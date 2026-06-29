import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../../theme/shared/shared.module';
import { ServerService } from '../../../../services/server.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AxiosError } from 'axios';
import { getAclLevel } from '../../../../services/utility'; 
import { Location } from '@angular/common';

// --- Interfaces for strong typing our complex JSON object ---
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  cellNumber1: string;
  cellNumber2: string;
  type?: string;
}

export interface HistoryItem {
  status: string;
  timestamp: string;
  user: User;
  comments?: string;
}

export interface InvoiceItem {
  hsCode: string;
  productDescription: string;
  rate: string;
  uoM: string;
  quantity: number;
  valueSalesExcludingST: number;
  salesTaxApplicable: number;
  [key: string]: any; 
}

export interface InvoiceData {
  invoice_id: string;
  invoiceType: string;
  invoiceDate: string;
  sellerNTNCNIC: string;
  sellerBusinessName: string;
  sellerProvince: string;
  sellerAddress: string;
  buyerNTNCNIC: string;
  buyerBusinessName: string;
  buyerProvince: string;
  buyerAddress: string;
  scenarioId: string;
  invoiceRefNo: string;
  csvInvoiceId: string | null | undefined;
  items: InvoiceItem[];
  displayProperties?: { key: string; label: string; value: any }[];
  [key: string]: any; 
}

export interface ApiResponseError {
  statusCode: string;
  status: string;
  errorCode: string | null;
  error: string; 
  invoiceStatuses: InvoiceStatusItem[] | null; 
}

export interface InvoiceStatusItem {
  itemSNo: string;
  statusCode: string;
  status: string;
  invoiceNo: string | null;
  errorCode: string;
  error: string;
}

export interface FbrApiError {
  error: string;
  fbr_response?: {
    Code: string;
    error: string;
  };
}

// Custom interface wrapper to structure parsed UI views cleanly
export interface ParsedUiError {
  type: 'standard' | 'fbr_raw' | 'fallback';
  data?: ApiResponseError;
  errorMsg?: string;
  fbrCode?: string;
  fbrError?: string;
}

export interface Invoice {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  client_id: string;
  response: { date: string, invoiceNumber: string };
  submitter: User;
  history: HistoryItem[];
  invoice_data: InvoiceData;
  error: any; // Kept as any to dynamically accept both original object structures and incoming raw string errors
}

@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './invoice-details.component.html',
  styleUrls: ['./invoice-details.component.scss']
})
export default class InvoiceDetailsComponent implements OnInit {
  invoice: Invoice | null = null;
  isLoading = true;
  isUpdatingStatus = false;
  error: string | null = null;
  invoiceId: string = null;
  public aclLevel = getAclLevel();
  
  // Property to hold structured error details bound to the HTML template layout
  public UI_ErrorDetails: ParsedUiError | null = null;

  readonly itemDisplayOrder = [
    { key: 'hsCode', label: 'HS Code' },
    { key: 'productDescription', label: 'Product Description' },
    { key: 'rate', label: 'Rate' },
    { key: 'uoM', label: 'Unit of Measurement' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'valueSalesExcludingST', label: 'Value (Excl. ST)' },
    { key: 'salesTaxApplicable', label: 'Sales Tax Applicable' },
    { key: 'totalValues', label: 'Total Value' },
    { key: 'fixedNotifiedValueOrRetailPrice', label: 'Fixed Notified Value/Retail Price' },
    { key: 'salesTaxWithheldAtSource', label: 'ST Withheld at Source' },
    { key: 'furtherTax', label: 'Further Tax' },
    { key: 'extraTax', label: 'Extra Tax' },
    { key: 'fedPayable', label: 'FED Payable' },
    { key: 'discount', label: 'Discount' },
    { key: 'saleType', label: 'Sale Type' },
    { key: 'sroScheduleNo', label: 'SRO Schedule No' },
    { key: 'sroItemSerialNo', label: 'SRO Item Serial No' }
  ];

  itemCollapsedStates: boolean[] = [];
  statusUpdateForm: FormGroup;
  availableStatuses = ['initial_review', 'final_review', 'rejected'];
  isSubmitting = false;
  errorMessages: string[] = [];

  constructor(
    private fb: FormBuilder, 
    private serverService: ServerService, 
    private router: Router, 
    private route: ActivatedRoute, 
    private location: Location
  ) {}

  ngOnInit(): void {
    this.statusUpdateForm = this.fb.group({
      status: ['', Validators.required],
      comments: ['', Validators.required]
    });
    this.fetchInvoiceDetails().then();
  }

  async fetchInvoiceDetails() {
    this.isLoading = true;
    this.invoiceId = this.route.snapshot.queryParamMap.get('id');
    if (this.invoiceId) {
      try {
        const data = await this.serverService.get<any>(`/admin/get-invoice?invoice_id=${this.invoiceId}`);
        this.invoice = this.processInvoiceData(data as Invoice);
        
        // Populate the specific analytical layout model for error alerts
        this.UI_ErrorDetails = this.resolveErrorStructure(this.invoice?.error);
        
        console.log(this.invoice);
        if (this.invoice) {
          this.statusUpdateForm.get('status').setValue(this.invoice.status);
        }
        this.initializeAccordionState();
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error(this.invoiceId);
    }
    this.isLoading = false;
  }

  /**
   * Evaluates the type configuration of 'error' dynamically.
   * If it's a serialized single-quoted text string from Python, converts it to valid JSON and extracts properties.
   */
  private resolveErrorStructure(errorPayload: any): ParsedUiError | null {
    if (!errorPayload) return null;

    // Type Variant 1: Object shape enclosing standard validation configurations
    if (typeof errorPayload === 'object' && errorPayload.validationResponse) {
      return {
        type: 'standard',
        data: errorPayload.validationResponse
      };
    }

    // Type Variant 2: Literal string format (e.g., Python serialized nested API dictionaries)
    if (typeof errorPayload === 'string') {
      try {
        // Formats single quotes safely to valid JSON notation rules
        const cleanJsonString = errorPayload.replace(/'/g, '"');
        const parsed = JSON.parse(cleanJsonString);
        
        return {
          type: 'fbr_raw',
          errorMsg: parsed.error,
          fbrCode: parsed.fbr_response?.Code,
          fbrError: parsed.fbr_response?.error
        };
      } catch (e) {
        // Fallback catch block: preserves raw string strings intact if structural analysis breaks down
        return { 
          type: 'fallback', 
          errorMsg: errorPayload 
        };
      }
    }

    return null;
  }

  initializeAccordionState(): void {
    if (this.invoice?.invoice_data?.items) {
      const shouldCollapse = this.invoice.invoice_data.items.length > 1;
      this.itemCollapsedStates = this.invoice.invoice_data.items.map(() => shouldCollapse);
    }
  }

  toggleItem(index: number): void {
    this.itemCollapsedStates[index] = !this.itemCollapsedStates[index];
  }

  getStatusInfo(status: string): { color: string; icon: string } {
    switch (status) {
      case 'submitted':
        return { color: 'text-bg-success', icon: 'ti ti-send' };
      case 'initial_review':
        return { color: 'text-bg-info', icon: 'ti ti-file-search' };
      case 'final_review':
        return { color: 'text-bg-warning', icon: 'ti ti-file-check' };
      case 'rejected':
        return { color: 'text-bg-danger', icon: 'ti ti-file-x' };
      default:
        return { color: 'text-bg-secondary', icon: 'ti ti-file-info' };
    }
  }

  async updateStatus() {
    if (this.statusUpdateForm.invalid) {
      return;
    }
    this.isUpdatingStatus = true;
    try {
      await this.serverService.put<any>(`/admin/update-invoice-status?invoice_id=${this.invoiceId}`, this.statusUpdateForm.getRawValue());
      alert('Status updated successfully!');
      this.statusUpdateForm.reset();
      setTimeout(() => {
        this.fetchInvoiceDetails().then();
      }, 300);
    } catch (e) {
      this.error = 'Failed to load invoice details.';
    }
    this.isUpdatingStatus = false;
  }

  editInvoiceAction() {
    this.router.navigateByUrl(`admin/edit-invoice-form?client_id=${this.invoice.client_id}&invoice_id=${this.invoiceId}`).then();
  }

  async onSubmit() {
    this.isSubmitting = true;
    try {
      const post_data = this.invoice.invoice_data;
      post_data.items.forEach((i) => {
        delete i['displayProperties'];
      });
      const response: any = await this.serverService.post(`/admin/submit-invoice?client_id=${this.invoice.client_id}&invoice_id=${this.invoiceId}`, post_data);
      const validate = response.response.validationResponse;
      if (validate.status.toString().toUpperCase() === 'VALID') { 
        alert('Invoice is submitted to FBR successfully!');
        setTimeout(() => {
          this.fetchInvoiceDetails().then();
        }, 300);
      } else {
        this.errorMessages = this.parseServerError(response.response);
      }
    } catch (e: any) {
      const messages = e.response?.data?.detail ?? e.message;
      if (typeof messages === 'string') {
        this.errorMessages.push(messages);
      } else {
        this.errorMessages = this.parseServerError(e.response?.data?.detail);
      }
    }
    setTimeout(() => {
      this.errorMessages = [];
    }, 1000 * 15);
    this.isSubmitting = false;
  }

  private processInvoiceData(invoice: Invoice): Invoice {
    invoice.invoice_data.items = invoice.invoice_data.items.map(item => {
      item['displayProperties'] = this.itemDisplayOrder
        .filter(prop => item.hasOwnProperty(prop.key))
        .map(prop => ({
          key: prop.key,
          label: prop.label,
          value: item[prop.key]
        }));
      return item;
    });
    return invoice;
  }

  private parseServerError(response: any): string[] {
    let errors: string[] = [];
    if (response?.validationResponse) {
      const validation = response.validationResponse;
      if (validation.statusCode === '01' && validation.error) {
        errors.push(validation.error);
      }
      if (validation.invoiceStatuses && Array.isArray(validation.invoiceStatuses)) {
        validation.invoiceStatuses.forEach((item: any) => {
          if (item.statusCode === '01' && item.error) {
            errors.push(`Item #${item.itemSNo}: ${item.error}`);
          }
        });
      }
    } else if (response?.message?.fault) {
      errors.push(response?.message?.fault?.description);
    }
    return errors;
  }

  goBack(): void {
    this.location.back();
  }

  formatToTwoDecimals(value: any): any {
    if (value === null || value === undefined) return value;
    if (!isFinite(value)) return value;
    return Number(value).toFixed(2);
  }
}