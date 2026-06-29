import { Injectable } from '@angular/core';
import { NgbModalOptions, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { Manager } from './app.models';

export function getAclLevel() {
  const user: Manager = JSON.parse(localStorage.getItem('user'));
  const role: string = user.adminType;
  switch (role) {
    case 'super':
      return 4;
    case 'invoice_generator':
      return 1;
    case 'reviewer':
      return 2;
    case 'submitter':
      return 3;
    default:
      return 1;
  }
}

@Injectable()
export class UtilityService {
  constructor() {
  }

  getModalOptions(): NgbModalOptions {
    return {
      backdrop: 'static',
      keyboard: false,
      backdropClass: `wallet-backdrop`
    };
  }

  registerOnModalClose(modal: NgbModalRef) {
    ['closed', 'dismissed', 'hidden'].forEach((modalItem) => {
      const subject: Subject<any> = modal[modalItem].subscribe(() => {
        subject.unsubscribe();
      });
    });
  }
}
