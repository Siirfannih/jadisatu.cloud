import { test, expect } from '@playwright/test'

test.describe('Buka — app opens correctly', () => {
  test('root page loads without error', async ({ page }) => {
    const response = await page.goto('/')
    // Should get a successful response (200 for dashboard or redirect to login)
    expect(response?.status()).toBeLessThan(500)
  })

  test('login page renders with correct branding', async ({ page }) => {
    await page.goto('/login')

    // Title text
    await expect(page.getByRole('heading', { name: 'JadiSatu OS' })).toBeVisible()

    // Subtitle
    await expect(page.getByText('Welcome back')).toBeVisible()

    // Google OAuth button
    await expect(page.getByRole('button', { name: /Continue with Google/i })).toBeVisible()

    // Email/password form
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()

    // Sign up toggle
    await expect(page.getByText(/Don't have an account/i)).toBeVisible()

    // Footer branding
    await expect(page.getByText('Powered by JadiSatu Ecosystem')).toBeVisible()
  })

  test('login page can toggle between sign in and sign up', async ({ page }) => {
    await page.goto('/login')

    // Default: sign in mode
    await expect(page.getByText('Welcome back')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible()

    // Toggle to sign up
    await page.getByText(/Don't have an account/i).click()
    await expect(page.getByText('Create your account')).toBeVisible()
    await expect(page.getByRole('button', { name: /Sign Up/i })).toBeVisible()

    // Toggle back to sign in
    await page.getByText(/Already have an account/i).click()
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('login form has proper validation attributes', async ({ page }) => {
    await page.goto('/login')

    // HTML5 required attribute prevents empty submit
    const emailInput = page.getByLabel('Email')
    await expect(emailInput).toHaveAttribute('required', '')
    await expect(emailInput).toHaveAttribute('type', 'email')

    const passwordInput = page.getByLabel('Password')
    await expect(passwordInput).toHaveAttribute('required', '')
    await expect(passwordInput).toHaveAttribute('minlength', '6')
    await expect(passwordInput).toHaveAttribute('type', 'password')
  })

  test('Google OAuth button is not disabled initially', async ({ page }) => {
    await page.goto('/login')

    const googleBtn = page.getByRole('button', { name: /Continue with Google/i })
    await expect(googleBtn).toBeEnabled()
  })
})
