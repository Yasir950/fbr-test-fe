import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ServerService } from '../../../services/server.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export default class ResetPasswordComponent implements OnInit {
  form: FormGroup;
  submitted = false;
  loading = false;
  error: string | null = null;
  success = false;
  tokenValid: boolean | null = null; // null = checking
  token: string | null = null;
  hidePassword = true;

  constructor(
    private fb: FormBuilder,
    private serverService: ServerService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordsMatch });
  }

  get f() {
    return this.form.controls;
  }

  passwordsMatch(group: FormGroup) {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass === confirm ? null : { passwordMismatch: true };
  }

  togglePassword() {
    this.hidePassword = !this.hidePassword;
  }

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.tokenValid = false;
      this.error = 'No reset token provided. Please use the link from your email.';
      return;
    }
    try {
      await this.serverService.get('/validate-reset-token', { token: this.token });
      this.tokenValid = true;
    } catch (error: any) {
      this.tokenValid = false;
      this.error = error.response?.data?.detail || 'This reset link is invalid or has expired.';
    }
  }

  async onSubmit() {
    this.submitted = true;
    this.error = null;
    if (this.form.invalid) {
      return;
    }
    this.loading = true;
    try {
      await this.serverService.post('/reset-password', {
        token: this.token,
        new_password: this.form.value.newPassword
      });
      this.success = true;
      setTimeout(() => this.router.navigateByUrl('/login'), 2500);
    } catch (error: any) {
      this.error = error.response?.data?.detail || 'Failed to reset password.';
    }
    this.loading = false;
  }
}