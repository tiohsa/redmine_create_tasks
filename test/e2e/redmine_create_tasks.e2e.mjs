import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.env.REDMINE_BASE_URL || 'http://127.0.0.1:3000';
const projectIdentifier = process.env.REDMINE_PROJECT_IDENTIFIER || 'e2e-project';
const login = process.env.REDMINE_LOGIN || 'admin';
const password = process.env.REDMINE_PASSWORD || 'admin1234';
const artifactsDir = process.env.E2E_ARTIFACTS_DIR || 'test/e2e/artifacts';

const requiredRoutes = [
  `/projects/${projectIdentifier}/redmine_create_tasks/spa`,
  `/projects/${projectIdentifier}/redmine_create_tasks/data`,
  '/plugin_assets/redmine_create_tasks/stylesheets/spa.css',
  '/plugin_assets/redmine_create_tasks/javascripts/spa.js'
];

const requiredSeen = new Map(requiredRoutes.map((route) => [route, false]));
const failedResponses = [];
const consoleErrors = [];

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const trackResponse = (response) => {
  const url = response.url();
  const status = response.status();

  for (const route of requiredRoutes) {
    if (!url.includes(route)) continue;
    if (status >= 400) {
      failedResponses.push({ url, status });
    } else {
      requiredSeen.set(route, true);
    }
  }
};

const assertNoFailures = () => {
  if (failedResponses.length > 0) {
    const lines = failedResponses.map((res) => `- ${res.status} ${res.url}`).join('\n');
    throw new Error(`Required requests returned HTTP errors:\n${lines}`);
  }

  const missing = [...requiredSeen.entries()]
    .filter(([, seen]) => !seen)
    .map(([route]) => route);

  if (missing.length > 0) {
    throw new Error(`Required requests were not observed:\n${missing.map((r) => `- ${r}`).join('\n')}`);
  }

  if (consoleErrors.length > 0) {
    const lines = consoleErrors.map((msg) => `- ${msg}`).join('\n');
    throw new Error(`Console errors were detected on plugin screen:\n${lines}`);
  }
};

const run = async () => {
  ensureDir(artifactsDir);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  context.on('response', trackResponse);
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#username', login);
    await page.fill('#password', password);
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.click('input[name="login"]')
    ]);

    await page.goto(`${baseUrl}/projects/${projectIdentifier}/redmine_create_tasks`, {
      waitUntil: 'domcontentloaded'
    });

    const frameElement = page.locator('iframe.create-tasks-frame');
    await frameElement.waitFor({ state: 'visible', timeout: 30000 });
    const frame = await frameElement.elementHandle().then((el) => el?.contentFrame());
    if (!frame) {
      throw new Error('Plugin iframe could not be resolved.');
    }

    await page.waitForResponse(
      (res) => res.url().includes(`/projects/${projectIdentifier}/redmine_create_tasks/data`) && res.status() < 400,
      { timeout: 30000 }
    );

    await frame.getByRole('button', { name: 'Register Issues' }).waitFor({ timeout: 30000 });

    assertNoFailures();
  } catch (error) {
    const screenshotPath = path.join(artifactsDir, 'redmine-create-tasks-e2e-failure.png');
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
