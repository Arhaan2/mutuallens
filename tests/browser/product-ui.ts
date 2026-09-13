import { expect, type Page } from '@playwright/test';

export async function openImportFiles(page: Page) {
  if (!(await page.locator('#import-files').isVisible()))
    await page.locator('details#import > summary').click();
  await expect(page.locator('#import-files')).toBeVisible();
}
export async function openImportDetails(page: Page) {
  await openImportFiles(page);
  if (!(await page.locator('#import-account').isVisible()))
    await page.locator('.optional-import-details > summary').click();
}
export async function openSnapshotOptions(page: Page) {
  if (
    !(await page
      .getByRole('button', { name: 'Save snapshot locally' })
      .isVisible())
  )
    await page.locator('.snapshot-options > summary').click();
}
