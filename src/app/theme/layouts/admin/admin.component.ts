import { Component, NgZone, OnInit } from '@angular/core';
import { MantisConfig } from 'src/app/app-config';
import { Location } from '@angular/common';
import { ServerService } from '../../../services/server.service';
import { AllCachedData, DocType, HSCode, Province, TransactionType, UOM } from '../../../services/app.models';
import { dropDownValues } from '../../../services/field.values';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {
  navCollapsed;
  navCollapsedMob: boolean;
  windowWidth: number;
  loading = true;

  constructor(private zone: NgZone, private location: Location, private serverService: ServerService) {
    let current_url = this.location.path();
    if (this.location['_baseHref']) {
      current_url = this.location['_baseHref'] + this.location.path();
    }

    this.windowWidth = window.innerWidth;
    this.navCollapsed = this.windowWidth >= 1024 ? MantisConfig.isCollapseMenu : false;
    this.navCollapsedMob = false;
  }

  ngOnInit(): void {
    this.fetchDropdownValues().then(() => {
      this.loading = false;
    });

  }

  async fetchDropdownValues() {
    try {
      const data = await this.serverService.get<AllCachedData>('/fbr/get_dropdowns');
      this.parseDropdownValues(data);
    } catch (e) {
      alert('Something went wrong while getting the app data.');
    }
  }

  parseDropdownValues(data: AllCachedData) {
    this.setProvinces(data.provinces);
    this.setHsCodes(data.hscodes);
    this.setSalesTypes(data.transaction_types);
    this.setUOMs(data.uoms);
    this.setDocumentTypes(data.doctypes);
  }

  setProvinces(data: Province[]) {
    const provinces = [];
    data.forEach((p) => {
      provinces.push(p.value);
    });
    dropDownValues.provinces = provinces;
  }

 setHsCodes(data: HSCode[]) {

  // Sort by numeric value of code
  const sorted = [...data].sort((a, b) => {
    return Number(a.code.replace(/\./g, '')) - Number(b.code.replace(/\./g, ''));
  });

  const codes: string[] = [];
  const descriptions: string[] = [];

  sorted.forEach(c => {
    codes.push(c.code);
    descriptions.push(`${c.code}:-${c.description}`);
  });

  dropDownValues.hsCodes = codes;
  dropDownValues.hsDescriptions = descriptions;
}


setSalesTypes(data: TransactionType[]) {
  const types: string[] = [];
  const rawTypes: Record<string, number> = {};

  data.forEach(t => {
    const clean = t.description.trim();
    types.push(clean);
    rawTypes[clean.toLowerCase()] = t.id;
  });

  // SORT alphabetically
  types.sort((a, b) => a.localeCompare(b));

  dropDownValues.salesTypes = types;
  dropDownValues.salesTypesRaw = rawTypes;
}


setUOMs(data: UOM[]) {
  const uoms: string[] = data
    .map(d => d.description.trim())             // clean values
    .filter(x => x)                             // remove empty strings
    .sort((a, b) => a.localeCompare(b));        // sort alphabetically

  // Remove duplicates
  dropDownValues.uom = Array.from(new Set(uoms));
}


  setDocumentTypes(data: DocType[]) {
    const types = [];
    const rawTypes = {};
    data.forEach((d) => {
      types.push(d.value);
      rawTypes[d.value.trim().toLowerCase()] = d.id;
    });
    dropDownValues.documentTypes = types;
    dropDownValues.documentTypesRaw = rawTypes;
  }

  navMobClick() {
    if (this.navCollapsedMob && !document.querySelector('app-navigation.coded-navbar').classList.contains('mob-open')) {
      this.navCollapsedMob = !this.navCollapsedMob;
      setTimeout(() => {
        this.navCollapsedMob = !this.navCollapsedMob;
      }, 100);
    } else {
      this.navCollapsedMob = !this.navCollapsedMob;
    }
  }
}
