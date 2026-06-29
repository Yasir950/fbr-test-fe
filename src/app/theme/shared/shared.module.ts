// Angular Imports
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// project import
import { BreadcrumbComponent } from './components/breadcrumb/breadcrumb.component';
import { CardComponent } from './components/card/card.component';

import { SpinnerComponent } from './components/spinner/spinner.component';
import { NgScrollbarModule } from 'ngx-scrollbar';

// bootstrap import
import { NgbCollapseModule, NgbDropdownModule, NgbModalModule, NgbModule, NgbNavModule, NgbTypeaheadModule } from '@ng-bootstrap/ng-bootstrap';
import { AssignManagersComponent } from '../../components/admin/clients/client-details/assign-managers/assign-managers.component';
import { ClientManagersComponent } from '../../components/admin/clients/client-details/client-managers/client-managers.component';
import { ClientBillingComponent } from '../../components/admin/clients/client-details/client-billing/client-billing.component';
import { ChargeClientComponent } from '../../components/admin/clients/client-details/client-billing/charge-client/charge-client.component';
import { AssignClientsToManagerComponent } from '../../components/admin/clients/client-details/assign-clients-to-manager/assign-clients-to-manager.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    BreadcrumbComponent,
    NgbDropdownModule,
    NgbNavModule,
    NgbModule,
    NgbCollapseModule,
    NgScrollbarModule,
    NgbModalModule,
    NgbTypeaheadModule,
    NgbDropdownModule
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CardComponent,
    BreadcrumbComponent,
    SpinnerComponent,
    NgbModule,
    NgbDropdownModule,
    NgbNavModule,
    NgbCollapseModule,
    NgScrollbarModule
  ],
  declarations: [SpinnerComponent, AssignManagersComponent, ClientManagersComponent, ClientBillingComponent, ChargeClientComponent, AssignClientsToManagerComponent]
})
export class SharedModule {
}
