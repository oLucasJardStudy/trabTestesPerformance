import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { LOCUST_DIR, PROJECT_ROOT } from './config.mjs';

const USE_WSL = process.platform === 'win32';

const API_ENV = {
  NODE_ENV: 'development',
  SERVER_PORT: '4444',
  DB_DATABASE: 'node_api',
  DB_CONNECTION_STRING:
    'mysql://nodeapi_root:j5m966qp7jiypfda@node-api-mysql:3306/node_api'
};

function toWslPath(winPath) {
  const resolved = path.resolve(winPath);
  const drive = resolved[0].toLowerCase();
  const rest = resolved.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${rest}`;
}

function runShell(command, options = {}) {
  const execOptions = {
    stdio: 'inherit',
    ...options
  };

  if (USE_WSL) {
    execSync(`wsl bash -lc ${JSON.stringify(command)}`, execOptions);
    return;
  }

  execSync(command, {
    ...execOptions,
    shell: true
  });
}

function dockerComposeCmd() {
  if (USE_WSL) return 'docker-compose';

  const probe = spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' });
  return probe.status === 0 ? 'docker compose' : 'docker-compose';
}

function projectPath() {
  return USE_WSL ? toWslPath(PROJECT_ROOT) : PROJECT_ROOT;
}

export function runDockerCompose(args, env = {}) {
  const cwd = projectPath();
  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');

  const cmd = `cd '${cwd}' && ${envPrefix ? `${envPrefix} ` : ''}${dockerComposeCmd()} ${args}`;
  runShell(cmd, USE_WSL ? {} : { cwd: PROJECT_ROOT, env: { ...process.env, ...env } });
}

export function runDocker(args) {
  runShell(`docker ${args}`);
}

export function runLocustHeadless({ prefix, users, spawnRate, duration, host }) {
  const locustDir = USE_WSL ? toWslPath(LOCUST_DIR) : LOCUST_DIR;
  const cmd =
    `docker run --rm --network node-api-connect ` +
    `-v '${locustDir}:/mnt/locust' ` +
    `locustio/locust ` +
    `-f /mnt/locust/locustfile.py ` +
    `--headless ` +
    `-u ${users} ` +
    `-r ${spawnRate} ` +
    `-t ${duration} ` +
    `-H ${host} ` +
    `--html /mnt/locust/reports/${prefix}-locust-report.html ` +
    `--csv /mnt/locust/reports/${prefix}`;

  runShell(cmd);
}

export async function waitForApi(url, attempts = 90, delayMs = 2000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // API ainda não disponível
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`API não respondeu em ${url} após ${attempts} tentativas.`);
}

export async function waitForPokemonList(baseUrl = 'http://localhost:4444') {
  for (let attempt = 1; attempt <= 45; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/pokemon`);
      if (response.ok) {
        const body = await response.text();
        if (body.includes('"items"') || body.includes('"total"')) {
          return true;
        }
      }
    } catch {
      // endpoint ainda indisponível
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error('GET /pokemon não respondeu corretamente após reinício da API.');
}

export function restartApi({ legacy = false, logging = false } = {}) {
  runDocker('rm -f node-api 2>/dev/null || true');
  runDockerCompose('up -d --no-deps node-api', {
    LEGACY_LIST: legacy ? 'true' : 'false',
    DB_LOGGING: logging ? 'true' : 'false'
  });

  // aguarda o container e o MySQL estabilizarem antes dos health checks via HTTP
  runShell('sleep 25', { stdio: 'ignore' });
}

export function recoverAfterLegacyLoad() {
  runDocker('rm -f node-api 2>/dev/null || true');
  runShell('sleep 10', { stdio: 'ignore' });
}

export function startApiStack() {
  runDocker('rm -f node-api 2>/dev/null || true');
  runDockerCompose('up -d');
}

export function ensureLocustNetwork() {
  try {
    runShell('docker network inspect node-api-connect >/dev/null 2>&1', {
      stdio: 'ignore'
    });
  } catch {
    try {
      runDocker('network create node-api-connect');
    } catch {
      // rede já provisionada pelo docker-compose
    }
  }
}
