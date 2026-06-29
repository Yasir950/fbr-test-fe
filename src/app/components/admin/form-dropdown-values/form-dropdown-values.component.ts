import { Component, OnInit } from '@angular/core';
import { SharedModule } from '../../../theme/shared/shared.module';
import { dropDownValues } from '../../../services/field.values';

interface Category {
  key: string;
  label: string;
}

@Component({
  selector: 'app-form-dropdown-values',
  standalone: true,
  imports: [SharedModule],
  templateUrl: './form-dropdown-values.component.html',
  styleUrls: ['./form-dropdown-values.component.scss']
})
export default class FormDropdownValuesComponent implements OnInit {
  // An array to hold our categories for creating buttons
  categories: Category[] = [];
  // State management properties
  activeKey: string | null = null;
  searchText = '';
  displayData: (string | number)[] = [];
  // A map to create user-friendly labels from JSON keys
  readonly labelMap: { [key: string]: string } = {
    scenarios: 'Scenarios',
    hsCodes: 'HS Codes',
    hsDescriptions: 'HS Descriptions',
    documentTypes: 'Document Types',
    salesTypes: 'Sales Types',
    provinces: 'Provinces',
    uom: 'Unit Of Measurements',
    // reasons: 'Reasons'
  };
// Our main data source
  private allData = dropDownValues;

  constructor() {
  }

  ngOnInit(): void {
    // Populate the categories array from the keys of our data object
    this.categories = Object.keys(this.labelMap).map(key => ({
      key: key,
      label: this.labelMap[key]
    }));
  }

  /**
   * Sets the active category and displays its data.
   * @param key The key of the selected category (e.g., 'provinces')
   */
  selectCategory(key: string): void {
    this.activeKey = key;
    this.searchText = '';
    this.displayData = [...this.allData[key]];
  }

  /**
   * Filters the currently displayed data based on the search text.
   */
  filterData(): void {
    if (!this.activeKey) {
      return;
    }
    if (!this.searchText) {
      this.displayData = [...this.allData[this.activeKey]];
      return;
    }
    const lowerCaseSearch = this.searchText.toLowerCase();
    this.displayData = this.allData[this.activeKey].filter(item =>
      String(item).toLowerCase().includes(lowerCaseSearch)
    );
  }

  // A simple fallback formatter for keys not in the labelMap
  private formatKey(key: string): string {
    const result = key.replace(/([A-Z])/g, ' $1');
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}
