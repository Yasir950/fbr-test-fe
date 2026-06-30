// angular import
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Project import
import LoginComponent from './components/authentication/login/login.component';
import { AdminComponent } from './theme/layouts/admin/admin.component';
import { OnboardingStatusGuard } from './guards/onboarding-status.guard';

const routes: Routes = [
  {
    path: '',
    component: LoginComponent
  },
  {
    path: 'signup',
    loadComponent: () => import('./components/authentication/signup/signup.component')
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/authentication/forgot-password/forgot-password.component')
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/authentication/reset-password/reset-password.component')
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'client/login',
    component: AdminComponent

  },
  {
    path: 'onboarding',
    canActivate: [OnboardingStatusGuard],
    children: [
      {
        path: 'select-package',
        loadComponent: () => import('./components/client-onboarding/select-package/select-package.component')
      },
      {
        path: 'payment-pending',
        loadComponent: () => import('./components/client-onboarding/payment-pending/payment-pending.component')
      },
      {
        path: 'awaiting-verification',
        loadComponent: () => import('./components/client-onboarding/awaiting-verification/awaiting-verification.component')
      },
      {
        path: 'account-locked',
        loadComponent: () => import('./components/client-onboarding/account-locked/account-locked.component')
      }
    ]
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [OnboardingStatusGuard],
    canActivateChild: [OnboardingStatusGuard],
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
      },
      // {
      //   path: 'packages',
      //   loadComponent: () => import('./components/admin/subscriptions/packages/packages.component')
      // }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {
}
