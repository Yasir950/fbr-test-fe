import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { ServerService } from '../../../services/server.service'; // Adjust path
import { ClientList } from '../../../services/app.models';
import { SharedModule } from '../../../theme/shared/shared.module'; // Adjust path

// --- Interfaces for Type Safety (matching your backend models) ---
type JobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface FailedInvoiceInfo {
  invoice_id: string;
  error_message: string;
  timestamp: string;
}

interface SubmittingUser {
  name: string;
  role: string;
  'contact-info': string;
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
  submitting_user: SubmittingUser;
}

@Component({
  selector: 'app-submission-job-details',
  templateUrl: './submission-job-details.component.html',
  styleUrls: ['./submission-job-details.component.scss'],
  standalone: true,
  imports: [SharedModule]
})
export default class SubmissionJobDetailsComponent implements OnInit, OnDestroy {
  job: SubmissionJob | null = null;
  client: ClientList | null = null;
  isLoading = true;
  error: string | null = null;

  private jobId: string;
  private pollingSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private serverService: ServerService
  ) {
  }

  ngOnInit(): void {
    this.jobId = this.route.snapshot.queryParamMap.get('job_id');
    if (!this.jobId) {
      this.error = 'Job ID is missing from the URL.';
      this.isLoading = false;
      return;
    }
    this.loadJobDetails();
  }

  ngOnDestroy(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
  }

  async loadJobDetails(): Promise<void> {
    this.isLoading = true;
    try {
      // Fetch job and client details concurrently for faster loading
      const jobPromise = this.serverService.get<SubmissionJob>(`/admin/submission-job/${this.jobId}`);

      // We need the client_id from the job to fetch the client, so we must await it first
      const jobData = await jobPromise;
      this.job = jobData;

      const clientPromise = this.serverService.get<ClientList>(`/admin/get_client_summary?id=${this.job.client_id}`);
      this.client = await clientPromise;

      // If the job is still running, start polling for updates
      if (this.job.status === 'in_progress' || this.job.status === 'pending') {
        this.startPolling();
      }

    } catch (err) {
      this.error = err.response?.data?.detail || 'Failed to load job details.';
    } finally {
      this.isLoading = false;
    }
  }

  getStatusInfo(status: JobStatus): { badgeClass: string; icon: string } {
    switch (status) {
      case 'completed':
        return { badgeClass: 'bg-success', icon: 'ti ti-circle-check' };
      case 'in_progress':
        return { badgeClass: 'bg-warning', icon: 'ti ti-loader' };
      case 'failed':
        return { badgeClass: 'bg-danger', icon: 'ti ti-circle-x' };
      case 'pending':
        return { badgeClass: 'bg-info', icon: 'ti ti-clock' };
      default:
        return { badgeClass: 'bg-secondary', icon: 'ti ti-help' };
    }
  }

  // --- Helper Functions for the Template ---

  getShortId(id: string): string {
    return id.slice(-8).toUpperCase();
  }

  navigateToInvoice(invoiceId: string): void {
    // Assuming you have a route set up for this
    this.router.navigateByUrl(`admin/invoice-details?id=${invoiceId}`).then();
  }

  getDuration(): string | null {
    if (!this.job?.started_at || !this.job?.finished_at) {
      return null;
    }
    const start = new Date(this.job.started_at).getTime();
    const end = new Date(this.job.finished_at).getTime();
    const durationSeconds = Math.round((end - start) / 1000);

    if (durationSeconds < 60) {
      return `${durationSeconds} second(s)`;
    }
    const durationMinutes = Math.floor(durationSeconds / 60);
    const remainingSeconds = durationSeconds % 60;
    return `${durationMinutes} minute(s) and ${remainingSeconds} second(s)`;
  }

  private startPolling(): void {
    // Poll every 10 seconds (more frequent for a details page)
    this.pollingSubscription = timer(10000, 10000).subscribe(async () => {
      try {
        const updatedJob = await this.serverService.get<SubmissionJob>(`/admin/submission-job/${this.jobId}`);
        this.job = updatedJob;

        // Stop polling if the job is finished
        if (this.job.status === 'completed' || this.job.status === 'failed') {
          this.pollingSubscription.unsubscribe();
        }
      } catch (err) {
        console.error('Polling failed, stopping.', err);
        this.pollingSubscription.unsubscribe();
      }
    });
  }
}
