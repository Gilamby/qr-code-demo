/* Gedeelde types */

export interface User {
  id: string;
  email: string;
  name: string;
  background: string;
  customBackground: string | null;
  createdAt: string;
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
