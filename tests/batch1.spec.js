import { test, expect } from '@playwright/test'

test.describe('BATCH 1 — Bug critici', () => {

  test('1. Cookie banner appears on first visit', async ({ page, context }) => {
    // Clear cookies to simulate first visit
    await context.clearCookies()
    await page.goto('/')
    // Cookie banner should be visible
    const banner = page.locator('[class*="CookieConsent"], [id*="cookie"]').first()
    // react-cookie-consent uses a specific wrapper
    const bannerText = page.getByText('Questo sito utilizza cookie')
    await expect(bannerText).toBeVisible({ timeout: 5000 })
    // "Accetta tutti" button should be present
    await expect(page.getByText('Accetta tutti')).toBeVisible()
    await expect(page.getByText('Solo necessari')).toBeVisible()
  })

  test('5. LanguageSwitcher changes language', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(1000)
    // Find the language button (flag icon)
    const langButton = page.locator('button[aria-label="Cambia lingua"]')
    await expect(langButton).toBeVisible()
    await langButton.click()
    // Dropdown should appear
    const englishOption = page.getByText('English')
    await expect(englishOption).toBeVisible()
    // Click English
    await englishOption.click()
    // Verify page responds (wait for any change to happen)
    await page.waitForTimeout(500)
    // Language should have changed — check localStorage
    const lang = await page.evaluate(() => localStorage.getItem('chiamamibi_lang'))
    expect(lang).toBe('en')
  })

  test('6. /profile redirects to /login when not logged in', async ({ page }) => {
    await page.goto('/profile')
    await page.waitForURL('**/login**', { timeout: 5000 })
    expect(page.url()).toContain('/login')
  })

  test('7. /admin redirects to /admin/login when not logged in', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL('**/admin/login**', { timeout: 5000 })
    expect(page.url()).toContain('/admin/login')
  })

  test('9. Discount badge has no flag emoji', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)
    // Check if any discount badge exists and doesn't contain flag
    const badges = page.locator('[class*="bg-accent"] >> text=/Sconto|Deal|Offre|Oferta|Angebot/')
    const count = await badges.count()
    if (count > 0) {
      const text = await badges.first().textContent()
      // Should NOT contain flag emojis
      expect(text).not.toMatch(/🇪🇸|🇮🇹|🇬🇧|🇫🇷|🇩🇪/)
    }
  })

  test('10. Partner page shows all 3 steps', async ({ page }) => {
    await page.goto('/partner')
    await page.waitForTimeout(1000)
    // Check that all 3 steps are visible
    await expect(page.getByText('Candidati')).toBeVisible()
    await expect(page.getByText('Ti contattiamo')).toBeVisible()
    await expect(page.getByText('Sei online')).toBeVisible()
  })

  test('Verify page shows manual code input when no code param', async ({ page }) => {
    await page.goto('/verify')
    await page.waitForTimeout(1000)
    await expect(page.getByPlaceholder('Es. BiSc-abc123')).toBeVisible()
    await expect(page.getByText('Inserisci il codice sconto')).toBeVisible()
  })

  test('Privacy and Terms pages load', async ({ page }) => {
    await page.goto('/privacy')
    await page.waitForTimeout(1000)
    await expect(page.getByText('Privacy Policy')).toBeVisible()

    await page.goto('/terms')
    await page.waitForTimeout(1000)
    await expect(page.getByText('Termini di Servizio')).toBeVisible()
  })
})
