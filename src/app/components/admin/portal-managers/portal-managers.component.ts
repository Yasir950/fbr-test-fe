import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../theme/shared/shared.module';
import { Router } from '@angular/router';
import { Manager } from '../../../services/app.models';
import { ServerService } from '../../../services/server.service';
import { timer } from 'rxjs';

@Component({
  selector: 'app-portal-managers',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './portal-managers.component.html',
  styleUrls: ['./portal-managers.component.scss']
})
export default class PortalManagersComponent implements OnInit {
  allManagers: Manager[] = [];
  filteredManagers: Manager[] = [];
  searchText = '';
  loading = true;

  constructor(private router: Router, private serverService: ServerService) {
  }

  ngOnInit(): void {
    this.pullAdmins().then(() => {
      const due = timer(1000).subscribe(() => {
        this.loading = false;
        due.unsubscribe();
      });
    });
  }

  async pullAdmins() {
    try {
      this.allManagers = await this.serverService.get<Manager[]>('/admin/list_users');
      this.filteredManagers = [...this.allManagers];
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Filters the managers list based on the search text.
   * The search is case-insensitive and checks both first and last names.
   */
  filterManagers(): void {
    if (!this.searchText) {
      this.filteredManagers = [...this.allManagers];
      return;
    }

    const lowerCaseSearch = this.searchText.toLowerCase();
    this.filteredManagers = this.allManagers.filter(manager =>
      manager.firstName.toLowerCase().includes(lowerCaseSearch) ||
      manager.lastName.toLowerCase().includes(lowerCaseSearch)
    );
  }

  /**
   * Helper function to return the correct Bootstrap badge class based on admin type.
   */
  getBadgeClass(adminType: string): string {
    return adminType.toLowerCase() === 'super' ? 'bg-success' : 'bg-warning';
  }

  /**
   * Placeholder for viewing manager details.
   */
  viewManager(id: string): void {
    this.router.navigateByUrl(`/admin/view-manager?user_id=${id}`).then();
  }

  addNewManager() {
    this.router.navigateByUrl(`/admin/add-manager`).then();
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
}
