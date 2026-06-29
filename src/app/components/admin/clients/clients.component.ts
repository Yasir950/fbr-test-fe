import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../theme/shared/shared.module';
import { Router } from '@angular/router';
import { ServerService } from '../../../services/server.service';
import { ClientList } from '../../../services/app.models';
import { getAclLevel } from '../../../services/utility';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './clients.component.html',
  styleUrls: ['./clients.component.scss']
})
export default class ClientsComponent implements OnInit {

  tables: ClientList[] = [];
  filteredTables: ClientList[] = []; // Create a copy for filtering
  searchText = '';
  loading = true;
  public aclLevel = getAclLevel();

  constructor(private router: Router, private serverService: ServerService) {
  }

  ngOnInit(): void {
    this.fetchClients().then(() => {
      this.loading = false;
    });
  }

  filterClients(value: string): void {
    if (!value) {
      this.filteredTables = [...this.tables];
      return;
    }

    this.filteredTables = this.tables.filter(client =>
      client.sellerBusinessName.toLowerCase().includes(value.toLowerCase()) ||
      client.sellerNTNCNIC.toLowerCase().includes(value.toLowerCase())
    );
  }

  addNewClient() {
    this.router.navigateByUrl('admin/add-client').then();
  }

  navigateToProfile(id: string) {
    this.router.navigateByUrl(`/admin/client-details?id=${id}`).then();
  }

  navigateToInvoices(id: string) {
    this.router.navigateByUrl(`/admin/client-invoices?id=${id}`).then();
  }
  navigateToReporting(id: string) {
    this.router.navigateByUrl(`/admin/reporting?id=${id}`).then();
  }
  async fetchClients() {
    try {
      this.tables = await this.serverService.get<ClientList[]>('/admin/list_clients');
      this.filteredTables = [...this.tables];
    } catch (error: any) {
      console.log(error);
    }
  }

  async deleteClient(id: string, name: string) {
    const confirmation = confirm(`Are you sure you want to delete "${name}"?`);
    if (confirmation) {
      this.loading = true;
      await this.serverService.delete(`/admin/clients/update/delete?client_id=${id}`);
      this.fetchClients().then(() => {
        this.loading = false;
      });
    }
  }

}
