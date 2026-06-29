import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../../theme/shared/shared.module';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { timer } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ServerService } from '../../../../services/server.service';
import { Manager, User } from '../../../../services/app.models';
import { AssignManagersComponent } from '../../clients/client-details/assign-managers/assign-managers.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { getAclLevel, UtilityService } from '../../../../services/utility';
import { AssignClientsToManagerComponent } from '../../clients/client-details/assign-clients-to-manager/assign-clients-to-manager.component';

@Component({
  selector: 'app-add-manager',
  standalone: true,
  imports: [SharedModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './add-manager.component.html',
  styleUrls: ['./add-manager.component.scss']
})
export default class AddManagerComponent implements OnInit {
  managerForm: FormGroup;
  isLoading = false;
  formSubmitted = false;
  viewMode = false;
  currentView = 'add';
  loading = false;
  errorMsg = null;
  user_id = null;
  manager: Manager = null;
  public aclLevel = getAclLevel();

  constructor(private fb: FormBuilder, private activeRoute: ActivatedRoute, private serverService: ServerService, private router: Router, private modalService: NgbModal, private utility: UtilityService) {
  }

  // Helper getter for easy access to form controls in the template
  get f(): any {
    return this.managerForm.controls;
  }

  ngOnInit(): void {
    this.managerForm = this.fb.group({
      adminType: ['reviewer', Validators.required],
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(10)]],
      firstName: ['', [Validators.required, Validators.minLength(3)]],
      lastName: ['', [Validators.required, Validators.minLength(3)]],
      cellNumber1: ['', Validators.required],
      cellNumber2: [''], // Optional, so no required validator
      address: ['', [Validators.required, Validators.minLength(10)]]
    });
    this.handleFormMode().then(() => {
      const due = timer(1000).subscribe(() => {
        this.loading = false;
        due.unsubscribe();
      });
    });
  }

  async handleFormMode() {
    this.viewMode = this.activeRoute.snapshot.url[0].path === 'view-manager';
    if (this.viewMode) {
      this.currentView = 'view';
      this.loading = true;
    }
    if (this.viewMode) {
      this.user_id = this.activeRoute.snapshot.queryParamMap.get('user_id');
      if (this.user_id) {
        const user = await this.serverService.get<User>('/admin/get_user', { id: this.user_id });
        this.manager = user;
        const keys = Object.keys(this.managerForm.controls);
        keys.forEach((key) => {
          this.managerForm.controls[key].setValue(user[key]);
        });
        this.managerForm.disable();
      } else {
        this.router.navigateByUrl('admin/managers').then();
      }
    }
  }

  async onSubmit() {
    this.formSubmitted = true;
    // Stop here if form is invalid
    if (this.managerForm.invalid) {
      return;
    }
    this.isLoading = true;
    const formValue = this.managerForm.value;
    try {
      if (this.currentView == 'view') {
        formValue['user_id'] = this.user_id;
      }
      await this.serverService.post(`/admin/${this.currentView == 'view' ? 'edit' : 'add'}_user`, formValue);
      // Reset the form to its initial state
      this.managerForm.reset();
      // After reset, patch the default value for adminType back
      this.managerForm.patchValue({ adminType: 'reviewer' });
      this.router.navigateByUrl('admin/managers').then();
    } catch (error) {
      this.errorMsg = error.response?.data?.detail || 'Failed to add the user';
    }
    this.isLoading = false;
    this.formSubmitted = false;
  }

  enableForm() {
    this.managerForm.enable();
    this.viewMode = false;
  }

  openAssignManagersView() {
    const modal = this.modalService.open(AssignClientsToManagerComponent, this.utility.getModalOptions());
    modal.componentInstance.manager = this.manager;
    this.utility.registerOnModalClose(modal);
  }


}
