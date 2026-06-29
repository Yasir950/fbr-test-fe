import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import * as XLSX from 'xlsx'; // Import the xlsx library
// Assuming these are correctly imported from your project structure
import { dropDownValues } from '../../../services/field.values';
import { ServerService } from '../../../services/server.service';
import { ClientList } from '../../../services/app.models';
import { SharedModule } from '../../../theme/shared/shared.module';
import { Location } from '@angular/common';

// --- Interfaces for Type Safety ---
interface ExcelRow {
  'Your_Invoice_ID*': string;
  'Invoice_Type*': string;
  'Invoice_Date_YYYY-MM-DD*': any; // Can be number (Excel date) or string
  'Buyer_NTN_CNIC*': string;
  'Buyer_Business_Name*': string;
  'Buyer_Province*': string;
  'Buyer_Address*': string;
  'Buyer_Registration_Type*': string;
  'Invoice_Ref_No'?: string;
  'Item_HS_Code*': string;
  'Item_Product_Description*': string;
  'Item_Rate*': string;
  'Item_UoM*': string;
  'Item_Quantity*': number;
  'Item_Value_Sales_Excluding_ST*': number;

  // Add other item fields for type safety
  [key: string]: any;
}

@Component({
  selector: 'app-bulk-invoice-upload',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './bulk-invoice-upload.component.html',
  styleUrls: ['./bulk-invoice-upload.component.scss']
})
export default class BulkInvoiceUploadComponent implements OnInit {
  isProcessing = false;
  isDragging = false;
  fileName: string | null = null;
  validationError: string | null = null;
  successMessage: string | null = null;

