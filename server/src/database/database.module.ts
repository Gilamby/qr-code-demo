/* Database-module: kiest bij het opstarten de database op basis van DATABASE_URL:
     mongodb://… of mongodb+srv://…  → MongoDB
     postgres://… of postgresql://…  → PostgreSQL
     (leeg)                          → SQLite-bestand in DATA_DIR
   Maakt tabellen/collections en indexen aan en versleutelt oude gevoelige velden.
   Global: elke andere module kan DatabaseService gebruiken zonder hem te importeren. */
import { Global, Module } from '@nestjs/common';
import { DatabaseService, SQLITE_FILE } from './database.service';

export type DbChoice = 'mongodb' | 'postgres' | 'sqlite';
export function dbChoice(url = process.env.DATABASE_URL || ''): DbChoice {
  if (/^mongodb(\+srv)?:\/\//i.test(url)) return 'mongodb';
  if (/^postgres(ql)?:\/\//i.test(url)) return 'postgres';
  if (url) throw new Error('DATABASE_URL moet beginnen met mongodb://, mongodb+srv:// of postgres:// (of leeg zijn voor SQLite).');
  return 'sqlite';
}

/** Database openen (ook gebruikt door de scripts) */
export async function openDatabase(url = process.env.DATABASE_URL || ''): Promise<DatabaseService> {
  const kind = dbChoice(url);
  let db: DatabaseService;
  if (kind === 'mongodb') {
    const { MongoDatabase } = await import('./mongo.database');            // alleen laden als het nodig is
    db = await MongoDatabase.open(url);
  } else {
    const { SqlDatabase } = await import('./sql.database');
    const driver = kind === 'postgres' ? await (await import('./postgres.driver')).openPostgres(url) : (await import('./sqlite.driver')).openSqlite(SQLITE_FILE);
    db = new SqlDatabase(driver);
  }
  await db.sealOldRows();
  return db;
}

@Global()
@Module({
  providers: [{ provide: DatabaseService, useFactory: () => openDatabase() }],
  exports: [DatabaseService],
})
export class DatabaseModule {}
