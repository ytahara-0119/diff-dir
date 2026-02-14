import { _electron as electron, test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tempRoots: string[] = [];

test.skip(
  !process.env.RUN_E2E,
  'Set RUN_E2E=1 to execute Electron E2E tests.'
);

test.afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

test('compare and open text diff', async () => {
  const fixture = await createFixturePair({
    leftFiles: {
      'same.txt': 'same\n',
      'changed.txt': 'left\n'
    },
    rightFiles: {
      'same.txt': 'same\n',
      'changed.txt': 'right\n'
    }
  });

  const { app, page } = await launchApp();

  await runCompare(page, fixture.leftRoot, fixture.rightRoot);
  await expect(page.getByText('showing 2 / 2')).toBeVisible();
  await page.getByRole('row', { name: /different text changed\.txt/i }).click();
  await expect(page.getByText('File Diff: changed.txt')).toBeVisible();
  await expect(page.getByText('removed')).toBeVisible();
  await expect(page.getByText('added')).toBeVisible();

  await app.close();
});

test('shows binary and too_large messages', async () => {
  const big = 'x'.repeat(1024 * 1024 + 10);
  const fixture = await createFixturePair({
    leftFiles: {
      'image.png': 'fake-png',
      'large.txt': big
    },
    rightFiles: {
      'image.png': 'fake-png-2',
      'large.txt': `${big}y`
    }
  });

  const { app, page } = await launchApp();
  await runCompare(page, fixture.leftRoot, fixture.rightRoot);

  await page.getByRole('row', { name: /different binary image\.png/i }).click();
  await expect(page.getByText('Binary file diff is not supported in MVP.')).toBeVisible();

  await page.getByRole('row', { name: /different too_large large\.txt/i }).click();
  await expect(page.getByText(/File is too large for text diff in MVP/)).toBeVisible();

  await app.close();
});

test('shows compare error panel for invalid path', async () => {
  const fixture = await createFixturePair({
    leftFiles: { 'ok.txt': 'ok' },
    rightFiles: { 'ok.txt': 'ok' }
  });

  const { app, page } = await launchApp();
  await page.getByLabel('Left Path (manual)').fill('/path/does/not/exist');
  await page.getByLabel('Right Path (manual)').fill(fixture.rightRoot);
  await page.getByRole('button', { name: 'Start Compare' }).click();

  await expect(page.getByText('Compare Failed')).toBeVisible();
  await expect(page.getByText(/source: compare/)).toBeVisible();

  await app.close();
});

async function launchApp() {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

async function runCompare(page: Page, leftPath: string, rightPath: string) {
  await page.getByLabel('Left Path (manual)').fill(leftPath);
  await page.getByLabel('Right Path (manual)').fill(rightPath);
  await page.getByRole('button', { name: 'Start Compare' }).click();
  await expect(page.getByText(/showing \d+ \/ \d+/)).toBeVisible();
}

async function createFixturePair(input: {
  leftFiles: Record<string, string>;
  rightFiles: Record<string, string>;
}): Promise<{ leftRoot: string; rightRoot: string }> {
  const base = await mkdtemp(path.join(os.tmpdir(), 'diff-dir-e2e-'));
  tempRoots.push(base);
  const leftRoot = path.join(base, 'left');
  const rightRoot = path.join(base, 'right');
  await mkdir(leftRoot, { recursive: true });
  await mkdir(rightRoot, { recursive: true });

  await writeFiles(leftRoot, input.leftFiles);
  await writeFiles(rightRoot, input.rightFiles);

  return { leftRoot, rightRoot };
}

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const filePath = path.join(root, relativePath);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, content);
    })
  );
}
