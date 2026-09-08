import { test, expect } from '@playwright/test';

const publicOrigin = 'http://localhost:4321';
const checkerOrigin = 'http://localhost:5173';

test('navigation: public destinations, mobile navigation and 404 recovery work across origins', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('404'))
      errors.push(message.text());
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(publicOrigin);
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  for (const label of ['The checker', 'Guides', 'About', 'Open preview'])
    await expect(
      navigation.getByRole('link', { name: label, exact: true }),
    ).toBeVisible();
  const paths = await page
    .locator('a[href]')
    .evaluateAll((links) => [
      ...new Set(
        links
          .map((link) => (link as HTMLAnchorElement).href)
          .filter(
            (url) =>
              url.startsWith('http://localhost:4321/') && !url.includes('#'),
          ),
      ),
    ]);
  for (const destination of paths) {
    await page.goto(publicOrigin);
    const link = page.locator('a[href]').filter({ visible: true });
    const matching = await link.evaluateAll(
      (links, target) =>
        links.findIndex((link) => (link as HTMLAnchorElement).href === target),
      destination,
    );
    expect(matching, destination).toBeGreaterThanOrEqual(0);
    await link.nth(matching).click();
    await expect(page).toHaveURL(destination);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  }
  await page.goto(publicOrigin);
  await page
    .getByRole('link', { name: 'Check automatically', exact: true })
    .click();
  await expect(page).toHaveURL(`${checkerOrigin}/`);
  await expect(
    page.getByRole('button', { name: 'Check automatically', exact: true }),
  ).toBeDisabled();
  await expect(page.locator('#automatic-status')).toContainText(
    'not available',
  );
  await page.goto(publicOrigin);
  await page
    .getByRole('link', { name: 'Import your Instagram export', exact: true })
    .click();
  await expect(page).toHaveURL(`${checkerOrigin}/#import`);
  await expect(page.locator('#import-account')).toBeVisible();
  for (const origin of [publicOrigin, checkerOrigin]) {
    const response = await page.goto(`${origin}/synthetic-missing-route`);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', {
        name:
          origin === publicOrigin ? 'This page isn’t here.' : 'Page not found',
        exact: true,
      }),
    ).toBeVisible();
    const recovery = page
      .locator('main a[href="/"], body > a[href="/"]')
      .first();
    await recovery.click();
    await expect(page).toHaveURL(`${origin}/`);
    await expect(page.locator('h1')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});
