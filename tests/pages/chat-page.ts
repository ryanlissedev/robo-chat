import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for RoboRail Assistant Chat Interface
 * Based on chat-sdk.dev testing patterns
 */
export class ChatPage {
  private page: Page;

  // Selectors for chat elements
  private chatContainer = '[data-testid="chat-container"]';
  private messageInput = '[data-testid="message-input"]';
  private sendButton = '[data-testid="send-button"]';
  private stopButton = '[data-testid="stop-button"]';
  private messagesArea = '[data-testid="messages-area"]';
  private userMessage = '[data-testid="user-message"]';
  private assistantMessage = '[data-testid="assistant-message"]';
  private loadingIndicator = '[data-testid="loading-indicator"]';
  private connectionStatus = '[data-testid="connection-status"]';
  private resumeButton = '[data-testid="resume-button"]';
  private themeSelector = '[data-testid="theme-selector"]';
  private dayNightSwitch = '[data-testid="day-night-switch"]';
  private errorAlert = '[data-testid="error-alert"]';

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to the chat page
   */
  async goto(chatId?: string) {
    const url = chatId ? `/c/${chatId}` : '/';
    await this.page.goto(url);
    await this.waitForChatToLoad();
  }

  /**
   * Wait for chat interface to be fully loaded
   */
  async waitForChatToLoad() {
    await this.page.waitForSelector(this.chatContainer);
    await this.page.waitForSelector(this.messageInput);
  }

  /**
   * Send a user message and wait for response
   */
  async sendUserMessage(message: string) {
    await this.page.fill(this.messageInput, message);
    await this.page.click(this.sendButton);
    await this.waitForMessageToAppear('user', message);
  }

  /**
   * Wait for a specific message to appear
   */
  async waitForMessageToAppear(role: 'user' | 'assistant', content?: string) {
    const selector = role === 'user' ? this.userMessage : this.assistantMessage;
    const messageLocator = this.page.locator(selector);
    
    if (content) {
      await this.page.waitForFunction(
        ({ selector, content }) => {
          const elements = document.querySelectorAll(selector);
          return Array.from(elements).some(el => 
            el.textContent?.includes(content)
          );
        },
        { selector, content },
        { timeout: 30000 }
      );
    } else {
      await messageLocator.first().waitFor({ timeout: 30000 });
    }
  }

  /**
   * Wait for generation to complete
   */
  async isGenerationComplete(): Promise<boolean> {
    // Wait for loading indicator to disappear
    try {
      await this.page.waitForSelector(this.loadingIndicator, { 
        state: 'hidden', 
        timeout: 60000 
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the most recent assistant message
   */
  async getRecentAssistantMessage(): Promise<{ content: string; element: Locator }> {
    const messages = this.page.locator(this.assistantMessage);
    const lastMessage = messages.last();
    await lastMessage.waitFor();
    
    const content = await lastMessage.textContent() || '';
    return { content, element: lastMessage };
  }

  /**
   * Get the most recent user message
   */
  async getRecentUserMessage(): Promise<{ content: string; element: Locator }> {
    const messages = this.page.locator(this.userMessage);
    const lastMessage = messages.last();
    await lastMessage.waitFor();
    
    const content = await lastMessage.textContent() || '';
    return { content, element: lastMessage };
  }

  /**
   * Get all messages in the chat
   */
  async getAllMessages(): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    const messages = [];
    
    // Get all user messages
    const userMessages = this.page.locator(this.userMessage);
    const userCount = await userMessages.count();
    for (let i = 0; i < userCount; i++) {
      const content = await userMessages.nth(i).textContent() || '';
      messages.push({ role: 'user' as const, content });
    }
    
    // Get all assistant messages
    const assistantMessages = this.page.locator(this.assistantMessage);
    const assistantCount = await assistantMessages.count();
    for (let i = 0; i < assistantCount; i++) {
      const content = await assistantMessages.nth(i).textContent() || '';
      messages.push({ role: 'assistant' as const, content });
    }
    
    return messages.sort((a, b) => {
      // Sort by DOM order (approximate)
      return 0;
    });
  }

  /**
   * Stop generation if in progress
   */
  async stopGeneration() {
    const stopBtn = this.page.locator(this.stopButton);
    if (await stopBtn.isVisible()) {
      await stopBtn.click();
    }
  }

  /**
   * Check if chat is currently loading/generating
   */
  async isLoading(): Promise<boolean> {
    return await this.page.locator(this.loadingIndicator).isVisible();
  }

  /**
   * Resume interrupted stream
   */
  async resumeStream() {
    await this.page.click(this.resumeButton);
    await this.page.waitForSelector(this.resumeButton, { state: 'hidden' });
  }

  /**
   * Check connection status
   */
  async getConnectionStatus(): Promise<string> {
    const status = this.page.locator(this.connectionStatus);
    return await status.textContent() || 'unknown';
  }

  /**
   * Switch between themes
   */
  async selectTheme(theme: 'hgg-professional' | 'technical-industrial' | 'modern-minimalist') {
    await this.page.goto('/themes');
    await this.page.click(`[data-testid="theme-${theme}"]`);
    await this.page.waitForTimeout(500); // Allow theme to apply
  }

  /**
   * Toggle dark mode using day/night switch
   */
  async toggleDarkMode() {
    await this.page.click(this.dayNightSwitch);
    await this.page.waitForTimeout(700); // Wait for animation
  }

  /**
   * Check if dark mode is active
   */
  async isDarkMode(): Promise<boolean> {
    const html = this.page.locator('html');
    const className = await html.getAttribute('class');
    return className?.includes('dark') || false;
  }

  /**
   * Simulate network offline/online
   */
  async setNetworkOffline() {
    await this.page.context().setOffline(true);
  }

  async setNetworkOnline() {
    await this.page.context().setOffline(false);
  }

  /**
   * Check for error messages
   */
  async hasError(): Promise<boolean> {
    return await this.page.locator(this.errorAlert).isVisible();
  }

  /**
   * Get error message content
   */
  async getErrorMessage(): Promise<string> {
    const errorElement = this.page.locator(this.errorAlert);
    return await errorElement.textContent() || '';
  }

  /**
   * Clear chat history (if supported)
   */
  async clearChat() {
    // Implementation depends on UI - could be a button or menu item
    const clearButton = '[data-testid="clear-chat"]';
    if (await this.page.locator(clearButton).isVisible()) {
      await this.page.click(clearButton);
    }
  }

  /**
   * Take screenshot of chat interface
   */
  async screenshot(name: string) {
    await this.page.screenshot({ 
      path: `tests/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  /**
   * Wait for specific text to appear in any message
   */
  async waitForTextInMessages(text: string, timeout = 30000) {
    await this.page.waitForFunction(
      (searchText) => {
        const messages = document.querySelectorAll('[data-testid*="message"]');
        return Array.from(messages).some(msg => 
          msg.textContent?.includes(searchText)
        );
      },
      text,
      { timeout }
    );
  }

  /**
   * Simulate typing (useful for testing real-time features)
   */
  async typeSlowly(text: string, delay = 100) {
    await this.page.focus(this.messageInput);
    for (const char of text) {
      await this.page.keyboard.type(char);
      await this.page.waitForTimeout(delay);
    }
  }

  /**
   * Test keyboard shortcuts
   */
  async sendWithEnter() {
    await this.page.focus(this.messageInput);
    await this.page.keyboard.press('Enter');
  }

  async newLineWithShiftEnter() {
    await this.page.focus(this.messageInput);
    await this.page.keyboard.press('Shift+Enter');
  }
}