import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { NgbActiveModal , NgbTypeahead} from '@ng-bootstrap/ng-bootstrap';
import { merge, Observable, OperatorFunction, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { Client, Manager } from '../../../../../services/app.models';
import { ServerService } from '../../../../../services/server.service';
import { ToastService } from '../../../../../services/toast.service';
// Constant for the virtual "Add All" action
const ADD_ALL_ID = 'ACTION_ADD_ALL';

@Component({
  selector: 'app-assign-clients-to-manager',
  templateUrl: './assign-clients-to-manager.component.html',
  styleUrls: ['./assign-clients-to-manager.component.scss']
})
export class AssignClientsToManagerComponent implements OnInit {
  @Input() manager: Manager;
@ViewChild('typeaheadInput', { read: NgbTypeahead }) typeaheadInstance: NgbTypeahead;
@ViewChild('typeaheadInput', { read: ElementRef }) typeaheadInputEl: ElementRef;

  // --- State Management ---
  allClients: Client[] = [];
  assignedClients: Client[] = [];
  availableClients: Client[] = [];
  private initialAssignedClientIds = new Set<string>();

  // --- UI State ---
  loading = true;
  isSaving = false;
  typeaheadModel: any;
  focusSearchClients$ = new Subject<string>();

  constructor(
    public activeModal: NgbActiveModal,
    private serverService: ServerService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  async loadInitialData(): Promise<void> {
    try {
      this.allClients = await this.serverService.get<Client[]>('/admin/list_clients_with_managers');
      this.assignedClients = this.allClients.filter(client =>
        client.managers.includes(this.manager.id)
      );
      this.initialAssignedClientIds = new Set(this.assignedClients.map(c => c.id));
      this.updateAvailableClients();
    } catch (e) {
      this.toastService.showToast('error', 'Failed to load client data.');
    } finally {
      this.loading = false;
    }
  }

  updateAvailableClients(): void {
    const assignedIds = new Set(this.assignedClients.map(c => c.id));
    this.availableClients = this.allClients.filter(client => !assignedIds.has(client.id));
  }

  /**
   * Handles selection from Typeahead. 
   * Detects if "Add All" was clicked or a specific client.
   */
 assignClient(item: any): void {
  if (item.id === ADD_ALL_ID) {
    const term = this.typeaheadModel?.toLowerCase() || '';
    const matches = this.availableClients.filter(c =>
      c.sellerBusinessName.toLowerCase().includes(term) ||
      c.sellerNTNCNIC.toLowerCase().includes(term)
    );
    this.assignedClients.push(...matches);
    this.toastService.showToast('notification', `Added ${matches.length} clients.`);
    this.updateAvailableClients();
    this.typeaheadModel = '';
    return;
  }

  // Toggle: if already assigned → remove, else add
  const existingIndex = this.assignedClients.findIndex(c => c.id === item.id);
  if (existingIndex !== -1) {
    this.assignedClients.splice(existingIndex, 1);
    this.toastService.showToast('notification', `Removed ${item.sellerBusinessName}.`);
  } else {
    this.assignedClients.push(item);
    this.toastService.showToast('notification', `Added ${item.sellerBusinessName}.`);
  }

  this.updateAvailableClients();
  // Do NOT reset typeaheadModel so dropdown stays open for multi-select
}

  removeClient(clientToRemove: Client): void {
    this.assignedClients = this.assignedClients.filter(c => c.id !== clientToRemove.id);
    this.updateAvailableClients();
  }

  async onSubmit(): Promise<void> {
    this.isSaving = true;
    const finalAssignedClientIds = new Set(this.assignedClients.map(c => c.id));

    const clientsToAddManagerTo = this.assignedClients.filter(c => !this.initialAssignedClientIds.has(c.id));
    const clientsToRemoveManagerFrom = Array.from(this.initialAssignedClientIds)
      .filter(id => !finalAssignedClientIds.has(id))
      .map(id => this.allClients.find(c => c.id === id));

    const promises = [];
    clientsToAddManagerTo.forEach(client => {
      const newManagerList = [...client.managers, this.manager.id];
      promises.push(this.serverService.put(`/admin/update-client-managers?client_id=${client.id}`, { 'managers': newManagerList }));
    });

    clientsToRemoveManagerFrom.forEach(client => {
      const newManagerList = client.managers.filter(mId => mId !== this.manager.id);
      promises.push(this.serverService.put(`/admin/update-client-managers?client_id=${client.id}`, { 'managers': newManagerList }));
    });

    try {
      await Promise.all(promises);
      this.toastService.showToast('notification', `Updated assignments for ${this.manager.firstName}.`);
      this.activeModal.close(true);
    } catch (error: any) {
      this.toastService.showToast('error', 'Failed to update assignments.');
    } finally {
      this.isSaving = false;
    }
  }

  // --- Typeahead Formatting ---
  resultFormatter = (result: any) => result.sellerBusinessName;
  inputFormatter = (result: any) => result.sellerBusinessName;

 searchClients: OperatorFunction<string, readonly any[]> = (text$: Observable<string>) => {
  const debouncedText$ = text$.pipe(debounceTime(200), distinctUntilChanged());

  return merge(debouncedText$, this.focusSearchClients$).pipe(
    map((term) => {
      const lowerTerm = term.toLowerCase();

      // Search ALL clients so assigned ones still appear with checked state
      let filtered = this.allClients.filter(
        (client) =>
          client.sellerBusinessName.toLowerCase().includes(lowerTerm) ||
          client.sellerNTNCNIC.toLowerCase().includes(lowerTerm)
      );

      filtered.sort((a, b) => a.sellerBusinessName.localeCompare(b.sellerBusinessName));

      if (filtered.length > 1) {
        const unassignedCount = filtered.filter(c => !this.isClientSelected(c)).length;
        if (unassignedCount > 0) {
          return [
            {
              id: ADD_ALL_ID,
              sellerBusinessName: `ADD ALL MATCHES (${unassignedCount} unassigned)`,
              isAction: true
            },
            ...filtered
          ];
        }
      }

      return filtered;
    })
  );
};
  isClientSelected(client: Client): boolean {
  if (!client || !client.id) return false;
  return this.assignedClients.some(c => c.id === client.id);
}


onSelectItem(event: any): void {
  // Prevent default close behavior
  event.preventDefault();

  const item = event.item;

  if (item.id === ADD_ALL_ID) {
    const term = (typeof this.typeaheadModel === 'string' ? this.typeaheadModel : '').toLowerCase();
    const matches = this.allClients.filter(c =>
      !this.isClientSelected(c) && (
        c.sellerBusinessName.toLowerCase().includes(term) ||
        c.sellerNTNCNIC.toLowerCase().includes(term)
      )
    );
    this.assignedClients.push(...matches);
    this.toastService.showToast('notification', `Added ${matches.length} clients.`);
  } else {
    const existingIndex = this.assignedClients.findIndex(c => c.id === item.id);
    if (existingIndex !== -1) {
      this.assignedClients.splice(existingIndex, 1);
    } else {
      this.assignedClients.push(item);
    }
  }

  this.updateAvailableClients();

  // Keep the input value as-is and re-trigger dropdown
  const currentTerm = typeof this.typeaheadModel === 'string' ? this.typeaheadModel : '';
  
  // Small timeout to let Angular finish the current cycle, then reopen
  setTimeout(() => {
    this.typeaheadModel = currentTerm;
    this.focusSearchClients$.next(currentTerm);
    this.typeaheadInputEl?.nativeElement?.focus();
  }, 10);
}
}