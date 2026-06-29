import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { SharedModule } from '../../../theme/shared/shared.module';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { dropDownValues } from '../../../services/field.values';
import { merge, Observable, OperatorFunction, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { ServerService } from '../../../services/server.service';
import { ClientList } from '../../../services/app.models';
import { AxiosError } from 'axios';
import { Invoice, InvoiceData, InvoiceItem } from '../../admin/clients/invoice-details/invoice-details.component';
import { ToastService } from '../../../services/toast.service';
import { NgbDateStruct } from '@ng-bootstrap/ng-bootstrap';
import { Location } from '@angular/common';
// --- Interfaces & Types ---
type FbrRate = { ratE_ID: number, ratE_DESC: string, ratE_VALUE: number };
type FbrSch = { srO_ID: number, srO_DESC: string };
type FbrSroItem = { srO_ITEM_ID: number, srO_ITEM_DESC: string };




/**
 * NEW: This class encapsulates all UI-related state for a SINGLE item row.
 * An instance of this class will be created for every row in the FormArray.
 */
class InvoiceItemUIState {
  // Issue #1: Independent Focus Subjects for each row
  focusSearchHsCodes$ = new Subject<string>();
  focusSearchHsCodesDES$ = new Subject<string>();
  focusSearchRates$ = new Subject<string>();
  focusSearchUom$ = new Subject<string>();
  focusSearchSalesTypes$ = new Subject<string>();
  focusSearchSros$ = new Subject<string>();
  focusSearchSroItemNos$ = new Subject<string>();

  // Issue #2: Independent Dropdown Data and Loaders for each row
  ratesDropdown: string[] = [];
  ratesRawValues: { [key: string]: number } = {};
  ratesLoading = false;

  sroSchDropdown: string[] = [];
  sroSchRawValues: { [key: string]: number } = {};
  sroSchLoading = false;

  sroItemDropdown: string[] = [];
  sroItemRawValues: { [key: string]: number } = {};
  sroItemLoading = false;

  hsDescription = ''; // Independent HS description for each row
uomLoading = false;
  // Typeahead search methods are now part of the state object itself
  searchHsCodes: OperatorFunction<string, readonly string[]>;
  searchHsCodesDES: OperatorFunction<string, readonly string[]>;
  searchSalesTypes: OperatorFunction<string, readonly string[]>;
  searchUom: OperatorFunction<string, readonly string[]>;
  searchRates: OperatorFunction<string, readonly string[]>;
  searchSros: OperatorFunction<string, readonly string[]>;
  searchSroItemNos: OperatorFunction<string, readonly string[]>;

  constructor(private allDropDowns: typeof dropDownValues) {
    // Initialize all the searcher functions in the constructor
    this.searchHsCodes = this.createSearcher(this.allDropDowns.hsCodes, this.focusSearchHsCodes$);
    this.searchHsCodesDES = this.createSearcher(this.allDropDowns.hsDescriptions, this.focusSearchHsCodesDES$);
    this.searchSalesTypes = this.createSearcher(this.allDropDowns.salesTypes, this.focusSearchSalesTypes$);
    this.searchUom = this.createSearcher(this.allDropDowns.uom, this.focusSearchUom$);
    // For DYNAMIC data sources (like rates), we use the refactored searcher.
    this.searchRates = this.createDynamicSearcher('ratesDropdown', this.focusSearchRates$);
    this.searchSros = this.createDynamicSearcher('sroSchDropdown', this.focusSearchSros$);
    this.searchSroItemNos = this.createDynamicSearcher('sroItemDropdown', this.focusSearchSroItemNos$);
  }

  // Generic search factory is now part of the class, using its own properties
private createSearcher(data: any[], focus$: Subject<string>): OperatorFunction<string, readonly any[]> {
  return (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());

    return merge(debouncedText$, focus$).pipe(
      map(term => {
        if (term === '') {
          return data.slice(0, 1000);
        }

        const lower = term.toLowerCase();

        return data.filter(v => {
          const value = String(v).toLowerCase();

          // 🔑 KEY FIX:
          // Allow searching BOTH:
          // - HS Code
          // - HS Description (after ':-')
          if (value.includes(lower)) {
            return true;
          }

          // Extra safety for "code:-description" format
          const parts = value.split(':-');
          return parts.length > 1 && parts[1].includes(lower);
        });
      })
    );
  };
}



  /**
   * Instead of capturing the array, it captures the PROPERTY NAME of the array.
   * This forces it to look up the *current* array on `this` every time it runs.
   */
private createDynamicSearcher(
  propertyName: 'ratesDropdown' | 'sroSchDropdown' | 'sroItemDropdown',
  focus$: Subject<string>
): OperatorFunction<string, readonly any[]> {
  return (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(
      debounceTime(200),
      distinctUntilChanged()
    );

    return merge(debouncedText$, focus$).pipe(
      map(term => {
        const currentData = this[propertyName];
        if (!currentData || currentData.length === 0) {
          return [];
        }

        if (term === '') {
          return currentData; // return ALL items
        }

        return currentData.filter(v =>
          String(v).toLowerCase().includes(term.toLowerCase())
        ); // return ALL filtered items
      })
    );
  };
}


  

}


