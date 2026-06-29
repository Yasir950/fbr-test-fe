import { Injectable, isDevMode } from '@angular/core';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { ToastService } from './toast.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class ServerService {
  private axiosInstance: AxiosInstance;

  constructor(private toastService: ToastService, private router: Router) {
    this.axiosInstance = axios.create({
      baseURL: isDevMode() ? 'http://localhost:8000/api' : `https://fbr-api.${this.getRootDomain(window.location.href)}/api`,
      headers: { 'Content-Type': 'application/json' }
    });

    // Add token before every request
    this.axiosInstance.interceptors.request.use(config => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        if (!config.url.includes('login')) {
          this.router.navigateByUrl('').then();
          this.toastService.showToast('error', 'User is not logged-in.');
        }
      }
      return config;
    });

    // Handle errors globally
    this.axiosInstance.interceptors.response.use(
      response => response,
      (error: AxiosError) => {
        let message = 'An error occurred';
        if (error.response) {
          message = `${error.response.status}: ${error.response.data?.['detail'] ?? 'Error occurred!'}`;
        }
        // Global toast
        this.toastService.showToast('error', message);
        return Promise.reject(error);
      }
    );
  }

  get<T>(url: string, params?: any): Promise<T> {
    return this.axiosInstance.get<T>(url, { params }).then(res => res.data);
  }

post<T>(url: string, data?: any, params?: any): Promise<T> {
  // Argument 1: URL
  // Argument 2: Request Body (JSON)
  // Argument 3: Axios Config (contains params for query string)
  return this.axiosInstance.post<T>(url, data, { params }).then(res => res.data);
}

  put<T>(url: string, data?: any): Promise<T> {
    return this.axiosInstance.put<T>(url, data).then(res => res.data);
  }

  delete<T>(url: string): Promise<T> {
    return this.axiosInstance.delete<T>(url).then(res => res.data);
  }

  private getRootDomain(url) {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');

    // If hostname has only 2 parts → already root domain
    if (parts.length <= 2) {
      return hostname;
    }

    // Otherwise return last 2 parts (domain + TLD)
    return parts.slice(-2).join('.');
  }
getClientCustomers(clientId: string): Promise<any[]> {
  // We use the existing get helper which handles the promise and data extraction
  return this.get<any[]>('/admin/client/customers', { client_id: clientId });
}
// server.service.ts
postSalesTaxReport(clientId: string, payload: { customers: string[], start_date: string, end_date: string }): Promise<any[]> {
  return this.post<any[]>('/admin/reports/sales-tax-applicable', payload, { client_id: clientId });
}
postSalesTaxWithheldReport(clientId: string, payload: { customers: string[], start_date: string, end_date: string }): Promise<any[]> {
  return this.post<any[]>('/admin/reports/sales-tax-withheld', payload, { client_id: clientId });
}
postComprehensiveSalesReport(clientId: string, payload: { customers: string[], start_date: string, end_date: string }): Promise<any[]> {
  return this.post<any[]>('/admin/reports/comprehensive-sales', payload, { client_id: clientId });
}
postCustomerLedgerReport(clientId: string, payload: { customers: string[], start_date: string, end_date: string }): Promise<any[]> {
  return this.post<any[]>('/admin/reports/customer-ledger', payload, { client_id: clientId });
}
/**
 * Fetches the list of available HS Codes for a client
 */
getHsCodes(clientId: string): Promise<any[]> {
  return this.get<any[]>('/admin/client/hs-codes', { client_id: clientId });
}

/**
 * Fetches the Comprehensive HS Code Report
 */
postHsCodeReport(clientId: string, payload: { hscodes: string[], start_date: string, end_date: string }): Promise<any[]> {
  return this.post<any[]>('/admin/reports/comprehensive-hs-code', payload, { client_id: clientId });
}
}
