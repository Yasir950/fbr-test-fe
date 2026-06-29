import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as QRCode from 'qrcode';
import { fbrLogoBase64 } from './base-64-img';
import { dropDownValues } from './field.values';
import * as JSZip from 'jszip';

// --- Interfaces for Type Safety ---
interface InvoiceItem {
  hsCode: string;
  hsCodeDescription?: string;
  productDescription: string;
  quantity: number;
  rate: string;
  uoM: string;
  saleType: string;
  valueSalesExcludingST: number;
  fixedNotifiedValueOrRetailPrice: number;
  salesTaxApplicable: number;
  extraTax: number;
  furtherTax: number;
  fedPayable: number;
  salesTaxWithheldAtSource: number;
  discount: number;
  sroScheduleNo?: string;
  sroItemSerialNo?: string;
}

interface Invoice {
  FBRInvoice: string;
  invoiceDate: string;
  sellerBusinessName: string;
  sellerNTNCNIC: string;
  sellerProvince: string;
  invoiceType: string;
  buyerBusinessName: string;
  buyerNTNCNIC: string;
  buyerProvince: string;
  csvInvoiceId: string | null | undefined;
  items: InvoiceItem[];
}

interface PdfData {
  invoices: Invoice[];
   isDraft?: boolean; 
}

@Injectable({
  providedIn: 'root'
})
export class InvoicesPdfService {

  dropDowns = dropDownValues;

  constructor() {
  }

  /**
   * Main entry point to generate the PDF.
   * Handles multiple invoices by placing each on a new page.
   */
public async generateInvoicesPdf(data: PdfData): Promise<void> {
  if (!data.invoices || data.invoices.length === 0) {
    console.warn('No invoices provided to generate PDF.');
    return;
  }
  if (data.invoices.length === 1) {
    const doc = new jsPDF('l', 'pt', 'a4');
    const invoice = data.invoices[0];
    await this.renderInvoicePage(doc, invoice, data.isDraft); // PASS isDraft
    const pdfFileName = this.generatePdfFileName(invoice, data.isDraft);
    doc.save(pdfFileName);
  } else {
    await this.generateZippedPdfs(data);
  }
}

  getCodeDescription(hsCode: string) {
    const raw = this.dropDowns.hsDescriptions.find(
      desc => desc.startsWith(hsCode + ':-')
    );

    if (!raw) {
      return '--';
    }

    const cleaned = raw
      // remove the "hsCode:-" prefix
      .replace(new RegExp(`^${hsCode}:-`), '')
      // remove numbers
      .replace(/[0-9]/g, '')
      // remove special characters (keep letters and spaces)
      .replace(/[^a-zA-Z\s]/g, '')
      // collapse multiple spaces
      .replace(/\s+/g, ' ')
      // trim whitespace
      .trim()
      // limit to 40 characters
      .slice(0, 40);

    return cleaned || '--';
  }

  /**
   * Renders all sections for a single invoice page.
   */
  private async renderInvoicePage(doc: jsPDF, invoice: Invoice, isDraft = false): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  // --- DRAFT WATERMARK ---
  if (isDraft) {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setFontSize(120);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(150, 0, 0);
    doc.text('DRAFT', pageWidth / 2, pageHeight / 2, {
      align: 'center',
      angle: 35,
      baseline: 'middle'
    });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0); // reset
  }
    if (invoice?.csvInvoiceId) {
      doc.setFontSize(8);
      doc.text(`Internal Invoice ID: ${invoice?.csvInvoiceId}`, 10, 585);
    }
    const margin = 40;
    // 1. TOP SECTION: Seller Name (Left) and Logos (Right)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(invoice.sellerBusinessName.toUpperCase(), margin, 50);

    // QR Code Generation
   const qrValue = isDraft ? 'DRAFT - NOT YET SUBMITTED' : invoice.FBRInvoice;
