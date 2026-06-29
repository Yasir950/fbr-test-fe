import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../../theme/shared/shared.module';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { merge, Observable, OperatorFunction, Subject } from 'rxjs';
import { NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { dropDownValues } from '../../../../services/field.values';
import { ServerService } from '../../../../services/server.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-client',
  standalone: true,
  imports: [SharedModule, NgbTypeaheadModule],
  templateUrl: './add-client.component.html',
  styleUrls: ['./add-client.component.scss']
})
export default class AddClientComponent implements OnInit {
  clientForm: FormGroup;
  loadingFetch = false;
  loadingSubmit = false;
  error: string | null = null;
  fetchSuccess: string | null = null;
  focusSearchProvinces$ = new Subject<string>();
  dropDowns = dropDownValues;

  constructor(private fb: FormBuilder, private serverService: ServerService, private router: Router) {
  }

  ngOnInit(): void {
    this.clientForm = this.fb.group({
      sellerNTNCNIC: ['', [Validators.required, Validators.minLength(7)]],
      sellerBusinessName: [{ value: '', disabled: false }, Validators.required],
      sellerProvince: [{ value: '', disabled: false }, Validators.required],
      sellerAddress: [{ value: '', disabled: false }, Validators.required],
      ip: [{ value: '', disabled: false }],
      sandboxToken: [{ value: '', disabled: false }, Validators.required],
      productionToken: [{ value: '', disabled: false }]
    });
  }

  async onSubmit() {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      this.error = 'Invalid form values. Please check and try again.';
      setTimeout(() => {
        this.error = null;
      }, 5000);
      return;
    }
    this.loadingSubmit = true;
    try {
      const data = this.clientForm.getRawValue();
      await this.serverService.post('/admin/clients/new', data);
      this.clientForm.reset();
      this.router.navigateByUrl('admin/clients').then();
    } catch (error: any) {
      this.error = error.response?.data?.detail || 'Login failed';
    }
    this.loadingSubmit = false;
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
}
