import fs from 'node:fs';
import path from 'node:path';
import { API_HOST_DOCKER, API_URL, LOCUST_PARAMS, REPORTS_DIR } from './lib/config.mjs';
import {
  ensureLocustNetwork,
  recoverAfterLegacyLoad,
  restartApi,
  runLocustHeadless,
  startApiStack,
  waitForPokemonList
} from './lib/docker.mjs';

function ensureReportsDir() {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

function parseLocustCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf8').trim();
  const lines = content.split('\n');
  const headers = lines[0].split(',').map((header) => header.trim());
  const rowLine =
    lines.find((line) => line.includes('GET /pokemon')) || lines[1];
  const row = rowLine.split(',');

  const data = {};
  headers.forEach((header, index) => {
    data[header] = row[index]?.trim();
  });

  return {
    requests: Number(data['Request Count'] || 0),
    failures: Number(data['Failure Count'] || 0),
    avg: Number(data['Average Response Time'] || 0),
    min: Number(data['Min Response Time'] || 0),
    max: Number(data['Max Response Time'] || 0),
    median: Number(data['Median Response Time'] || 0),
    p95: Number(data['95%'] || 0),
    p99: Number(data['99%'] || 0),
    rps: Number(data['Requests/s'] || 0),
    avgContentSize: Number(data['Average Content Size'] || 0)
  };
}

function runLocustScenario(prefix, label) {
  const htmlReport = path.join(REPORTS_DIR, `${prefix}-locust-report.html`);
  const csvPrefix = path.join(REPORTS_DIR, prefix);

  console.log(`\nLocust — ${label}`);
  console.log(`Usuários: ${LOCUST_PARAMS.users} | Spawn: ${LOCUST_PARAMS.spawnRate}/s | Duração: ${LOCUST_PARAMS.duration}`);

  runLocustHeadless({
    prefix,
    users: LOCUST_PARAMS.users,
    spawnRate: LOCUST_PARAMS.spawnRate,
    duration: LOCUST_PARAMS.duration,
    host: API_HOST_DOCKER
  });

  const stats = parseLocustCsv(`${csvPrefix}_stats.csv`);

  return { htmlReport, stats, prefix };
}

function printComparison(before, after) {
  const rows = [
    ['Requisições totais', before.requests, after.requests],
    ['Falhas', before.failures, after.failures],
    ['Tempo médio', `${before.avg.toFixed(2)} ms`, `${after.avg.toFixed(2)} ms`],
    ['Mediana (P50)', `${before.median.toFixed(0)} ms`, `${after.median.toFixed(0)} ms`],
    ['P95', `${before.p95.toFixed(0)} ms`, `${after.p95.toFixed(0)} ms`],
    ['P99', `${before.p99.toFixed(0)} ms`, `${after.p99.toFixed(0)} ms`],
    ['Tempo máximo', `${before.max.toFixed(0)} ms`, `${after.max.toFixed(0)} ms`],
    ['Requisições/segundo', before.rps.toFixed(2), after.rps.toFixed(2)],
    [
      'Payload médio',
      `${Math.round(before.avgContentSize)} bytes`,
      `${Math.round(after.avgContentSize)} bytes`
    ]
  ];

  console.log('\nComparativo Locust — ANTES vs DEPOIS');
  console.log('='.repeat(72));

  for (const [metric, antes, depois] of rows) {
    console.log(
      `${metric.padEnd(22)} ANTES: ${String(antes).padStart(12)}  DEPOIS: ${String(depois).padStart(12)}`
    );
  }

  if (before.avg > 0) {
    const improvement = ((before.avg - after.avg) / before.avg) * 100;
    console.log(`\nMelhoria no tempo médio: ~${improvement.toFixed(0)}%`);
  }
}

function parseOnlyFlag() {
  const arg = process.argv.find((value) => value.startsWith('--only='));
  return arg ? arg.split('=')[1] : 'both';
}

async function warmupApi() {
  console.log('Aquecendo API (5 requisições)...');
  for (let i = 0; i < 5; i += 1) {
    await fetch(`${API_URL}/pokemon`);
  }
}

async function main() {
  const only = parseOnlyFlag();

  console.log('Teste comparativo Locust — GET /pokemon');
  console.log('Cenário ANTES : LEGACY_LIST=true + DB_LOGGING=true');
  console.log('Cenário DEPOIS: paginação padrão + logging desligado');

  ensureReportsDir();
  ensureLocustNetwork();

  let beforeRun = null;

  if (only !== 'depois') {
    startApiStack();
    await waitForPokemonList(API_URL);

    console.log('\n[1/2] Reiniciando API no modo LEGACY...');
    restartApi({ legacy: true, logging: true });
    await waitForPokemonList(API_URL);
    await warmupApi();

    beforeRun = runLocustScenario('ANTES', 'ANTES da otimização');
    console.log('\nEncerrando API legacy e aguardando estabilização...');
    recoverAfterLegacyLoad();
  } else {
    const antesCsv = path.join(REPORTS_DIR, 'ANTES_stats.csv');
    if (!fs.existsSync(antesCsv)) {
      throw new Error(
        'Relatório ANTES_stats.csv não encontrado. Execute o teste completo ou remova --only=depois.'
      );
    }

    beforeRun = {
      htmlReport: path.join(REPORTS_DIR, 'ANTES-locust-report.html'),
      stats: parseLocustCsv(antesCsv),
      prefix: 'ANTES'
    };
    console.log('\n[1/2] Pulado — usando relatório ANTES existente.');
  }

  console.log('\n[2/2] Reiniciando API no modo otimizado...');
  restartApi({ legacy: false, logging: false });
  await waitForPokemonList(API_URL);
  await warmupApi();

  const afterRun = runLocustScenario('DEPOIS', 'DEPOIS da otimização');

  printComparison(beforeRun.stats, afterRun.stats);

  console.log('\nRelatórios gerados:');
  if (beforeRun.htmlReport) {
    console.log(`- ${beforeRun.htmlReport}`);
  }
  console.log(`- ${afterRun.htmlReport}`);
  console.log('\nPara gerar os prints PNG:');
  console.log('node scripts/capture-locust-screenshots.mjs');
}

main().catch((error) => {
  console.error('\nErro no teste comparativo:', error.message);
  process.exit(1);
});
