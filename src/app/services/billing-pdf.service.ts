import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';

// --- Interfaces for Type Safety ---
interface Company {
  name: string;
}

interface Client {
  name: string;
  ntn: string;
}

interface Expense {
  expenseAmount: number;
  expenseDescription: string;
}

interface BillDetails {
  _id: string;
  created_at: string;
  updated_at: string;
  amount: number;
  costPerInvoice: number;
  totalInvoices: number;
  otherExpenses: Expense[];
  totalChargeableAmount: number;
  status: 'PAID' | 'UNPAID';
}

interface Bill {
  month: string;
  invoicesSubmitted: number;
  status: 'PAID' | 'UNPAID';
  bill: BillDetails;
}

export interface PdfBillData {
  company: Company;
  client: Client;
  bill: Bill;
}

// Extend the UserOptions interface for type safety with autoTable
interface AutoTableOptions extends UserOptions {
  body?: any;
}


@Injectable({
  providedIn: 'root'
})
export class BillingPdfService {

  constructor() {
  }

  public generateClientBill(data: PdfBillData): void {
    const doc = new jsPDF('p', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const billDetails = data.bill.bill;

    // --- 1. Header ---
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(data.company.name, 40, 50);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('INVOICE', pageWidth - 40, 50, { align: 'right' });

    doc.setLineWidth(1);
    doc.line(40, 65, pageWidth - 40, 65);

    // --- 2. Client Info and Bill Summary ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0); // Gray color for labels
    doc.text('BILL TO:', 40, 90);
    // doc.text('BILL ID:', pageWidth - 150, 90);
    // doc.text('DATE OF ISSUE:', pageWidth - 150, 105);

    doc.setTextColor(100); // Black color for values
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(data.client.name, 40, 105);
    doc.setFont('helvetica', 'normal');
    doc.text(`NTN: ${data.client.ntn}`, 40, 120);

    // doc.text(billDetails._id, pageWidth - 40, 90, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(new Date(billDetails.created_at).toLocaleDateString('en-GB'), pageWidth - 40, 105, { align: 'right' }, {});

    // --- 3. Bill Title ---
    const billingMonth = new Date(data.bill.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Bill for Services in ${billingMonth}`, 40, 160);

    // --- 4. Charges Table ---
    const tableBody = [];
    // Main service charges row
    tableBody.push([
      'Service Charges for Invoices',
      // `${billDetails.totalInvoices} Invoices @ ${billDetails.costPerInvoice.toLocaleString()} PKR / Invoice`
      `${billDetails.amount.toLocaleString()} PKR for ${billDetails.totalInvoices} Invoices`
    ]);
    // Other expenses rows
    billDetails.otherExpenses.forEach(expense => {
      tableBody.push([
        expense.expenseDescription,
        // '', // No details for expenses
        `${expense.expenseAmount.toLocaleString()} PKR`
      ]);
    });

    autoTable(doc, {
      startY: 180,
      head: [['Description', 'Amount (PKR)']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [34, 49, 63], // A dark, professional blue/gray
        textColor: 255,
        fontStyle: 'bold'
      },
      columnStyles: {
        2: { halign: 'right' } // Right-align the amount column
      },
      // Add a custom-styled total row at the end
      didParseCell: (data) => {
        if (data.row.index >= tableBody.length) { // Target footer cells if you add them, or use a specific marker
          // In this simple case, we add the total row manually after the table
        }
      }
    } as AutoTableOptions);

    // --- 5. Total Amount ---
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL AMOUNT DUE:', pageWidth - 250, finalY);
    doc.text(`${billDetails.totalChargeableAmount.toLocaleString()} PKR`, pageWidth - 40, finalY, { align: 'right' });

    // --- 6. "PAID" Stamp (Conditional) ---
    if (billDetails.status === 'PAID') {
      doc.setFontSize(48);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 167, 69); // Green color for PAID stamp
      doc.saveGraphicsState(); // Save current state
      doc.setGState(new (doc as any).GState({ opacity: 0.2 })); // Set transparency

      // Rotate and draw the text and bounding box
      // doc.rotate(-25, { x: pageWidth / 2, y: finalY + 80 });
      doc.text('PAID', pageWidth / 2, finalY + 300, { align: 'center' });
      doc.restoreGraphicsState(); // Restore state (transparency, rotation)

      // Add payment date below the total
      finalY += 35;
      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'normal');
      doc.text(`Paid on: ${new Date(billDetails.updated_at).toLocaleString('en-GB')}`, pageWidth - 40, finalY, { align: 'right' });
    }

    // --- 7. Footer ---
    doc.setFontSize(9);
    doc.setTextColor(150);
    const footerText = 'Thank you for your business! Please contact us with any questions regarding this invoice.';
    doc.text(footerText, pageWidth / 2, pageHeight - 40, { align: 'center' });

    // --- Save the PDF ---
    const safeClientName = data.client.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    doc.save(`bill_${safeClientName}_${data.bill.month}.pdf`);
  }
}
