import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '../..');
export const LOCUST_DIR = path.join(PROJECT_ROOT, 'locust-performance-test');
export const REPORTS_DIR = path.join(LOCUST_DIR, 'reports');

export const API_URL = process.env.API_URL || 'http://127.0.0.1:4444';
export const API_HOST_DOCKER = 'http://node-api:4444';

export const TOTAL_POKEMON = 5505;

export const MYSQL_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3308),
  user: process.env.DB_USER || 'nodeapi_root',
  password: process.env.DB_PASSWORD || 'j5m966qp7jiypfda',
  database: process.env.DB_DATABASE || 'node_api'
};

export const POKEMON_TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy'
];

export const LOCUST_PARAMS = {
  users: 10,
  spawnRate: 2,
  duration: '30s'
};
