export interface LoginResponse {
  detail: string;
  token: string;
  user: User
}

export interface User {
  id: string;
  username: string;
  password: string;
  token: string;
  firstName: string;
  lastName: string;
  picture: string | null;
  cellNumber1: string;
  cellNumber2: string | null;
  address: string;
  adminType: 'super' | 'invoice_generator' | 'reviewer' | 'submitter';
  clientId: string | null;
  active: boolean;
  verified: boolean;
  deleted: boolean;
  deleteable: boolean;
}

export interface Manager {
  id: string;
  adminType: string;
  username: string;
  firstName: string;
  lastName: string;
  cellNumber1: string;
  cellNumber2?: string;
  deleteable: boolean;
}

export type ClientList = {
  'id': string,
  'sellerNTNCNIC': string,
  'sellerBusinessName': string,
  'sellerProvince': string,
  'sellerAddress': string,
  'initialReview': number,
  'finalReview': number,
  'rejected': number,
  'pending': number
}

export type Client = {
  id: string
  sellerNTNCNIC: string,
  sellerBusinessName: string,
  sellerProvince: string,
  sellerAddress: string,
  ip: string,
  sandboxToken: string,
  productionToken: string,
  active: boolean,
  deleted: boolean,
  deleteable: boolean,
  verified: boolean,
  initialReview: number,
  finalReview: number,
  rejected: number,
  pending: number,
  submittedToday: number,
  submittedWeek: number,
  submittedMonth: number,
  submittedYear: number,
  managers: Array<string>
}

// Types for each dataset
export interface Province {
  code: number;
  value: string;
}

export interface DocType {
  id: number;
  value: string;
}

export interface HSCode {
  code: string;
  description: string;
}

export interface SROItem {
  id: number;
  description: string;
}

export interface TransactionType {
  id: number;
  description: string;
}

export interface UOM {
  id: number;
  description: string;
}

// Root type for the /all-cached-data API
export interface AllCachedData {
  provinces: Province[];
  doctypes: DocType[];
  hscodes: HSCode[];
  sroitems: SROItem[];
  transaction_types: TransactionType[];
  uoms: UOM[];
}

export type SubmissionStats = {
  initial_review: number;
  final_review: number;
  rejected: number;
  pending: number;
  submitted_today: number;
  submitted_this_week: number;
  submitted_this_month: number;
  submitted_this_year: number;
};

// ─── Subscription / Package models ───────────────────────────────────────────

export interface Package {
  id: string;
  name: string;
  price: number;
  invoices_per_year: number;
  avg_per_month: number;
  description: string;
  features: string[];
  contact_for_more: boolean;
  is_active: boolean;
}

export interface ClientSubscription {
  id: string;
  client_id: string;
  package_id: string;
  package?: Package;
  package_name: string;
  price_paid: number;
  invoices_quota: number;
  invoices_used: number;
  invoices_remaining: number;
  valid_from: string;
  valid_to: string;
  status: 'active' | 'expired' | 'superseded';
  upgrade_history: any[];
  created_at: string;
}

export interface ClinkPayment {
  id: string;
  client_id: string;
  package_id: string;
  package_name?: string;
  amount: number;
  clink_id: string;
  one_bill_consumer_no: string;
  biller_no: string;
  due_date: string;
  status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  is_upgrade?: boolean;
  created_at: string;
}
