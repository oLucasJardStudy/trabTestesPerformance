export function percentile(values, p) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

export function summarizeTimings(timingsMs) {
  if (timingsMs.length === 0) {
    return {
      count: 0,
      avg: 0,
      min: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0
    };
  }

  const sum = timingsMs.reduce((acc, value) => acc + value, 0);

  return {
    count: timingsMs.length,
    avg: sum / timingsMs.length,
    min: Math.min(...timingsMs),
    max: Math.max(...timingsMs),
    p50: percentile(timingsMs, 50),
    p95: percentile(timingsMs, 95),
    p99: percentile(timingsMs, 99)
  };
}

export function formatMs(value) {
  return `${value.toFixed(1)} ms`;
}

export function formatBytes(value) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${Math.round(value)} bytes`;
}

export function printBenchmarkTable(title, rows) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));

  const labelWidth = Math.max(...rows.map(([label]) => label.length));

  for (const [label, before, after] of rows) {
    console.log(
      `${label.padEnd(labelWidth)}  ANTES: ${String(before).padStart(12)}  DEPOIS: ${String(after).padStart(12)}`
    );
  }
}
