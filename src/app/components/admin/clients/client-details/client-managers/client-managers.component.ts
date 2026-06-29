import { Component, Input, OnInit } from '@angular/core';
import { timer } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ServerService } from '../../../../../services/server.service';
import { Client } from '../../../../../services/app.models';
import { Router } from '@angular/router';

// Interface for strong typing our Manager object
interface Manager {
  id: string;
  adminType: 'invoice_generator';
  username: string;
  password: string;
}

@Component({
  selector: 'app-client-managers',
  templateUrl: './client-managers.component.html',
  styleUrls: ['./client-managers.component.scss']
})
export class ClientManagersComponent implements OnInit {

  managers: Manager[] = [];

  @Input() client: Client;
  loading = true;

  // State variable to manage the loading UI
  isAddingManager = false;

  constructor(public activeModal: NgbActiveModal, private serverService: ServerService, private router: Router) {
  }

  ngOnInit() {
    setTimeout(() => {
      this.pullAdmins().then(() => {
        const due = timer(1000).subscribe(() => {
          this.loading = false;
          due.unsubscribe();
        });
      });
    }, 200);
  }

  async pullAdmins() {
    try {
      this.managers = await this.serverService.get<Manager[]>(`/admin/list_client_users?clientId=${this.client.id}`);
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Adds a new manager with randomly generated credentials.
   */
  async addManager() {
    this.isAddingManager = true;
    try {
      this.managers = await this.serverService.post<Manager[]>(`/admin/add_client_user?clientId=${this.client.id}`);
    } catch (e) {
      console.log(e);
    }
    this.isAddingManager = false;
  }

  /**
   * Deletes a manager from the list after confirmation.
   */
  async deleteManager(id: string, username: string) {
    const confirmation = confirm(`Are you sure you want to delete the manager "${username}"?`);
    if (confirmation) {
      this.loading = true;
      try {
        await this.serverService.delete(`/admin/delete_user?user_id=${id}`);
        this.pullAdmins().then(() => {
          const due = timer(1000).subscribe(() => {
            this.loading = false;
            due.unsubscribe();
          });
        });
      } catch (error) {
        this.loading = false;
      }
    }
  }

  viewManager(id: string) {
    this.router.navigateByUrl(`admin/view-manager?user_id=${id}`).then();
    this.activeModal.close();
  }

}
