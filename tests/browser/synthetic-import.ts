import { expect, type Page } from '@playwright/test';
import { createSampleDataset as createSyntheticDataset } from '../../packages/core/src/sample';
import { openImportFiles } from './product-ui';

export function syntheticDatasetFile() {
  return {
    name: 'synthetic-test-dataset.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(createSyntheticDataset())),
  };
}

/** Test-only data enters through the same native-file importer used by customers. */
export async function selectSyntheticDataset(page: Page) {
  await openImportFiles(page);
  await page.locator('#import-files').setInputFiles(syntheticDatasetFile());
}

export async function importSyntheticDataset(page: Page) {
  await selectSyntheticDataset(page);
  await expect(page.locator('.import-form button[type=submit]')).toBeEnabled();
  await expect(page.locator('#results-title')).toBeVisible();
}
