// angular import
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginResponse } from '../../../services/app.models';
import { ServerService } from '../../../services/server.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export default class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  error = null;
hidePassword = true;
// CAPTCHA properties
  generatedCaptcha = '';
  captchaTimer = 60; // seconds
  timerInterval: any;
  constructor(private fb: FormBuilder, private router: Router, private serverService: ServerService) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required],
      captchaInput: ['', Validators.required]
    });
  }
  

  // Getter for easy access in HTML
  get f() {
    return this.loginForm.controls;
  }
togglePassword() {
  this.hidePassword = !this.hidePassword;
}
refreshCaptcha() {
    // Generate 6-character random string
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.generatedCaptcha = '';
    for (let i = 0; i < 6; i++) {
      this.generatedCaptcha += chars[Math.floor(Math.random() * chars.length)];
    }
    
    // Reset Timer
    this.startTimer();
    this.loginForm.patchValue({ captchaInput: '' });
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.captchaTimer = 60;
    this.timerInterval = setInterval(() => {
      this.captchaTimer--;
      if (this.captchaTimer <= 0) {
        this.refreshCaptcha(); // Auto-refresh when time is up
      }
    }, 1000);
  }
  async onSubmit() {
    this.submitted = true;
    this.error = null;

    if (this.loginForm.invalid) {
      return;
    }
    // Validate CAPTCHA
    const userInput = this.f['captchaInput'].value.toLowerCase();
  const actualCaptcha = this.generatedCaptcha.toLowerCase();

  if (userInput !== actualCaptcha) {
    this.error = 'Invalid CAPTCHA code. Please try again.';
    this.refreshCaptcha();
    return;
  }
    this.loading = true;
    const { username, password } = this.loginForm.value;
    await this.onLogin(username, password);
    this.loading = false;
  }

  async onLogin(username: string, password: string) {
    this.error = '';
    try {
      const response = await this.serverService.post<LoginResponse>('/login', {
        username,
        password
      });
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      // navigate to dashboard or something similar
      this.router.navigate(['admin/dashboard']).then();
    } catch (error: any) {
      this.error = error.response?.data?.detail || 'Login failed';
    }
  }

  ngOnInit(): void {
    localStorage.clear();
    this.loginForm.valueChanges.subscribe(() => {
      this.error = '';
    });
    this.refreshCaptcha();
  }
}
