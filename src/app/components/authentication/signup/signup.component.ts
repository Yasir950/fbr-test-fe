import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { ServerService } from '../../../services/server.service';

const PK_PROVINCES = [
  'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan',
  'Islamabad Capital Territory', 'Gilgit-Baltistan', 'Azad Jammu and Kashmir'
];

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export default class SignupComponent implements OnInit {
  signupForm: FormGroup;
  formSubmitted = false;
  isLoading = false;
  errorMsg: string | null = null;
  provinces = PK_PROVINCES;
  hidePassword = true;

  constructor(private fb: FormBuilder, private serverService: ServerService, private router: Router) {}

  get f(): any {
    return this.signupForm.controls;
  }

  ngOnInit(): void {
    this.signupForm = this.fb.group({
      // Personal / login details (adminType is NOT a field — always 'submitter' server-side)
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      cellNumber1: ['', Validators.required],
      cellNumber2: [''],
      address: ['', [Validators.required, Validators.minLength(10)]],

      // Business / client details
      sellerBusinessName: ['', [Validators.required, Validators.minLength(3)]],
      sellerNTNCNIC: ['', [Validators.required, Validators.minLength(7)]],
      sellerProvince: ['', Validators.required],
      sellerAddress: ['', [Validators.required, Validators.minLength(10)]]
    }, { validators: this.passwordsMatch });
  }

  passwordsMatch(group: FormGroup) {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  togglePassword() {
    this.hidePassword = !this.hidePassword;
  }

  async onSubmit() {
    this.formSubmitted = true;
    this.errorMsg = null;

    if (this.signupForm.invalid) {
      return;
    }

    this.isLoading = true;
    const v = this.signupForm.value;

    try {
      const response = await this.serverService.post<any>('/signup', {
        firstName: v.firstName,
        lastName: v.lastName,
        email: v.email,
        username: v.username,
        password: v.password,
        cellNumber1: v.cellNumber1,
        cellNumber2: v.cellNumber2 || null,
        address: v.address,
        sellerBusinessName: v.sellerBusinessName,
        sellerNTNCNIC: v.sellerNTNCNIC,
        sellerProvince: v.sellerProvince,
        sellerAddress: v.sellerAddress
      });

      localStorage.setItem('token', response.token);

      // Fetch the full user profile so localStorage.user is populated for the
      // onboarding-status guard (it reads clientId to decide the redirect flow).
      const me = await this.serverService.get<any>('/me');
      localStorage.setItem('user', JSON.stringify(me));

      // Land the new user straight in the app — no forced package selection or
      // payment step. They can browse everything immediately and pick a package
      // whenever they're ready from the "My Package" item in the sidebar.
      this.router.navigateByUrl('admin/dashboard').then();
    } catch (error: any) {
      this.errorMsg = error.response?.data?.detail || 'Signup failed. Please try again.';
    }
    this.isLoading = false;
  }
}