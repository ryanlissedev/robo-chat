import { Page, Locator, expect } from '@playwright/test';

export interface MessageData {
  role: 'user' | 'assistant';
  content: string;
}

export class ChatPage {
  public pageInstance: Page;

  constructor(page: Page) {
    this.pageInstance = page;
  }

  async goto(chatId?: string) {
    const url = chatId ? `/${chatId}` : '/';
    await this.pageInstance.goto(url);
    await this.pageInstance.waitForLoadState('networkidle');
  }

  async sendUserMessage(message: string) {
    const messageInput = this.pageInstance.locator('[data-testid="message-input"]');
    const sendButton = this.pageInstance.locator('[data-testid="send-button"]');
    
    await messageInput.fill(message);
    await sendButton.click();
  }

  async sendWithEnter() {
    const messageInput = this.pageInstance.locator('[data-testid="message-input"]');
    await messageInput.press('Enter');
  }

  async newLineWithShiftEnter() {
    const messageInput = this.pageInstance.locator('[data-testid="message-input"]');
    await messageInput.press('Shift+Enter');
  }

  async waitForMessageToAppear(role: 'user' | 'assistant', content: string) {
    const messageSelector = `[data-testid="${role}-message"]`;
    const messageLocator = this.pageInstance.locator(messageSelector).filter({ hasText: content });
    await expect(messageLocator).toBeVisible();
  }

  async isGenerationComplete(): Promise<void> {
    // Wait for loading indicator to disappear
    const loadingIndicator = this.pageInstance.locator('[data-testid="loading-indicator"]');
    await expect(loadingIndicator).not.toBeVisible({ timeout: 30000 });
    
    // Wait for stop button to disappear (if it was visible)
    const stopButton = this.pageInstance.locator('[data-testid="stop-button"]');
    await expect(stopButton).not.toBeVisible().catch(() => {
      // Stop button might not have been visible, that's fine
    });
  }

  async getRecentAssistantMessage(): Promise<MessageData> {
    const assistantMessages = this.pageInstance.locator('[data-testid="assistant-message"]');
    const lastMessage = assistantMessages.last();
    await expect(lastMessage).toBeVisible();
    
    const content = await lastMessage.textContent() || '';
    return {
      role: 'assistant',
      content: content.trim()
    };
  }

  async getAllMessages(): Promise<MessageData[]> {
    const messages: MessageData[] = [];
    
    // Get user messages
    const userMessages = this.pageInstance.locator('[data-testid="user-message"]');
    const userCount = await userMessages.count();
    
    for (let i = 0; i < userCount; i++) {
      const content = await userMessages.nth(i).textContent() || '';
      messages.push({ role: 'user', content: content.trim() });
    }
    
    // Get assistant messages
    const assistantMessages = this.pageInstance.locator('[data-testid="assistant-message"]');
    const assistantCount = await assistantMessages.count();
    
    for (let i = 0; i < assistantCount; i++) {
      const content = await assistantMessages.nth(i).textContent() || '';
      messages.push({ role: 'assistant', content: content.trim() });
    }
    
    // Sort by DOM order (approximate)
    return messages;
  }

  async hasError(): Promise<boolean> {
    const errorMessage = this.pageInstance.locator('[data-testid="error-message"]');
    try {
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async setNetworkOffline() {
    await this.pageInstance.context().setOffline(true);
  }

  async setNetworkOnline() {
    await this.pageInstance.context().setOffline(false);
  }

  async getConnectionStatus(): Promise<string> {
    const statusIndicator = this.pageInstance.locator('[data-testid="connection-status"]');
    return await statusIndicator.textContent() || '';
  }

  async resumeStream() {
    const resumeButton = this.pageInstance.locator('[data-testid="resume-button"]');
    await resumeButton.click();
  }

  async selectTheme(themeName: string) {
    const themeSelector = this.pageInstance.locator('[data-testid="theme-selector"]');
    await themeSelector.click();
    
    const themeOption = this.pageInstance.locator(`[data-testid="theme-option-${themeName}"]`);
    await themeOption.click();
  }

  async isDarkMode(): Promise<boolean> {
    const htmlElement = this.pageInstance.locator('html');
    const classList = await htmlElement.getAttribute('class') || '';
    return classList.includes('dark');
  }

  async toggleDarkMode() {
    const darkModeToggle = this.pageInstance.locator('[data-testid="dark-mode-toggle"]');
    await darkModeToggle.click();
  }
}
