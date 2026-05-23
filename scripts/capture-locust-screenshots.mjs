import fs from 'node:fs';
import path from 'node:path';
import { REPORTS_DIR } from './lib/config.mjs';

const DEFAULT_REPORTS = [
  {
    html: path.join(REPORTS_DIR, 'ANTES-locust-report.html'),
    png: path.join(REPORTS_DIR, 'ANTES-locust-print.png')
  },
  {
    html: path.join(REPORTS_DIR, 'DEPOIS-locust-report.html'),
    png: path.join(REPORTS_DIR, 'locust-print.png')
  }
];

async function loadPuppeteer() {
  try {
    const puppeteer = await import('puppeteer');
    return puppeteer.default;
  } catch {
    console.error(
      'Puppeteer não encontrado. Instale com: npm install --save-dev puppeteer'
    );
    process.exit(1);
  }
}

async function captureScreenshot(browser, htmlPath, pngPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const fileUrl = `file:///${htmlPath.replace(/\\/g, '/')}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  await page.screenshot({
    path: pngPath,
    fullPage: true
  });

  await page.close();
}

async function main() {
  const reports = DEFAULT_REPORTS.filter(({ html }) => fs.existsSync(html));

  if (reports.length === 0) {
    console.error('Nenhum relatório HTML encontrado em locust-performance-test/reports/.');
    console.error('Execute primeiro: node scripts/run-locust-comparison.mjs');
    process.exit(1);
  }

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({ headless: true });

  try {
    for (const { html, png } of reports) {
      console.log(`Gerando print: ${path.basename(png)}`);
      await captureScreenshot(browser, html, png);
      console.log(`Salvo em: ${png}`);
    }
  } finally {
    await browser.close();
  }

  console.log('\nCapturas concluídas.');
}

main().catch((error) => {
  console.error('\nErro ao gerar screenshots:', error.message);
  process.exit(1);
});
