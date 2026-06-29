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
