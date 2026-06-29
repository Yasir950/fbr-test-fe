// angular import
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

// project import
import tableData from 'src/fake-data/default-data.json';
import { SharedModule } from 'src/app/theme/shared/shared.module';

// bootstrap import
// third party
import { ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexGrid, ApexLegend, ApexPlotOptions, ApexStroke, ApexXAxis, ApexYAxis, NgApexchartsModule } from 'ng-apexcharts';
import { SubmissionStats } from '../../../services/app.models';
import { ServerService } from '../../../services/server.service';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  xaxis: ApexXAxis;
  colors: string[];
  stroke: ApexStroke;
  grid: ApexGrid;
  yaxis: ApexYAxis;
  legend: ApexLegend;
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, SharedModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export default class DashboardComponent implements OnInit {
  currentStats = [
    {
      title: 'Pending',
      amount: '0',
      border: 'border-primary',
      color: 'text-primary',
      subText: 'Total invoices waiting for submission',
      key: 'pending'
    },
    {
      title: 'Under Initial Review',
      amount: '0',
      border: 'border-info',
      color: 'text-info',
      subText: 'Invoices under initial review',
      key: 'initial_review'
    },
    {
      title: 'Under Final Review',
      amount: '0',
      border: 'border-warning',
      color: 'text-warning',
      subText: 'Invoices under final review',
      key: 'final_review'
    },
    {
      title: 'Rejected',
      amount: '0',
      border: 'border-danger',
      color: 'text-danger',
      subText: 'Invoices rejected by managers',
      key: 'rejected'
    }
  ];

  submissionStats = [
    {
      title: 'Today',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR today',
      key: 'submitted_today'
    },
    {
      title: 'Last 7 Days',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR this week',
      key: 'submitted_this_week'
    },
    {
      title: 'This Month',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR this month',
      key: 'submitted_this_month'
    },
    {
      title: 'This Year',
      amount: '0',
      border: 'border-success',
      color: 'text-success',
      subText: 'Invoices submitted to FBR this year',
      key: 'submitted_this_year'
    }
  ];
  tables = tableData;
  loading = true;

  // constructor
  constructor(private serverService: ServerService) {
  }

  // life cycle event
  ngOnInit(): void {
    this.fetchClientDetails().then(() => {
      this.loading = false;
    });
  }


  async fetchClientDetails() {
    try {
      const counts = await this.serverService.get<SubmissionStats>(`/admin/system-stats`);
      ['initial_review', 'final_review', 'rejected', 'pending'].forEach((key) => {
        const item = this.currentStats.find((s) => {
          return s.key === key;
        });
        item.amount = counts[key];
      });
      ['submitted_today', 'submitted_this_week', 'submitted_this_month', 'submitted_this_year'].forEach((key) => {
        const item = this.submissionStats.find((s) => {
          return s.key === key;
        });
        item.amount = counts[key];
      });
    } catch (e) {
      alert('Something went wrong. Unable to launch the dashboard.');
    }
  }

}
