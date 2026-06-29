import { Component } from '@angular/core';
import { SharedModule } from '../../../../theme/shared/shared.module';
import { Router } from '@angular/router';
import { ClientList } from '../../../../services/app.models';
import { ServerService } from '../../../../services/server.service';

@Component({
  selector: 'app-sandbox-testing',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './sandbox-testing.component.html',
  styleUrls: ['./sandbox-testing.component.scss']
})
export default class SandboxTestingComponent {
  tables = [];
  filteredTables = []; // Create a copy for filtering
  searchText = '';
  loading = true;

  constructor(private router: Router, private serverService: ServerService) {
  }

  ngOnInit(): void {
    this.fetchClients().then(() => {
      setTimeout(() => {
        this.loading = false
      }, 1000);
    });
  }


  async fetchClients() {
    try {
      this.tables = await this.serverService.get<ClientList[]>('/admin/list_clients');
      this.filteredTables = [...this.tables];
    } catch (error: any) {
      console.log(error);
    }
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

  navigateToInvoices(client_id: string) {
    this.router.navigateByUrl(`/admin/sandbox-invoice-form?client_id=${client_id}`).then();
  }
}
