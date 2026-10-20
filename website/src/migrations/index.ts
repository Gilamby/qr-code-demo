import * as migration_20261020_075946_initial from './20261020_075946_initial';

export const migrations = [
  {
    up: migration_20261020_075946_initial.up,
    down: migration_20261020_075946_initial.down,
    name: '20261020_075946_initial'
  },
];
