import * as migration_20261020_101638_initial_v3 from './20261020_101638_initial_v3';

export const migrations = [
  {
    up: migration_20261020_101638_initial_v3.up,
    down: migration_20261020_101638_initial_v3.down,
    name: '20261020_101638_initial_v3'
  },
];
