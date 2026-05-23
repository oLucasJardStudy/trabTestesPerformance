import { API_URL } from './lib/config.mjs';
import { restartApi, waitForPokemonList } from './lib/docker.mjs';
import {
  formatBytes,
  formatMs,
  printBenchmarkTable,
  summarizeTimings
} from './lib/stats.mjs';

const TOTAL_REQUESTS = 50;
const CONCURRENCY = 10;

function parseScenario() {
  const arg = process.argv.find((value) => value.startsWith('--scenario='));
  if (arg) return arg.split('=')[1];

  if (process.argv.includes('--legacy')) return 'legacy';
  if (process.argv.includes('--both')) return 'both';

  return 'optimized';
}

async function requestPokemon() {
  const startedAt = performance.now();

  try {
    const response = await fetch(`${API_URL}/pokemon`);
    const body = await response.text();

    return {
      ok: response.ok,
      elapsed: performance.now() - startedAt,
      payloadSize: Buffer.byteLength(body, 'utf8')
    };
  } catch {
    return {
      ok: false,
      elapsed: performance.now() - startedAt,
      payloadSize: 0
    };
  }
}

async function runConcurrentBatch(size) {
  return Promise.all(Array.from({ length: size }, () => requestPokemon()));
}

async function runConcurrentBenchmark(label) {
  const timings = [];
  const payloadSizes = [];
  let errors = 0;
  let completed = 0;

  console.log(
    `\nExecutando ${TOTAL_REQUESTS} requisições concorrentes (${label})...`
  );
  console.log(`Concorrência: ${CONCURRENCY}`);

  while (completed < TOTAL_REQUESTS) {
    const batchSize = Math.min(CONCURRENCY, TOTAL_REQUESTS - completed);
    const batch = await runConcurrentBatch(batchSize);

    for (const result of batch) {
      timings.push(result.elapsed);
      payloadSizes.push(result.payloadSize);
      if (!result.ok) errors += 1;
      completed += 1;
    }

    process.stdout.write(`\rProgresso: ${completed}/${TOTAL_REQUESTS}`);
  }

  console.log('');

  const stats = summarizeTimings(timings);
  const avgPayload =
    payloadSizes.reduce((acc, size) => acc + size, 0) /
    (payloadSizes.length || 1);

  return {
    label,
    ...stats,
    errors,
    avgPayload
  };
}

function printResult(result) {
  console.log(`\nResultado — ${result.label}`);
  console.log(`Tempo médio : ${formatMs(result.avg)}`);
  console.log(`Mediana P50 : ${formatMs(result.p50)}`);
  console.log(`P95         : ${formatMs(result.p95)}`);
  console.log(`Erros HTTP  : ${result.errors}`);
  console.log(`Payload médio: ${formatBytes(result.avgPayload)}`);
}

async function runScenario(scenario) {
  if (scenario === 'legacy') {
    restartApi({ legacy: true, logging: true });
    await waitForPokemonList(API_URL);
    return runConcurrentBenchmark('ANTES (LEGACY_LIST=true)');
  }

  if (scenario === 'optimized') {
    restartApi({ legacy: false, logging: false });
    await waitForPokemonList(API_URL);
    return runConcurrentBenchmark('DEPOIS (paginação padrão)');
  }

  restartApi({ legacy: true, logging: true });
  await waitForPokemonList(API_URL);
  const before = await runConcurrentBenchmark('ANTES (LEGACY_LIST=true)');

  restartApi({ legacy: false, logging: false });
  await waitForPokemonList(API_URL);
  const after = await runConcurrentBenchmark('DEPOIS (paginação padrão)');

  printBenchmarkTable(
    `Benchmark concorrente — ${TOTAL_REQUESTS} requisições (${CONCURRENCY} simultâneas)`,
    [
      ['Tempo médio', formatMs(before.avg), formatMs(after.avg)],
      ['P95', formatMs(before.p95), formatMs(after.p95)],
      ['Erros HTTP', before.errors, after.errors],
      ['Payload médio', formatBytes(before.avgPayload), formatBytes(after.avgPayload)]
    ]
  );

  return { before, after };
}

async function main() {
  const scenario = parseScenario();

  console.log('Benchmark concorrente — GET /pokemon');
  console.log(`API: ${API_URL}`);
  console.log(`Cenário: ${scenario}`);

  const result = await runScenario(scenario);

  if (!result.after) {
    printResult(result);
  }
}

main().catch((error) => {
  console.error('\nErro no benchmark concorrente:', error.message);
  process.exit(1);
});
