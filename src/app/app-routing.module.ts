// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import LoginComponent from './components/authentication/login/login.component';
import { AdminComponent } from './theme/layouts/admin/admin.component';

const routes: Routes = [
  {
    path: '',
    component: LoginComponent
  },
  {
    path: 'client/login',
    component: AdminComponent

  },
  {
    path: 'admin',
    component: AdminComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./components/admin/dashboard/dashboard.component')
      },
      {
        path: 'clients',
        loadComponent: () => import('./components/admin/clients/clients.component')
      },
      {
        path: 'add-client',
        loadComponent: () => import('./components/admin/clients/add-client/add-client.component')
      },
      {
        path: 'client-details',
        loadComponent: () => import('./components/admin/clients/client-details/client-details.component')
      },
      {
        path: 'bulk-invoices',
        loadComponent: () => import('./components/shared/bulk-invoice-upload/bulk-invoice-upload.component')
      },
      {
        path: 'queue-submissions',
        loadComponent: () => import('./components/shared/client-submission/client-submission-jobs.component')
      },
      {
        path: 'job-details',
        loadComponent: () => import('./components/shared/submission-job-details/submission-job-details.component')
      },
      {
        path: 'client-invoices',
        loadComponent: () => import('./components/admin/clients/client-invoices/client-invoices.component')
      },
      {
        path: 'invoice-details',
        loadComponent: () => import('./components/admin/clients/invoice-details/invoice-details.component')
      },
      {
        path: 'add-manager',
        loadComponent: () => import('./components/admin/portal-managers/add-manager/add-manager.component')
      },
      {
        path: 'view-manager',
        loadComponent: () => import('./components/admin/portal-managers/add-manager/add-manager.component')
      },
      {
        path: 'managers',
        loadComponent: () => import('./components/admin/portal-managers/portal-managers.component')
      },
      {
        path: 'dropdowns',
        loadComponent: () => import('./components/admin/form-dropdown-values/form-dropdown-values.component')
      },
      {
        path: 'invoice-form',
        loadComponent: () => import('./components/shared/invoice-form/invoice-form.component')
      },
      {
        path: 'edit-invoice-form',
        loadComponent: () => import('./components/shared/invoice-form/invoice-form.component')
      },
      {
        path: 'sandbox-testing',
        loadComponent: () => import('./components/admin/clients/sandbox-testing/sandbox-testing.component')
      },
      {
        path: 'sandbox-invoice-form',
        loadComponent: () => import('./components/shared/invoice-form/invoice-form.component')
      },
      {
        path: 'reporting',
        loadComponent: () => import('./components/admin/clients/reporting/reporting.component')
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
