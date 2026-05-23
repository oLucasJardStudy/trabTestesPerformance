import { API_URL } from './lib/config.mjs';
import { restartApi, waitForPokemonList } from './lib/docker.mjs';
import {
  formatBytes,
  formatMs,
  printBenchmarkTable,
  summarizeTimings
} from './lib/stats.mjs';

const REQUESTS = 50;

function parseScenario() {
  const arg = process.argv.find((value) => value.startsWith('--scenario='));
  if (arg) return arg.split('=')[1];

  if (process.argv.includes('--legacy')) return 'legacy';
  if (process.argv.includes('--both')) return 'both';

  return 'optimized';
}

async function runSequentialBenchmark(label) {
  const timings = [];
  const payloadSizes = [];
  let errors = 0;

  console.log(`\nExecutando ${REQUESTS} requisições sequenciais (${label})...`);

  for (let i = 1; i <= REQUESTS; i += 1) {
    const startedAt = performance.now();

    try {
      const response = await fetch(`${API_URL}/pokemon`);
      const elapsed = performance.now() - startedAt;
      const body = await response.text();

      timings.push(elapsed);
      payloadSizes.push(Buffer.byteLength(body, 'utf8'));

      if (!response.ok) {
        errors += 1;
      }
    } catch {
      errors += 1;
      timings.push(performance.now() - startedAt);
    }

    process.stdout.write(`\rProgresso: ${i}/${REQUESTS}`);
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
  console.log(`P99         : ${formatMs(result.p99)}`);
  console.log(`Mínimo      : ${formatMs(result.min)}`);
  console.log(`Máximo      : ${formatMs(result.max)}`);
  console.log(`Erros HTTP  : ${result.errors}`);
  console.log(`Payload médio: ${formatBytes(result.avgPayload)}`);
}

async function runScenario(scenario) {
  if (scenario === 'legacy') {
    restartApi({ legacy: true, logging: true });
    await waitForPokemonList(API_URL);
    return runSequentialBenchmark('ANTES (LEGACY_LIST=true)');
  }

  if (scenario === 'optimized') {
    restartApi({ legacy: false, logging: false });
    await waitForPokemonList(API_URL);
    return runSequentialBenchmark('DEPOIS (paginação padrão)');
  }

  restartApi({ legacy: true, logging: true });
  await waitForPokemonList(API_URL);
  const before = await runSequentialBenchmark('ANTES (LEGACY_LIST=true)');

  restartApi({ legacy: false, logging: false });
  await waitForPokemonList(API_URL);
  const after = await runSequentialBenchmark('DEPOIS (paginação padrão)');

  printBenchmarkTable('Benchmark manual — 50 requisições sequenciais', [
    ['Tempo médio', formatMs(before.avg), formatMs(after.avg)],
    ['P95', formatMs(before.p95), formatMs(after.p95)],
    ['Erros HTTP', before.errors, after.errors],
    ['Payload médio', formatBytes(before.avgPayload), formatBytes(after.avgPayload)]
  ]);

  return { before, after };
}

async function main() {
  const scenario = parseScenario();

  console.log('Benchmark manual — GET /pokemon');
  console.log(`API: ${API_URL}`);
  console.log(`Cenário: ${scenario}`);

  const result = await runScenario(scenario);

  if (!result.after) {
    printResult(result);
  }
}

main().catch((error) => {
  console.error('\nErro no benchmark:', error.message);
  process.exit(1);
});
