import { test, expect } from '@playwright/test'
import * as path from 'path'

test.setTimeout(120000) // 2 minutes for LLM responses

test('Debug AI Assistant Chat', async ({ page }) => {
  // Start server is handled by the script
  
  // Go to the page
  await page.goto('http://localhost:3000')
  
  // Wait for page to load
  await page.waitForLoadState('networkidle')
  
  // Take screenshot of initial state
  await page.screenshot({ path: 'screenshot-initial.png', fullPage: true })
  
  // Check console for errors
  const consoleMessages: string[] = []
  const consoleErrors: string[] = []
  
  page.on('console', msg => {
    const text = msg.text()
    consoleMessages.push(`[${msg.type()}] ${text}`)
    if (msg.type() === 'error') {
      consoleErrors.push(text)
    }
  })
  
  // Look for the AI Assistant
  const aiAssistant = page.getByTestId('ai-assistant')
  await expect(aiAssistant).toBeVisible({ timeout: 10000 })
  
  console.log('AI Assistant found')
  
  // Expand the AI Assistant
  const header = page.getByTestId('ai-assistant-header')
  await header.click()
  await page.waitForTimeout(1000)
  
  // Take screenshot of expanded state
  await page.screenshot({ path: 'screenshot-expanded.png', fullPage: true })
  
  console.log('AI Assistant expanded')
  
  // Try to send a message
  const input = page.getByTestId('ai-assistant-input')
  await expect(input).toBeVisible()
  
  await input.fill('Test message')
  
  const sendButton = page.getByTestId('ai-assistant-send')
  await sendButton.click()
  
  console.log('Message sent, waiting for response...')
  
  // Wait for a response (up to 60 seconds)
  try {
    await page.waitForSelector('[data-testid="ai-message-assistant"]', { timeout: 60000 })
    console.log('Response received!')
    
    // Take screenshot of response
    await page.screenshot({ path: 'screenshot-response.png', fullPage: true })
  } catch (error) {
    console.log('No response after 60 seconds')
    console.log('Console messages:', consoleMessages)
    console.log('Console errors:', consoleErrors)
    
    // Take screenshot of error state
    await page.screenshot({ path: 'screenshot-error.png', fullPage: true })
    
    throw error
  }
  
  // Log console output
  console.log('\n=== Console Messages ===')
  consoleMessages.forEach(msg => console.log(msg))
  
  if (consoleErrors.length > 0) {
    console.log('\n=== Console Errors ===')
    consoleErrors.forEach(err => console.log(err))
  }
})
