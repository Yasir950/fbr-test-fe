import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { merge, Observable, OperatorFunction, Subject, timer } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { Client, Manager } from '../../../../../services/app.models';
import { ServerService } from '../../../../../services/server.service';
import { ToastService } from '../../../../../services/toast.service';

@Component({
  selector: 'app-assign-managers',
  templateUrl: './assign-managers.component.html',
  styleUrls: ['./assign-managers.component.scss']
})
export class AssignManagersComponent implements OnInit {

  @Input() client: Client;

  allManagers: Manager[] = [];
  availableManagers: Manager[] = [];
  assignedManagers: Manager[] = [];
  focusSearchScenarios$ = new Subject<string>();

  isLoading = false;
  typeaheadModel: any; // Model for the typeahead input field
  loading = true;

  constructor(public activeModal: NgbActiveModal, private serverService: ServerService, private toastService: ToastService) {
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
      this.availableManagers = [...this.allManagers];
      const currentManagersIds = this.client.managers;
      currentManagersIds.forEach((id) => {
        const manager = this.allManagers.find((m) => {
          return m.id == id;
        });
        this.assignedManagers.push(manager);
      });
      this.updateAvailableManagers();
    } catch (e) {
      console.log(e);
    }
  }

  /**
   * Recalculates the list of managers available for assignment.
   * This is the core logic that prevents duplicates.
   */
  updateAvailableManagers(): void {
    const assignedIds = new Set(this.assignedManagers.map(m => m.id));
    this.availableManagers = this.allManagers.filter(m => !assignedIds.has(m.id));
  }

  /**
   * Adds a selected manager to the assigned list.
   * @param manager The manager object to assign.
   */
  assignManager(manager: Manager): void {
    this.assignedManagers.push(manager);
    this.updateAvailableManagers();
    this.typeaheadModel = ''; // Clear the input for the next selection
  }

  /**
   * Removes a manager from the assigned list.
   * @param managerToRemove The manager object to remove.
   */
  removeManager(managerToRemove: Manager): void {
    this.assignedManagers = this.assignedManagers.filter(m => m.id !== managerToRemove.id);
    this.updateAvailableManagers();
  }

  /**
   * Handles the final submission of assigned manager IDs.
   */
  async onSubmit() {
    this.isLoading = true;
    const assignedIds = this.assignedManagers.map(m => m.id);
    try {
      await this.serverService.put(`/admin/update-client-managers?client_id=${this.client.id}`, { 'managers': assignedIds });
      this.toastService.showToast('notification', `Client details updated successfully`);
    } catch (error: any) {
      this.toastService.showToast('error', error?.message || `Failed to update the managers`);
    } finally {
      this.isLoading = false;
      this.client.managers = assignedIds;
      this.activeModal.close(assignedIds);
    }
  }

  /**
   * Formats the result displayed in the typeahead dropdown.
   */
  resultFormatter = (result: Manager) => `${result.firstName} ${result.lastName} (${result.username})`;

  /**
   * Formats the value displayed in the input field after a selection.
   */
  inputFormatter = (result: Manager) => `${result.firstName} ${result.lastName}`;

  /**
   * The search function for the typeahead.
   */
  search: OperatorFunction<string, readonly Manager[]> = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      map(term => {
        if (term.length < 2) {
          return [];
        }
        const lowerTerm = term.toLowerCase();
        return this.availableManagers.filter(manager =>
          manager.username.toLowerCase().includes(lowerTerm) ||
          manager.firstName.toLowerCase().includes(lowerTerm) ||
          manager.lastName.toLowerCase().includes(lowerTerm)
        ).slice(0, 10); // Show top 10 results
      })
    );


  searchScenarios: (text$: Observable<string>) => Observable<Manager[]> = (text$: Observable<string>) => {
    const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());
    // Merge the stream of user typing with the stream of focus events
    return merge(debouncedText$, this.focusSearchScenarios$).pipe(
      map(term =>
        (term === ''
            ? this.availableManagers.slice(0, 20) // Show initial list on focus (empty term)
            : this.availableManagers.filter(manager =>
              manager.username.toLowerCase().includes(term.toLowerCase()) ||
              manager.firstName.toLowerCase().includes(term.toLowerCase()) ||
              manager.lastName.toLowerCase().includes(term.toLowerCase())
            ).slice(0, 10)
        ).slice(0, 10) // Always limit the final results
      )
    );
  };

}
