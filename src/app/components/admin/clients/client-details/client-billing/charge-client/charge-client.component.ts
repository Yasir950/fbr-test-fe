import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { ServerService } from '../../../../../../services/server.service';
import { Client } from '../../../../../../services/app.models';
import { ToastService } from '../../../../../../services/toast.service';

// Interfaces for strong typing the data passed into the modal
interface Bill {
  id: number;
  month: string;
  invoicesSubmitted: number;
  status: 'Paid' | 'Unpaid' | 'Cancelled';
}

@Component({
  selector: 'app-charge-client',
  templateUrl: './charge-client.component.html',
  styleUrls: ['./charge-client.component.scss']
})
export class ChargeClientComponent implements OnInit, OnDestroy {
  @Input() client: Client;
  @Input() bill: Bill;

  chargeForm: FormGroup;
  isLoading = false;
  totalChargeableAmount = 0;
  private formChangesSubscription: Subscription;

  constructor(public activeModal: NgbActiveModal, private fb: FormBuilder, private serverService: ServerService, private toast: ToastService) {
  }

  // Helper getters for easy template access
  get f(): any {
    return this.chargeForm.controls;
  }

  get otherExpenses() {
    return this.chargeForm.get('otherExpenses') as FormArray;
  }

  ngOnInit(): void {
    this.chargeForm = this.fb.group({
      amount: [null, Validators.required],
      costPerInvoice: [null, Validators.required],
      totalInvoices: [this?.bill?.invoicesSubmitted ?? 0, Validators.required],
      otherExpenses: this.fb.array([]) // Initialize the FormArray for expenses
    });
    this.addExpense();
    this.setupFormListeners();
  }

  ngOnDestroy(): void {
    // Clean up the subscription to prevent memory leaks
    if (this.formChangesSubscription) {
      this.formChangesSubscription.unsubscribe();
    }
  }

  // --- Methods to manage Other Expenses FormArray ---
  addExpense(): void {
    const expenseForm = this.fb.group({
      expenseAmount: [null, [Validators.required, Validators.min(1)]],
      expenseDescription: ['', [Validators.required, Validators.minLength(5)]]
    });
    this.otherExpenses.push(expenseForm);
  }

  removeExpense(index: number): void {
    this.otherExpenses.removeAt(index);
  }

  // --- Form Submission ---
  async onSubmit() {
    if (this.chargeForm.invalid) {
      this.chargeForm.markAllAsTouched();
      return;
    }
    this.isLoading = true;
    const finalPayload = this.chargeForm.getRawValue();
    try {
      await this.serverService.post(`/admin/generate-client-bill?client_id=${this.client.id}&month=${this.bill.month}`, { ...finalPayload, totalChargeableAmount: this.totalChargeableAmount });
      this.toast.showToast('notification', 'Invoice generated successfully');
      this.activeModal.dismiss({ success: true, data: finalPayload });
    } catch (e) {
      console.log(e);
    }
    this.isLoading = false;
  }

  /**
   * Sets up all the dynamic interactions and calculations for the form.
   */
  private setupFormListeners(): void {
    // Listen for changes in the entire form to calculate the grand total
    this.formChangesSubscription = this.chargeForm.valueChanges.pipe(
      startWith(this.chargeForm.value) // Trigger calculation on init
    ).subscribe(value => {
      let total = Number(value.amount) || 0;
      if (value.otherExpenses && value.otherExpenses.length > 0) {
        total += value.otherExpenses.reduce((sum, expense) => sum + (Number(expense.expenseAmount) || 0), 0);
      }
      this.totalChargeableAmount = total;
    });

    this.f.costPerInvoice.valueChanges.subscribe(() => {
      this.calculatePerInvoiceAmount();
    });

    this.f.totalInvoices.valueChanges.subscribe(() => {
      this.calculatePerInvoiceAmount();
    });
  }

  private calculatePerInvoiceAmount(): void {
    const cost = this.f.costPerInvoice.value;
    const totalAmount = cost * this.f.totalInvoices.getRawValue();
    this.chargeForm.patchValue({ amount: totalAmount }, { emitEvent: false }); // Prevent infinite loop
    // Manually trigger a value change for the total calculation
    this.chargeForm.updateValueAndValidity();
  }
}
