import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { ServerService } from '../../../services/server.service'; // Adjust path
import { ClientList } from '../../../services/app.models';
import { SharedModule } from '../../../theme/shared/shared.module'; // Adjust path
import { Location } from '@angular/common';

// --- Interfaces for Type Safety (matching your backend models) ---
type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface FailedInvoiceInfo {
  invoice_id: string;
  error_message: string;
  timestamp: string;
}

interface SubmissionJob {
  _id: string;
  client_id: string;
  status: JobStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  total_invoices: number;
  processed_count: number;
  successful_invoices: string[];
  failed_invoices: FailedInvoiceInfo[];
  submitted_by: string;
}

@Component({
  selector: 'app-client-submission-jobs',
  templateUrl: './client-submission-jobs.component.html',
  styleUrls: ['./client-submission-jobs.component.scss'],
  standalone: true,
  imports: [SharedModule]
})
export default class ClientSubmissionJobsComponent implements OnInit, OnDestroy {
  client: ClientList | null = null;
  jobs: SubmissionJob[] = [];
  isLoading = true;
  error: string | null = null;
  private clientId: string;
  private pollingSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private serverService: ServerService,
    private router: Router,
    private location: Location
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.clientId = this.route.snapshot.queryParamMap.get('client_id');
      if (!this.clientId) {
        throw new Error('Client ID is missing from the URL.');
      }

      // Fetch initial client and jobs data
      this.client = await this.serverService.get<ClientList>(`/admin/get_client_summary?id=${this.clientId}`);
      await this.fetchJobs();

      // Start polling for in-progress jobs
      this.startPollingForInProgressJobs();

    } catch (err) {
      this.error = err.message || 'Failed to load initial data.';
    } finally {
      this.isLoading = false;
    }
  }

  viewJobDetail(id: string) {
    this.router.navigateByUrl(`/admin/job-details?job_id=${id}`).then();
  }

  ngOnDestroy(): void {
    // IMPORTANT: Unsubscribe from the polling timer to prevent memory leaks
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  /**
   * Fetches the full list of jobs for the client.
   */
  async fetchJobs(): Promise<void> {
    this.jobs = await this.serverService.get<SubmissionJob[]>(`/admin/submission-jobs/client/${this.clientId}`);
  }

  /**
   * Sets up an RxJS timer to poll for the status of any 'in_progress' jobs every 30 seconds.
   */
  private startPollingForInProgressJobs(): void {
    // Polling interval: starts immediately, then every 30 seconds
    const pollInterval = timer(0, 30000);

    this.pollingSubscription = pollInterval.subscribe(async () => {
      // Find jobs that are currently in progress from our local list
      const inProgressJobs = this.jobs.filter(job => job.status === 'in_progress');

      if (inProgressJobs.length === 0) {
        // No need to poll if nothing is running
        return;
      }

      console.log(`Polling for status of ${inProgressJobs.length} in-progress job(s)...`);

      // Asynchronously update each in-progress job
      for (const job of inProgressJobs) {
        try {
          const updatedJob = await this.serverService.get<SubmissionJob>(`/admin/submission-job/${job._id}`);

          // Find the index of the job in our main array and update it
          const index = this.jobs.findIndex(j => j._id === updatedJob._id);
          if (index !== -1) {
            this.jobs[index] = updatedJob;
          }
        } catch (err) {
          console.error(`Failed to update status for job ${job._id}`, err);
          // Optional: Mark the job as 'failed' on the UI if the API fails
          const index = this.jobs.findIndex(j => j._id === job._id);
          if (index !== -1) this.jobs[index].status = 'failed';
        }
      }
    });
  }

  /**
   * Returns the appropriate Bootstrap badge class based on the job's status.
   */
  getStatusBadgeClass(status: JobStatus): string {
    switch (status) {
      case 'completed':
        return 'bg-success';
      case 'in_progress':
        return 'bg-warning';
      case 'failed':
        return 'bg-danger';
      case 'pending':
        return 'bg-info';
      default:
        return 'bg-secondary';
    }
  }

  /**
   * A helper to get the last 8 characters of the ID for display.
   */
  getShortId(id: string): string {
    return id.slice(-8).toUpperCase();
  }

  /**
   * Manually trigger a refresh of all job data.
   */
  async manualRefresh(): Promise<void> {
    this.isLoading = true;
    try {
      await this.fetchJobs();
    } catch (err) {
      this.error = "Failed to refresh jobs list.";
    } finally {
      this.isLoading = false;
    }
  }
    goBack(): void {
    this.location.back();
  }
}
