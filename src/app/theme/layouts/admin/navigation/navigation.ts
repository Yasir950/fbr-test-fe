import { Injectable } from '@angular/core';

export interface NavigationItem {
  id: string;
  title: string;
  type: 'item' | 'collapse' | 'group';
  translate?: string;
  icon?: string;
  hidden?: boolean;
  url?: string;
  classes?: string;
  exactMatch?: boolean;
  external?: boolean;
  target?: boolean;
  breadcrumbs?: boolean;
  badge?: {
    title?: string;
    type?: string;
  };
  children?: Navigation[];
}

export interface Navigation extends NavigationItem {
  children?: NavigationItem[];
}

const NavigationItems = [
  {
    id: 'dashboard',
    title: 'Statistics',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'default',
        title: 'Dashboard',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/dashboard',
        icon: 'ti ti-dashboard',
        breadcrumbs: false
      }
    ]
  },
  {
    id: 'elements',
    title: 'My Companies',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'clients',
        title: 'My Companies',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/clients',
        icon: 'ti ti-users'
      },
      {
        id: 'new-client',
        title: 'Add Client',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/add-client',
        icon: 'ti ti-user-plus'
      }
    ]
  },
  {
    id: 'managers',
    title: 'Portal Managers',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'managers-list',
        title: 'Managers',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/managers',
        icon: 'ti ti-settings'
      },
      {
        id: 'add-manager',
        title: 'Add Manager',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/add-manager',
        icon: 'ti ti-user-plus'
      }
    ]
  },
  {
    id: 'helpers',
    title: 'Form Values',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'dropdowns',
        title: 'Dropdowns',
        type: 'item',
        url: '/admin/dropdowns',
        classes: 'nav-item',
        icon: 'ti ti-select'
      }
    ]
  },
  {
    id: 'sandbox',
    title: 'Sandbox Testing',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'sandbox-testing',
        title: 'Submit Invoices',
        type: 'item',
        url: '/admin/sandbox-testing',
        classes: 'nav-item',
        icon: 'ti ti-building'
      }
    ]
  },
   {
    id: 'subscription',
    title: 'Subscription',
    type: 'group',
    icon: 'icon-navigation',
    children: [
      {
        id: 'my-package',
        title: 'My Package',
        type: 'item',
        classes: 'nav-item',
        url: '/admin/package',
        icon: 'ti ti-credit-card'
      }
    ]
  },
];

@Injectable()
export class NavigationItem {
  get() {
    return NavigationItems;
  }
}
