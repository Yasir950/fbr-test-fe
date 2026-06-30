import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ServerService } from '../../../services/server.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export default class ForgotPasswordComponent {
  form: FormGroup;
  submitted = false;
  loading = false;
  error: string | null = null;
  success = false;
  devResetLink: string | null = null;

  constructor(private fb: FormBuilder, private serverService: ServerService) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get f() {
    return this.form.controls;
  }

  async onSubmit() {
    this.submitted = true;
    this.error = null;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    try {
      const response = await this.serverService.post<any>('/forgot-password', this.form.value);
      this.success = true;
      // Only present in non-production environments where no email provider is wired up yet.
      if (response.dev_reset_token) {
        this.devResetLink = `${window.location.origin}/reset-password?token=${response.dev_reset_token}`;
      }
    } catch (error: any) {
      this.error = error.response?.data?.detail || 'Something went wrong. Please try again.';
    }
    this.loading = false;
  }
}