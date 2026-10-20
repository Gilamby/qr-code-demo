import * as migration_20261020_091857_initial_v2 from './20261020_091857_initial_v2';

export const migrations = [
  {
    up: migration_20261020_091857_initial_v2.up,
    down: migration_20261020_091857_initial_v2.down,
    name: '20261020_091857_initial_v2'
  },
];
