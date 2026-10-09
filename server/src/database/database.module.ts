/* Database-module: kiest bij het opstarten PostgreSQL (DATABASE_URL) of SQLite, en maakt de tabellen aan.
   Global: elke andere module kan DatabaseService gebruiken zonder hem te importeren. */
import { Global, Module } from '@nestjs/common';
import { DatabaseService, SQL_DRIVER, SQLITE_FILE, sealOldRows } from './database.service';
import { openSqlite } from './sqlite.driver';
import { openPostgres } from './postgres.driver';

@Global()
@Module({
  providers: [
    {
      provide: SQL_DRIVER,
      useFactory: async () => {
        const driver = process.env.DATABASE_URL ? await openPostgres(process.env.DATABASE_URL) : openSqlite(SQLITE_FILE);
        await sealOldRows(driver);
        return driver;
      },
    },
    DatabaseService,
  ],
  exports: [DatabaseService],
})
export class DatabaseModule {}