const qrCodeDataUrl = await QRCode.toDataURL(qrValue, { margin: 1, width: 100 });

    // Add FBR Logo (ensure fbrLogoBase64 is populated)
    if (fbrLogoBase64.length > 50) {
      doc.addImage(fbrLogoBase64, 'PNG', pageWidth - margin - 160, 20, 70, 70);
    }
    // Add QR Code
    doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - 80, 15, 80, 80);

    // 2. INFO BLOCK: Seller, Buyer, and Summary
    const sellerInfo = `Business Name:  ${invoice.sellerBusinessName}\nRegistration No:  ${invoice.sellerNTNCNIC}\nProvince:             ${invoice.sellerProvince}`;
    const buyerInfo = `Business Name:  ${invoice.buyerBusinessName}\nRegistration No:  ${invoice.buyerNTNCNIC}\nProvince:             ${invoice.buyerProvince}`;

    // Format Tax Period (YYYYMM) and Invoice Date (DD-MMM-YYYY)
    const dateObj = new Date(invoice.invoiceDate);
    const taxPeriod = dateObj.getFullYear().toString() + (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');

    const fbrDisplay = isDraft ? 'DRAFT - PENDING SUBMISSION' : invoice.FBRInvoice;

  const summaryInfo = `FBR Invoice No:  ${fbrDisplay}\nInvoice Date:       ${formattedDate}\nInvoice Type:       ${invoice.invoiceType}\nTax Period:          ${taxPeriod}`;

    autoTable(doc, {
      startY: 130,
      theme: 'plain',
      body: [
        ['Seller Information', 'Buyer Information', 'Invoice Summary'],
        [sellerInfo, buyerInfo, summaryInfo]
      ],
      styles: { cellPadding: 5 },
      columnStyles: {
        0: { cellWidth: 260 },
        1: { cellWidth: 260 },
        2: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.row.index === 0) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 11;
        } else {
          data.cell.styles.fontSize = 9;
          data.cell.styles.lineColor = [200, 200, 200];
        }
      }
    });

    // 3. ITEMS TABLE: Table Headers and Data
    const itemHeaders = [[
      'Sr. No.', 'HS Code', 'HS Code Description', 'Product Description', 'Sales Type',
      'Qty', 'UoM', 'Rate', 'Sales Value', 'Retail Price', 'Sales Tax',
      'Extra Tax', 'Further Tax', 'FED', 'ST WHT', 'Discount', 'SRO No.', 'SRO Item'
    ]];

    const itemBody = invoice.items.map((item, i) => [
      i + 1,
      item.hsCode,
      this.getCodeDescription(item.hsCode),
      item.productDescription,
      item['saleType'],
      item.quantity.toFixed(2),
      item['uoM'],
      item.rate,
      (item.valueSalesExcludingST || 0).toFixed(2),
      (item['fixedNotifiedValueOrRetailPrice'] || 0).toFixed(2),
      (item['salesTaxApplicable'] || 0).toFixed(2),
      (item['extraTax'] || 0).toFixed(2),
      (item['furtherTax'] || 0).toFixed(2),
      (item['fedPayable'] || 0).toFixed(2),
      (item['salesTaxWithheldAtSource'] || 0).toFixed(2),
      (item['discount'] || 0).toFixed(2),
      item['sroScheduleNo'] || '',
      item['sroItemSerialNo'] || ''
    ]);


    // 4. CALCULATE TOTALS
    const sums = { val: 0, ret: 0, st: 0, ex: 0, fur: 0, fed: 0, wht: 0, disc: 0 };
    invoice.items.forEach(item => {
      sums.val += Number(item?.valueSalesExcludingST) || 0;
      sums.ret += Number(item?.fixedNotifiedValueOrRetailPrice) || 0;
      sums.st += Number(item?.salesTaxApplicable) || 0;
      sums.ex += Number(item?.extraTax) || 0;
      sums.fur += Number(item?.furtherTax) || 0;
      sums.fed += Number(item?.fedPayable) || 0;
      sums.wht += Number(item?.salesTaxWithheldAtSource) || 0;
      sums.disc += Number(item?.discount) || 0;
    });

    const itemFooter = [[
      { content: 'Total:', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
      sums.val.toFixed(2),
      sums.ret.toFixed(2),
      sums.st.toFixed(2),
      sums.ex.toFixed(2),
      sums.fur.toFixed(2),
      sums.fed.toFixed(2),
      sums.wht.toFixed(2),
      sums.disc.toFixed(2),
      '', ''
    ]];


    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: itemHeaders,
      body: itemBody,
      // @ts-ignore
      foot: itemFooter,
      theme: 'grid',
      headStyles: { fillColor: [245, 245, 245], textColor: 20, fontSize: 7, halign: 'right' },
      styles: { fontSize: 7, valign: 'middle' },
      footStyles: { fillColor: [245, 245, 245], textColor: 20, fontSize: 7, fontStyle: 'bold', halign: 'right' },
      columnStyles: {
        0: { halign: 'center' },
        5: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
        12: { halign: 'right' },
        13: { halign: 'right' },
        14: { halign: 'right' },
        15: { halign: 'right' }
      }
    });
  }

  /**
   * NEW: Creates multiple PDF documents in memory, zips them, and triggers a download.
   */
 private async generateZippedPdfs(data: PdfData): Promise<void> {
  const zip = new JSZip();
  for (const invoice of data.invoices) {
    const doc = new jsPDF('l', 'pt', 'a4');
    await this.renderInvoicePage(doc, invoice, data.isDraft); // PASS isDraft
    const pdfFileName = this.generatePdfFileName(invoice, data.isDraft);
    const pdfBlob = doc.output('blob');
    zip.file(pdfFileName, pdfBlob);
  }

    // Generate the final zip file as a blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Generate the zip file name
    const sellerName = data.invoices[0]?.sellerBusinessName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'invoices';
    const timestamp = new Date().getTime();
    const zipFileName = `${sellerName}_${timestamp}.zip`;

    // Trigger the download of the zip file
    this.triggerDownload(zipBlob, zipFileName);
  }

  /**
   * Helper function to generate a unique PDF filename based on the required convention.
   */
private generatePdfFileName(invoice: Invoice, isDraft = false): string {
  const buyerName = invoice.buyerBusinessName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fbrInvoice = isDraft ? 'DRAFT' : invoice.FBRInvoice;
  const dateObj = new Date(invoice.invoiceDate);
  const formattedDate = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  const randomString = Math.random().toString(36).substring(2, 8);
  return `${buyerName}_${fbrInvoice}_${formattedDate}_${randomString}.pdf`;
}

  /**
   * Helper function to trigger a file download from a Blob.
   */
  private triggerDownload(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Clean up the object URL
  }


}
