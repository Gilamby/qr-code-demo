/* Gedeelde types */

export interface User {
  id: string;
  email: string;
  name: string;
  background: string;
  customBackground: string | null;
  createdAt: string;
  /** Beheer: 'admin' (gezet door de super-admin) of null. SUPPORT_EMAIL / ADMIN_EMAILS zijn altijd admin. */
  role?: string | null;
  /** Uitgezet door het team: kan niet inloggen (de QR-codes blijven werken) */
  disabledAt?: string | null;
  lastLoginAt?: string | null;
  /** Profielfoto (kleine JPG/PNG/WebP als data-URL, ± 256 px) */
  avatar?: string | null;
  /** Tijdzone voor datums, bv. 'Europe/Amsterdam' (leeg = die van de browser) */
  timezone?: string | null;
  verified?: boolean;
  /** Gezet als de sessie net is verlengd: dan moet het cookie ook ververst worden. */
  renewUntil?: string;
}

export interface QrCode {
  id: string;
  userId: string;
  typeId: string;
  contentType: string;
  content: Record<string, any>;
  design: Record<string, any>;
  name?: string;
  paused: boolean;
  scans: number;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt?: string;
  /** Alleen bij listWithStats: { dag: { "os|land|stad": [scans, uniek] } } */
  stats?: Record<string, Record<string, [number, number]>>;
}

/** Factuurgegevens (Mijn account > Facturatie) */
export interface Billing {
  type: 'company' | 'private';
  companyName: string;
  taxId: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  country: string;
}

export interface StoredFile {
  id: string;
  code_id: string | null;
  user_id: string;
  name: string;
  mime: string;
  size: number;
  created_at: string;
  path: string;
}

/** Wat elk databasestuurprogramma (SQLite, PostgreSQL) moet kunnen. SQL gebruikt ? als plaatshouder. */
export interface SqlDriver {
  kind: 'sqlite' | 'postgres';
  label: string;
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = any>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  /** Alles of niets (één transactie) */
  batch(list: [string, unknown[]][]): Promise<{ changes: number }[]>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
  backup: ((to: string) => Promise<unknown>) | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Ingelogde gebruiker (of null), gezet door de sessie-middleware */
      user?: User | null;
      /** Ruwe sessiecode uit het cookie */
      sid?: string;
    }
  }
}