  public selectedFile: File | null = null;
  public client: ClientList;
  public loading = true;
  private allDropDowns = dropDownValues;
  // Pre-compute sets for fast validation lookups
  private validProvinces = new Set(this.allDropDowns.provinces.map((e) => {
    return e.toString().trim();
  }));
  private validDocumentTypes = new Set(this.allDropDowns.documentTypes.map((e) => {
    return e.toString().trim();
  }));
  private validHsCodes = new Set(this.allDropDowns.hsCodes.map((e) => {
    return e.toString().trim();
  }));
  private validSalesTypes = new Set(this.allDropDowns.salesTypes.map((e) => {
    return e.toString().trim();
  }));
  private validUoMs = new Set(this.allDropDowns.uom.map((e) => {
    return e.toString().trim();
  }));

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private serverService: ServerService,
    private location: Location
  ) {
  }

  async ngOnInit() {
    // 1. Fetch seller data first
    const clientId = this.route.snapshot.queryParamMap.get('client_id');
    if (!clientId) throw new Error('Client ID is missing from the URL.');
    this.client = await this.serverService.get<ClientList>(`/admin/get_client_summary?id=${clientId}`);
    this.loading = false;
  }

  onFileChange(event: any): void {
    const file = event.target.files ? event.target.files[0] : event;
    if (file) {
      this.selectedFile = file;
      this.fileName = file.name;
      this.validationError = null;
      this.successMessage = null;
    }
  }

  async processFile(): Promise<void> {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    this.validationError = null;
    this.successMessage = null;

    try {
      // 1. Fetch seller data first (or just get client_id)
      const clientId = this.route.snapshot.queryParamMap.get('client_id');
      if (!clientId) {
        throw new Error('Client ID is missing from the URL. Cannot proceed with upload.');
      }
      // 2. Read and parse the Excel file
      const data = await this.readExcelFile(this.selectedFile);
      // 3. Validate every row
      this.validateAllRows(data);

      // 4. Transform flat data into nested invoice structure
      const finalInvoices = await this.transformData(data);
      if (finalInvoices.length === 0) {
        throw new Error('The Excel file is valid but contains no invoices to upload.');
      }

      // 5. Send the bulk data to the new backend endpoint
      try {
        // The second argument 'finalInvoices' is the request body (the array of invoice objects)
        const response: any = await this.serverService.post(`/admin/create-bulk-invoice?client_id=${clientId}`, finalInvoices);

        // // Assuming your 'OperationSuccessful' model returns a 'detail' field
        alert(response?.detail ?? `${finalInvoices.length} invoices were successfully uploaded.`);

        this.reset(); // Clear the file input on success

        this.router.navigateByUrl(`/admin/client-invoices?id=${clientId}`).then();

      } catch (e) {
        // Handle API-specific errors (e.g., from Axios)
        // @ts-ignore
        const errDetail = e.response?.data?.detail ?? 'An unknown error occurred while communicating with the server.';
        throw new Error(`API Error: ${errDetail}`);
      }

    } catch (error) {
      // This will catch errors from validation, file reading, or the API call
      this.validationError = error.message;
    } finally {
      // This block will run regardless of success or failure
      this.isProcessing = false;
    }
  }

  public downloadTemplate(): void {
    // Create an anchor element
    const link = document.createElement('a');

    // Set the path to your file in the assets folder
    link.href = 'assets/bulk_invoices_template.xlsx';

    // The 'download' attribute tells the browser to download the file instead of navigating to it
    link.download = 'bulk_invoices_template.xlsx';

    // Append the link to the body (required for Firefox)
    document.body.appendChild(link);

    // Programmatically click the link to trigger the download
    link.click();

    // Clean up and remove the link from the DOM
    document.body.removeChild(link);
  }

  // Drag and drop handlers
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.onFileChange({ target: { files: [file] } });
    }
  }

  reset() {
    this.selectedFile = null;
    this.fileName = null;
  }

  private readExcelFile(file: File): Promise<ExcelRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: false, // Don't let it create Date objects
        cellNF: true,    // Preserve number formats
        cellText: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
        resolve(jsonData);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  }

  private validateAllRows(rows: ExcelRow[]): void {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel rows are 1-based, plus header row

      // Your_Invoice_ID
      if (!row['Your_Invoice_ID*']) throw new Error(`Row ${rowNum}: 'Your_Invoice_ID' cannot be empty.`);

      // Invoice_Type
      if (!row['Invoice_Type*'] || !this.validDocumentTypes.has(row['Invoice_Type*'])) {
        throw new Error(`Row ${rowNum}: Invalid 'Invoice_Type'. Please refer to Dropdowns > Document Types for correct values.`);
      }

     // Invoice_Date
let rawDateValue = row['Invoice_Date_YYYY-MM-DD*'];

// 1. Helper to convert Excel Serial (46023) to YYYY-MM-DD
const convertExcelSerialDate = (serial: number): string => {
  // Excel bug: it treats 1900 as a leap year, so we handle the offset
  // We use Date.UTC to prevent local timezone shifting
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// 2. Check if the value is a number (Excel Serial)
if (typeof rawDateValue === 'number' || !isNaN(Number(rawDateValue)) && !String(rawDateValue).includes('-')) {
  rawDateValue = convertExcelSerialDate(Number(rawDateValue));
  row['Invoice_Date_YYYY-MM-DD*'] = rawDateValue;
} 
// 3. If it's a Date object
else if (rawDateValue instanceof Date) {
  const year = rawDateValue.getFullYear();
  const month = String(rawDateValue.getMonth() + 1).padStart(2, '0');
  const day = String(rawDateValue.getDate()).padStart(2, '0');
  rawDateValue = `${year}-${month}-${day}`;
  row['Invoice_Date_YYYY-MM-DD*'] = rawDateValue;
}

// Final Validation
if (!rawDateValue || !dateRegex.test(String(rawDateValue))) {
  throw new Error(`Row ${rowNum}: 'Invoice_Date' must be YYYY-MM-DD. Got: ${rawDateValue}`);
}
      // Buyer fields
      if (!row['Buyer_NTN_CNIC*']) throw new Error(`Row ${rowNum}: 'Buyer_NTN_CNIC' cannot be empty.`);
      if (!row['Buyer_Business_Name*']) throw new Error(`Row ${rowNum}: 'Buyer_Business_Name' cannot be empty.`);
      if (!row['Buyer_Province*'] || !this.validProvinces.has(row['Buyer_Province*'])) {
        throw new Error(`Row ${rowNum}: Invalid 'Buyer_Province'. Please refer to Dropdowns > Provinces.`);
      }
      if (!row['Buyer_Address*']) throw new Error(`Row ${rowNum}: 'Buyer_Address' cannot be empty.`);
      if (!['Registered', 'Unregistered'].includes(row['Buyer_Registration_Type*'])) {
        throw new Error(`Row ${rowNum}: 'Buyer_Registration_Type' must be 'Registered' or 'Unregistered'.`);
      }

      // Item fields
      if (!row['Item_HS_Code*'] || !this.validHsCodes.has(row['Item_HS_Code*'].toString())) {
        throw new Error(`Row ${rowNum}: Invalid 'Item_HS_Code'. Please refer to Dropdowns > HS Codes.`);
      }
      if (!row['Item_Product_Description*']) throw new Error(`Row ${rowNum}: 'Item_Product_Description' cannot be empty.`);
      if (!row['Item_Sale_Type*'] || !this.validSalesTypes.has(row['Item_Sale_Type*'])) {
        throw new Error(`Row ${rowNum}: Invalid 'Item_Sale_Type'. Please refer to Dropdowns > Sales Types.`);
      }
      if (!row['Item_UoM*'] || !this.validUoMs.has(row['Item_UoM*'])) {
        throw new Error(`Row ${rowNum}: Invalid 'Item_UoM'. Please refer to Dropdowns > Unit Of Measurements.`);
      }

      // Check all required number fields
      const requiredNumberFields = [
        'Item_Quantity*', 'Item_Total_Values*', 'Item_Value_Sales_Excluding_ST*', 'Item_Fixed_Notified_Value_Or_Retail_Price*',
        'Item_Sales_Tax_Applicable*', 'Item_Sales_Tax_Withheld_At_Source*', 'Item_Extra_Tax*', 'Item_Further_Tax*',
        'Item_FED_Payable*', 'Item_Discount*'
      ];
      for (const field of requiredNumberFields) {
        if (row[field] === undefined || row[field] === null || typeof row[field] !== 'number') {
          throw new Error(`Row ${rowNum}: Column '${field.replace('*', '')}' must be a valid number and cannot be empty.`);
        }
      }
    }
  }

  private async transformData(rows: any[]): Promise<any[]> {
  const groupedByInvoiceId = new Map<string, any>();

  const roundToTwo = (num: any): number => {
    return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
  };

  // Helper to clean NTN/CNIC based on your digit rules
  const formatBuyerId = (val: any): string => {
    if (!val) return '';
    const cleanStr = val.toString().replace(/[^0-9a-zA-Z]/g, '');
    
    if (cleanStr.length < 10) {
      return cleanStr.substring(0, 7);
    } else if (cleanStr.length >= 13) {
      return cleanStr.substring(0, 13);
    }
    return cleanStr;
  };

  for (const row of rows) {
    const invoiceId = row['Your_Invoice_ID*']?.toString();
    const cleanedNtnCnic = formatBuyerId(row['Buyer_NTN_CNIC*']);

    const item = {
      hsCode: row['Item_HS_Code*']?.toString(),
      productDescription: row['Item_Product_Description*']?.toString(),
      rate: row['Item_Rate*']?.toString(),
      uoM: row['Item_UoM*']?.toString(),
      quantity: roundToTwo(row['Item_Quantity*']),
      totalValues: roundToTwo(row['Item_Total_Values*']),
      valueSalesExcludingST: roundToTwo(row['Item_Value_Sales_Excluding_ST*']),
      salesTaxApplicable: roundToTwo(row['Item_Sales_Tax_Applicable*']),
      furtherTax: roundToTwo(row['Item_Further_Tax*']),
      fixedNotifiedValueOrRetailPrice: roundToTwo(row['Item_Fixed_Notified_Value_Or_Retail_Price*']),
      salesTaxWithheldAtSource: roundToTwo(row['Item_Sales_Tax_Withheld_At_Source*']),
      extraTax: roundToTwo(row['Item_Extra_Tax*']),
      fedPayable: roundToTwo(row['Item_FED_Payable*']),
      discount: roundToTwo(row['Item_Discount*']),
      saleType: row['Item_Sale_Type*'],
      sroScheduleNo: row['Item_SRO_Schedule_No']?.toString() || '',
      sroItemSerialNo: row['Item_SRO_Item_Serial_No']?.toString() || ''
    };

    if (!groupedByInvoiceId.has(invoiceId)) {
      // 1. Call the API with the cleaned NTN
      let fetchedRegType = row['Buyer_Registration_Type*']?.toString(); // fallback
      
      try {
        const regTypeData = await this.serverService.get<{ type: string }>(`/fbr/get_reg_type?reg=${cleanedNtnCnic}`);
        if (regTypeData && regTypeData.type) {
          fetchedRegType = this.capitalizeFirstLetter(regTypeData.type);
        }
      } catch (error) {
        console.error(`Failed to fetch reg type for ${cleanedNtnCnic}:`, error);
      }

      groupedByInvoiceId.set(invoiceId, {
        invoiceType: row['Invoice_Type*']?.toString(),
        invoiceDate: row['Invoice_Date_YYYY-MM-DD*']?.toString(),
        sellerNTNCNIC: this.client.sellerNTNCNIC?.toString(),
        sellerBusinessName: this.client.sellerBusinessName?.toString(),
        sellerProvince: this.client.sellerProvince?.toString(),
        sellerAddress: this.client.sellerAddress?.toString(),
        buyerNTNCNIC: cleanedNtnCnic,
        buyerBusinessName: row['Buyer_Business_Name*']?.toString(),
        buyerProvince: row['Buyer_Province*']?.toString(),
        buyerAddress: row['Buyer_Address*']?.toString(),
        // 2. Setting the value from API response
        buyerRegistrationType: fetchedRegType, 
        invoiceRefNo: row['Invoice_Ref_No'] || null,
        reason: row['Reason'] || '',
        items: [],
        csvInvoiceId: invoiceId
      });
    }

    groupedByInvoiceId.get(invoiceId).items.push(item);
  }

  return Array.from(groupedByInvoiceId.values());
}

// Ensure you have this helper method available in your class
private capitalizeFirstLetter(string: string): string {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}
   formatBuyerId (val: any): string {
    if (!val) return '';
    // Remove all non-numeric characters (dashes, spaces, etc.)
    const cleanStr = val.toString().replace(/\D/g, '');
    
    if (cleanStr.length < 10) {
      return cleanStr.substring(0, 7);
    } else if (cleanStr.length >= 13) {
      return cleanStr.substring(0, 13);
    }
    return cleanStr;
  }
   goBack(): void {
    this.location.back();
  }
}