@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [SharedModule, NgbTypeaheadModule],
  templateUrl: './invoice-form.component.html',
  styleUrls: ['./invoice-form.component.scss']
})
export default class InvoiceFormComponent implements OnInit, OnDestroy {
  invoiceForm: FormGroup;
  isSubmitting = false;
  isFetchingBuyer = false;
  isUserAdmin = false;
  client: ClientList = null;
  clientId = null;
  invoiceId = null;
  formSubscriptions: Subscription[] = [];
  dropDowns = dropDownValues;
  itemCollapsedStates: boolean[] = [];
  sandboxTesting: boolean = false;
  editMode = false;
  formLabelColors = 'text-primary';
  loading = true;
  scenarioDescriptions = dropDownValues.scenarioDescriptions;
  errorMessages: string[] = [];

  // NEW: This single array manages the UI state for all item rows.
  itemUIStates: InvoiceItemUIState[] = [];

  // Component-level focus subjects for non-repeating fields
  focusSearchScenarios$ = new Subject<string>();
  focusSearchDocumentTypes$ = new Subject<string>();
  focusSearchBuyerTypes$ = new Subject<string>();
  focusSearchProvinces$ = new Subject<string>();
  @ViewChild('scrollContainer') scrollContainer: ElementRef;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private serverService: ServerService,
    private toastService: ToastService,
    private location: Location
  ) {
   
  }

  get items(): FormArray {
    return this.invoiceForm.get('items') as FormArray;
  }

  ngOnInit(): void {
    this.isUserAdmin = this.router.url.startsWith('/admin');
    this.sandboxTesting = this.router.url.includes('/sandbox-invoice-form');
    this.formLabelColors = this.sandboxTesting ? 'text-warning' : 'text-primary';
    this.initializeForm();
    this.fetchClientDetails().then();
    
  }

  ngOnDestroy(): void {
    this.formSubscriptions.forEach(sub => sub.unsubscribe());
  }

  addItem(): void {
    const newItemUIState = new InvoiceItemUIState(this.dropDowns);
    const newItemFormGroup = this.createItemFormGroup();
    this.itemUIStates.push(newItemUIState);
    this.items.push(newItemFormGroup);
    this.setupItemSubscriptions(newItemFormGroup, newItemUIState);
    this.itemCollapsedStates.push(false);
  }

  removeItem(index: number): void {
    if (this.items.length > 1) {
      this.items.removeAt(index);
      this.itemUIStates.splice(index, 1);
      this.itemCollapsedStates.splice(index, 1);
    }
  }

  toggleItem(index: number): void {
    this.itemCollapsedStates[index] = !this.itemCollapsedStates[index];
  }

  // Generic searcher for top-level form fields
  searchGeneric = (text$: Observable<string>, focus$: Subject<string>, data: any[]) =>
    merge(text$.pipe(debounceTime(200), distinctUntilChanged()), focus$).pipe(
      map(term => (term === '' ? data.slice(0, 1000) : data.filter(v => String(v).toLowerCase().includes(term.toLowerCase()))))
    );

  searchScenarios: OperatorFunction<string, readonly string[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    // Merge the stream of user typing with the stream of focus events
    return merge(debouncedText$, this.focusSearchScenarios$).pipe(
      map(term =>
        (term === ''
            ? this.dropDowns.scenarios.slice(0, 20) // Show initial list on focus (empty term)
            : this.dropDowns.scenarios.filter(v => v.toLowerCase().indexOf(term.toLowerCase()) > -1)
        ).slice(0, 10) // Always limit the final results
      )
    );
  };

  // Repeat this pattern for all other searchers
  searchDocumentTypes: OperatorFunction<string, readonly string[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    return merge(debouncedText$, this.focusSearchDocumentTypes$).pipe(
      map(term =>
        (term === ''
            ? this.dropDowns.documentTypes.slice(0, 20)
            : this.dropDowns.documentTypes.filter(v => v.toLowerCase().indexOf(term.toLowerCase()) > -1)
        ).slice(0, 10)
      )
    );
  };

  searchBuyerTypes: OperatorFunction<string, readonly string[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    return merge(debouncedText$, this.focusSearchBuyerTypes$).pipe(
      map(term =>
        (term === ''
            ? this.dropDowns.buyerTypes.slice(0, 20)
            : this.dropDowns.buyerTypes.filter(v => v.toLowerCase().indexOf(term.toLowerCase()) > -1)
        ).slice(0, 10)
      )
    );
  };

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

  async fetchClientDetails() {
    this.clientId = this.route.snapshot.queryParamMap.get('client_id');
    this.editMode = this.route.snapshot.url[0].path.includes('edit-invoice');
    if (this.clientId) {
      try {
        this.client = await this.serverService.get<ClientList>(`/admin/get_client_summary?id=${this.clientId}`);
        this.patchSellerData();
      } catch (e) {
        this.router.navigateByUrl('admin/clients').then();
      }
    } else {
      this.router.navigateByUrl('admin/clients').then();
    }

    if (this.editMode) {
      try {
        this.invoiceId = this.route.snapshot.queryParamMap.get('invoice_id');
        const data = await this.serverService.get<Invoice>(`/admin/get-invoice?invoice_id=${this.invoiceId}`);
        const invoiceData = data.invoice_data;
        // Call the main function to populate the form
        console.log(invoiceData)
        await this.populateFormForEdit(invoiceData);
      } catch (e) {
        console.error(e);
        // this.router.navigateByUrl('admin/clients').then();
      }
    }
    this.loading = false;
  }

  async fetchBuyerData() {
    const ntn = this.invoiceForm.get('buyerNTNCNIC').value;
    if (!ntn) return;
    this.isFetchingBuyer = true;
    try {
      const regType = await this.serverService.get<{ type: string, name: string, address: string, province: string }>(`/fbr/get_reg_type?reg=${ntn}`);
      this.invoiceForm.get('buyerRegistrationType').patchValue(this.capitalizeFirstLetter(regType.type));
        this.invoiceForm.get('buyerBusinessName').patchValue(regType.name);
        this.invoiceForm.get('buyerProvince').patchValue(regType.province);
        this.invoiceForm.get('buyerAddress').patchValue(regType.address);
    } finally {
      this.isFetchingBuyer = false;
    }
  }

  scrollToTop() {
    window.scroll({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }

  async onSubmit() {
    this.errorMessages = [];
    this.scrollToTop();
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      alert('Please fill out all required fields correctly.');
      return;
    }
    this.isSubmitting = true;
     const date = this.formatDate(this.invoiceForm.get('invoiceDate').getRawValue());
      this.invoiceForm.get('invoiceDate').setValue(date);
    const finalPayload = this.invoiceForm.getRawValue();
    const bkDate = this.parseBackendDate(this.invoiceForm.get('invoiceDate').getRawValue());
         this.invoiceForm.get('invoiceDate').setValue(bkDate);

    if (this.sandboxTesting) {
      const formattedDate = this.getFormattedDate();
         this.invoiceForm.get('invoiceDate').setValue(formattedDate);
      const sandboxPayload = this.invoiceForm.getRawValue();
        const date =this.getNgbDateStruct(formattedDate);
      this.invoiceForm.get('invoiceDate').setValue(date);
      await this.submitSandboxInvoice(sandboxPayload);
      
    } else {
       
      if (this.editMode) {
         const parsedDate = new Date(this.formatDate(this.invoiceForm.get('invoiceDate').getRawValue()));
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();
    const date = `${year}-${month}-${day}`;
    finalPayload.invoiceDate = date;
        await this.editInvoice(finalPayload);
       
      } else {
      const parsedDate = new Date(this.formatDate(this.invoiceForm.get('invoiceDate').getRawValue()));
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();
    const date = `${year}-${month}-${day}`;
        finalPayload.invoiceDate = date;
        await this.saveNewInvoice(finalPayload);
        
      }
    }
    this.isSubmitting = false;
  }


private setupCalculationSubscriptions(itemGroup: FormGroup): void {
  const rateCtrl = itemGroup.get('rate');
  const valueCtrl = itemGroup.get('valueSalesExcludingST');
  const salesTaxCtrl = itemGroup.get('salesTaxApplicable');
  const totalCtrl = itemGroup.get('totalValues');
  const qtyCtrl = itemGroup.get('quantity');
  const fixedCtrl = itemGroup.get('fixedNotifiedValueOrRetailPrice');
  const saleTypeCtrl = itemGroup.get('saleType');

  const parseRate = (rate: any): { type: 'percent' | 'fixed', value: number } => {
    if (!rate) return { type: 'percent', value: 0 };
    const str = String(rate).trim().toLowerCase();

    if (str === 'exempt') return { type: 'percent', value: 0 };
    if (str.includes('%')) return { type: 'percent', value: Number(str.replace('%', '')) || 0 };

    if (str.startsWith('rs') || str.includes('/sq') || str.includes('/bi')) {
      const num = Number(
        str
          .replace(/^rs\.?\s*/i, '')
          .replace('/sqy', '')
          .replace('/sq', '')
          .replace('/bill', '')
          .replace('/bi', '')
          .trim()
      ) || 0;

      return { type: 'fixed', value: num };
    }

    const num = Number(str) || 0;
    return { type: 'percent', value: num };
  };

const recalc = () => {
  const qty = Number(qtyCtrl?.value) || 0;
  let unitValue = Number(valueCtrl?.value) || 0;
  const fixedValue = Number(fixedCtrl?.value) || 0;
  const saleType = saleTypeCtrl?.value;

  const isThirdSchedule =
    saleType &&
    saleType.toString().toLowerCase().includes('3rd') &&
    saleType.toString().toLowerCase().includes('schedule');

  if (!unitValue || unitValue <= 0) {
    salesTaxCtrl?.setValue(0, { emitEvent: false });
    totalCtrl?.setValue(0, { emitEvent: false });
    return;
  }

  const rateInfo = parseRate(rateCtrl?.value);
  let salesTaxPerUnit = 0;

  // 1. Calculate Tax for ONE unit/time
  const taxableBasis = isThirdSchedule ? fixedValue : unitValue;

  if (rateInfo.type === 'percent') {
    // Tax for 1 unit = (Taxable Value * Percentage) / 100
    salesTaxPerUnit = (taxableBasis * rateInfo.value) / 100;
  } else {
    // If it's a fixed rate, we assume the rate provided IS the tax per unit
    salesTaxPerUnit = rateInfo.value;
  }

  // 2. Calculate Total: (Unit Price + Unit Tax) * Quantity
  const totalValue = (unitValue + salesTaxPerUnit);

  // 3. Update Controls
  // salesTaxCtrl now shows tax for 1 unit (won't change when qty changes)
  salesTaxCtrl?.setValue(+salesTaxPerUnit.toFixed(2), { emitEvent: false });
  totalCtrl?.setValue(+totalValue.toFixed(2), { emitEvent: false });
};


  // Subscribe
  [valueCtrl, qtyCtrl, rateCtrl, fixedCtrl, saleTypeCtrl].forEach(ctrl => {
    ctrl?.valueChanges.subscribe(() => recalc());
  });

  recalc();
}

  /**
   * Main orchestrator for populating the form in edit mode.
   * @param invoiceData The data object from the server.
   */
  private async populateFormForEdit(invoiceData: InvoiceData): Promise<void> {
    // 1. Clear the default item and rebuild the FormArray structure
    this.items.clear();
    this.itemUIStates = [];
    this.itemCollapsedStates = [];

    invoiceData.items.forEach(() => {
      // This adds a new FormGroup and a new InvoiceItemUIState for each item
      this.addItem();
    });

    // 2. Now that all dropdowns are populated, it's safe to patch the form.
    const invoiceDateStruct = this.parseBackendDate(invoiceData.invoiceDate);

  this.invoiceForm.patchValue(
    {
      ...invoiceData,
      invoiceDate: invoiceDateStruct   // <-- patched only in form
    },
    { emitEvent: false, onlySelf: true }
  );
console.log(invoiceData.invoiceDate)
    // 3. Pre-populate all dynamic dropdowns for all items concurrently
    const dropdownPopulationPromises = invoiceData.items.map((item, index) =>
      this.prepopulateItemDropdowns(item, index, invoiceData.items)
    );

    if (this.sandboxTesting) {
      setTimeout(() => {
        this.patchSellerData();
      }, 200);
    }

    // Wait for ALL dropdowns for ALL items to be fetched and ready
    await Promise.all(dropdownPopulationPromises);

    // Ensure all items are collapsed by default in edit mode for a cleaner view
    this.itemCollapsedStates.fill(false);
  }

  /**
   * Helper function to run the sequence of async dropdown fetches for a single item.
   * @param item The specific item data from the server.
   * @param index The index of the item in the FormArray.
   * @param invoiceItems The invoice items.
   */
  private async prepopulateItemDropdowns(item: any, index: number, invoiceItems: Array<InvoiceItem>): Promise<void> {
    // We must await each step in sequence as they depend on each other
    this.updateProductDescription(this.items.at(index).get('hsCode').getRawValue(), this.items.at(index), this.itemUIStates[index]);
    await this.updateRate(item.saleType, this.itemUIStates[index], this.items.at(index).get('rate'), this.items.at(index).get('sroScheduleNo'), this.items.at(index).get('sroItemSerialNo'), false);
    await this.updateScheduleItems(item.rate, this.itemUIStates[index], this.items.at(index).get('sroScheduleNo'), this.items.at(index).get('sroItemSerialNo'), false);
    await this.updateSroItems(item.sroScheduleNo, this.itemUIStates[index], this.items.at(index).get('sroItemSerialNo'), false);
  }


  private async saveNewInvoice(finalPayload) {
    try {
      await this.serverService.post(`/admin/create-invoice?client_id=${this.clientId}`, finalPayload);
     
      alert('Invoice saved into the system successfully.');
      console.log(finalPayload);
      this.resetForm();
      // @ts-ignore
    } catch (e: AxiosError) {
      const err = e.response.data?.detail ?? 'Some unknown error detected from system. Unable to save the invoice.';
      this.errorMessages = [`Error: ${err}`];
    }
  }

  private async editInvoice(finalPayload) {
    try {
      await this.serverService.put(`/admin/edit-invoice?invoice_id=${this.invoiceId}`, finalPayload);
      alert('Invoice updated into the system successfully.');
      // @ts-ignore
    } catch (e: AxiosError) {
      const err = e.response.data?.detail ?? 'Some unknown error detected from system. Unable to save the invoice.';
      this.errorMessages = [`Error: ${err}`];
    }
  }

  private async submitSandboxInvoice(finalPayload) {
    try {
      const response: any = await this.serverService.post(`/admin/validate-sb-invoice?client_id=${this.clientId}`, finalPayload);
      const validate = response.validationResponse;
      if (validate.status.toString().toUpperCase() === 'VALID') { // Valid response
        try {
          const result: any = await this.serverService.post(`/admin/submit-sb-invoice?client_id=${this.clientId}`, finalPayload);
          alert('Sandbox invoice is submitted to FBR successfully!');
          this.resetForm();
          // @ts-ignore
        } catch (e: AxiosError) {
          const err = e.response.data?.detail?.message ?? 'Some unknown error detected from FBR';
          this.errorMessages = [`FBR Error: ${err}`];
        }
      } else {
        this.errorMessages = this.parseServerError(response);
      }
      // @ts-ignore
    } catch (e: AxiosError) {
      const messages = e.response?.data?.detail ?? e.message;
      if (typeof messages === 'string') {
        this.errorMessages.push(messages);
      } else {
        this.errorMessages = this.parseServerError(e.response?.data?.detail);
      }
    }
    setTimeout(() => {
      this.errorMessages = [];
    }, 1000 * 10);
  }

  private resetForm() {
    this.items.clear();
    this.itemUIStates = [];
    this.itemCollapsedStates = [];
    this.invoiceForm.reset();
    this.patchSellerData();
    this.addItem();
  }

  private initializeForm(): void {
    const today = new Date();
const currentDate = {
  year: today.getFullYear(),
  month: today.getMonth() + 1,
  day: today.getDate()
};
    this.invoiceForm = this.fb.group({
      invoiceType: ['', Validators.required],
      csvInvoiceId: [''],
      invoiceDate: [currentDate, Validators.required],   
      sellerNTNCNIC: [{ value: '', disabled: true }, Validators.required],
      sellerBusinessName: [{ value: '', disabled: true }, Validators.required],
      sellerProvince: [{ value: '', disabled: true }, Validators.required],
      sellerAddress: [{ value: '', disabled: true }, Validators.required],
      buyerNTNCNIC: ['', Validators.required],
      buyerBusinessName: [{ value: '', disabled: false }, Validators.required],
      buyerProvince: [{ value: '', disabled: false }, Validators.required],
      buyerAddress: [{ value: '', disabled: false }, Validators.required],
      buyerRegistrationType: ['', Validators.required],
      invoiceRefNo: [{ value: '', disabled: true }, Validators.required][''],
      reason: [{ value: '', disabled: true }, Validators.required],
      items: this.fb.array([])
    });
    if (this.sandboxTesting) {
      this.invoiceForm.addControl('scenarioId', new FormControl('', Validators.required));
      const sub = this.invoiceForm.get('scenarioId').valueChanges.subscribe(async (value: string) => {
        if (this.dropDowns.scenarios.includes(value)) {
          try {
            const invoiceData = await this.serverService.get<InvoiceData>(`/admin/get-invoice-by-scenario?scenario=${value}`);
            this.softReset();
            if (invoiceData) {
              this.populateFormForEdit(invoiceData).then();
              this.toastService.showToast('notification', `Data patched for ${value}`);
            } else {
              this.toastService.showToast('error', `No data found for ${value}`);
              this.softReset();
            }
          } catch (err) {
            console.error('Failed to update rates:', err);
            this.softReset();
          }
        }
      });
      this.formSubscriptions.push(sub);
    }
    const sub = this.invoiceForm.get('invoiceType').valueChanges.subscribe((value: string) => {
      const reasonElement = this.invoiceForm.get('reason');
      const invoiceRefNo = this.invoiceForm.get('invoiceRefNo');
      reasonElement.patchValue('', { emitEvent: false, onlySelf: true });
      if (value?.toUpperCase() === 'DEBIT NOTE') {
        reasonElement.enable();
        invoiceRefNo.enable();
      } else {
        reasonElement.disable();
        reasonElement.disable();
      }
    });
    this.formSubscriptions.push(sub);
    this.addItem();
    this.itemCollapsedStates[0] = false;
  }

  private softReset() {
    this.items.clear();
    this.itemUIStates = [];
    this.itemCollapsedStates = [];
    this.addItem();
    this.invoiceForm.patchValue({ buyerNTNCNIC: '', buyerBusinessName: '', buyerProvince: '', buyerAddress: '', invoiceType: '', invoiceDate: '', invoiceRefNo: '', reason: '' });
  }

  private createItemFormGroup(): FormGroup {
    return this.fb.group({
      hsCode: ['', Validators.required],
      HsCodetDescription: ['', Validators.required],
      productDescription: ['', Validators.required],
      rate: ['', Validators.required],
      uoM: [''], // Optional
      quantity: [1, [Validators.required, Validators.min(0)]],
      totalValues: [0, [Validators.required, Validators.min(0)]],
      valueSalesExcludingST: [0, [Validators.required, Validators.min(0)]],
      fixedNotifiedValueOrRetailPrice: [0, Validators.required],
      salesTaxApplicable: [0, [Validators.required, Validators.min(0)]],
      salesTaxWithheldAtSource: [0, Validators.required],
      extraTax: [''],
      furtherTax: [0, Validators.required],
      fedPayable: [0, Validators.required],
      discount: [0, Validators.required],
      saleType: ['', Validators.required],
      sroScheduleNo: [''],
      sroItemSerialNo: ['']
    });
  }

private setupItemSubscriptions(itemGroup: FormGroup, uiState: InvoiceItemUIState): void {

   this.setupCalculationSubscriptions(itemGroup);
  const hsCodeSub = itemGroup.get('hsCode')!.valueChanges.subscribe(hsCode => {
    this.updateProductDescription(hsCode, itemGroup, uiState);
  });

  // ✅ NEW: Description → HS Code
const productDescSub = itemGroup.get('HsCodetDescription')!.valueChanges.subscribe(value => {
  if (!value || typeof value !== 'string') {
    return;
  }

  if (!value.includes(':-')) {
    uiState.hsDescription = value;
    return;
  }

  const hsCode = value.split(':-')[0]?.trim();

  if (hsCode && itemGroup.get('hsCode')!.value !== hsCode) {
    itemGroup.get('hsCode')!.setValue(hsCode, { emitEvent: false });
  }

  uiState.hsDescription = value;

  // ✅ Fetch UoM directly here since hsCode is set with emitEvent: false
  if (hsCode) {
    this.fetchUomForHsCode(hsCode, itemGroup, uiState);
  }
});

  const saleTypeSub = itemGroup.get('saleType')!.valueChanges.subscribe((value: string) => {
    this.updateRate(value, uiState, itemGroup.get('rate'), itemGroup.get('sroScheduleNo'), itemGroup.get('sroItemSerialNo')).then();
  });

  const rateSub = itemGroup.get('rate')!.valueChanges.subscribe((value: string) => {
    this.updateScheduleItems(value, uiState, itemGroup.get('sroScheduleNo'), itemGroup.get('sroItemSerialNo')).then();
  });

  const sroSchSub = itemGroup.get('sroScheduleNo')!.valueChanges.subscribe((value: string) => {
    this.updateSroItems(value, uiState, itemGroup.get('sroItemSerialNo')).then();
  });

  this.formSubscriptions.push(
    hsCodeSub,
    productDescSub,
    saleTypeSub,
    rateSub,
    sroSchSub
  );
}

  private updateProductDescription(hsCode: string, itemGroup: AbstractControl, uiState: InvoiceItemUIState): void {
    const desc = itemGroup.get('HsCodetDescription');
    if (!hsCode) {
      uiState.hsDescription = '';
      return;
    }
    const description = this.dropDowns.hsDescriptions.find(desc => desc.startsWith(hsCode + ':-'));
    if (description) {
      uiState.hsDescription = description;
      desc.patchValue(description, { emitEvent: false, onlySelf: true });

    } else {
      uiState.hsDescription = '';
    }
      this.fetchUomForHsCode(hsCode, itemGroup, uiState);
  }

  private async updateRate(value: string, uiState: InvoiceItemUIState, rateControl: AbstractControl, sroSchControl: AbstractControl, sroItemControl: AbstractControl, clearValues = true) {
    if (clearValues) {
      rateControl.patchValue('', { emitEvent: false, onlySelf: true });
      sroSchControl.patchValue('', { emitEvent: false, onlySelf: true });
      sroItemControl.patchValue('', { emitEvent: false, onlySelf: true });
    }
    uiState.ratesDropdown = [];
    uiState.ratesRawValues = {};
    uiState.sroSchDropdown = [];
    uiState.sroSchRawValues = {};
    uiState.sroItemDropdown = [];
    uiState.sroItemRawValues = {};
    if (this.dropDowns.salesTypes.includes(value) && this.invoiceForm.get('invoiceDate').valid) {
      const tsId = this.dropDowns.salesTypesRaw[value.trim().toLowerCase()];
      const date = this.formatDate(this.invoiceForm.get('invoiceDate').getRawValue());
      uiState.ratesLoading = true;
      // Use try/finally to ensure the loader is always turned off
      try {
        const response = await this.serverService.get<FbrRate[]>(`/fbr/sale_type_to_rate?date=${date}&trans_type_id=${tsId}`);
        uiState.ratesDropdown = response.map(r => r.ratE_DESC);
        response.forEach(r => {
          uiState.ratesRawValues[r.ratE_DESC.trim().toLowerCase()] = r.ratE_ID;
        });
      } catch (err) {
        console.error('Failed to update rates:', err);
      } finally {
        uiState.ratesLoading = false;
      }
    }
  }

  private async updateScheduleItems(value: string, uiState: InvoiceItemUIState, sroSchControl: AbstractControl, sroItemControl: AbstractControl, clearValues = true) {
    if (clearValues) {
      sroSchControl.patchValue('', { emitEvent: false, onlySelf: true });
      sroItemControl.patchValue('', { emitEvent: false, onlySelf: true });
    }
    uiState.sroSchDropdown = [];
    uiState.sroSchRawValues = {};
    uiState.sroItemDropdown = [];
    uiState.sroItemRawValues = {};
    if (uiState.ratesDropdown.includes(value) && this.invoiceForm.get('invoiceDate').valid) {
      // ... logic to get date and rateId is the same ...
      const date = this.formatDate(this.invoiceForm.get('invoiceDate').getRawValue());
      const rateId = uiState.ratesRawValues[value.trim().toLowerCase()];
      uiState.sroSchLoading = true;
      try {
        const response = await this.serverService.get<FbrSch[]>(`/fbr/get_sro_schedule?date=${date}&rate_id=${rateId}`);
        uiState.sroSchDropdown = response.map(r => r.srO_DESC);
        response.forEach(r => {
          uiState.sroSchRawValues[r.srO_DESC.trim().toLowerCase()] = r.srO_ID;
        });
      } finally {
        uiState.sroSchLoading = false;
      }
    }
  }

  private async updateSroItems(value: string, uiState: InvoiceItemUIState, sroItemControl: AbstractControl, clearValues = true) {
    if (clearValues) {
      sroItemControl.patchValue('', { emitEvent: false, onlySelf: true });
    }
    uiState.sroItemDropdown = [];
    uiState.sroItemRawValues = {};
    if (uiState.sroSchDropdown.includes(value) && this.invoiceForm.get('invoiceDate').valid) {
      // ... logic to get date and sroId is the same ...
      const date = this.getFormattedDate();
      const sroId = uiState.sroSchRawValues[value.trim().toLowerCase()];
      uiState.sroItemLoading = true;
      try {
        const response = await this.serverService.get<FbrSroItem[]>(`/fbr/get_sro_items?date=${date}&sro_id=${sroId}`);
        uiState.sroItemDropdown = response.map(r => r.srO_ITEM_DESC);
        response.forEach(r => {
          uiState.sroItemRawValues[r.srO_ITEM_DESC.trim().toLowerCase()] = r.srO_ITEM_ID;
        });
      } finally {
        uiState.sroItemLoading = false;
      }
    }
  }

  private patchSellerData(): void {
    if (!this.client) return;
    this.invoiceForm.patchValue({ sellerNTNCNIC: this.client.sellerNTNCNIC, sellerBusinessName: this.client.sellerBusinessName, sellerProvince: this.client.sellerProvince, sellerAddress: this.client.sellerAddress });
  }

  private capitalizeFirstLetter(str: string): string {
    return str.length === 0 ? '' : str.charAt(0).toUpperCase() + str.slice(1);
  }

 private formatDate(date: NgbDateStruct): string {
  if (!date) return '';

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const day = date.day < 10 ? '0' + date.day : date.day;
  const monthName = monthNames[date.month - 1];

  return `${day}-${monthName}-${date.year}`;
}

  private parseServerError(response: any): string[] {
    let errors: string[] = [];
    if (response?.validationResponse) {
      const validation = response.validationResponse;
      // Main validation error
      if (validation.statusCode === '01' && validation.error) {
        errors.push(validation.error);
      }
      // Invoice-level errors
      if (validation.invoiceStatuses && Array.isArray(validation.invoiceStatuses)) {
        validation.invoiceStatuses.forEach((item: any) => {
          if (item.statusCode === '01' && item.error) {
            errors.push(`Item #${item.itemSNo}: ${item.error}`
            );
          }
        });
      }
    } else if (response?.message?.fault) {
      errors.push(response?.message?.fault?.description);
    }
    return errors;
  }
onDateChange(date: NgbDateStruct) {
    this.invoiceForm.get('invoiceDate')?.patchValue(date);
    this.invoiceForm.get('invoiceDate')?.markAsTouched(); // trigger validation
    this.invoiceForm.get('invoiceDate')?.markAsDirty();
  }

  // Format for display in input
  getFormattedDate(): string {
    const date: NgbDateStruct = this.invoiceForm.get('invoiceDate')?.value;
    if (!date) return '';
    const month = date.month < 10 ? '0' + date.month : date.month;
    const day = date.day < 10 ? '0' + date.day : date.day;
    return `${date.year}-${month}-${day}`;
  }

 private parseBackendDate(dateString: string): NgbDateStruct | null {
  if (!dateString) return null;

  // Case 1: Format like "06-jan-2026"
  const monthMap: any = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  const parts = dateString.split('-');

  // Detect format by checking the first part
  // If first part has 4 digits → YYYY-MM-DD
  if (parts[0].length === 4) {
    // Format: YYYY-MM-DD
    const [year, month, day] = parts;
    return {
      day: Number(day),
      month: Number(month),
      year: Number(year)
    };
  }

  // Otherwise assume format: DD-MMM-YYYY
  const [day, monthStr, year] = parts;
  const month = monthMap[monthStr.toLowerCase()];
  if (!month) return null;

  return {
    day: Number(day),
    month: month,
    year: Number(year)
  };
}

getNgbDateStruct(dateString: string): NgbDateStruct | null {
  if (!dateString) return null;

  const [year, month, day] = dateString.split('-').map(Number);

  return {
    year: year,
    month: month,
    day: day
  };
}
  goBack(): void {
    this.location.back();
  }
private async fetchUomForHsCode(hsCode: string, itemGroup: AbstractControl, uiState: InvoiceItemUIState): Promise<void> {
  if (!hsCode) return;
  uiState.uomLoading = true;
  try {
    const data = await this.serverService.get<{ uoM_ID: number; description: string }[]>(
      `/fbr/HS_UOM?hs_code=${hsCode}&annexure_id=3`
    );
    if (data && data.length > 0) {
      itemGroup.get('uoM')?.patchValue(data[0].description, { emitEvent: false, onlySelf: true });
    } else {
      itemGroup.get('uoM')?.patchValue('', { emitEvent: false, onlySelf: true });
    }
  } catch (err) {
    console.error('Failed to fetch UoM for HS Code:', err);
  } finally {
    uiState.uomLoading = false;
  }
}
}
