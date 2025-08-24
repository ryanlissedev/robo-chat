import { PersonalityMode, PersonalityConfig, VoicePersonalitySettings, PersonalityMetrics, PersonalityTransition, PersonalityEvent, PersonalityEventType } from './personality-types';
import { PERSONALITY_CONFIGS, DEFAULT_PERSONALITY_SETTINGS, getPersonalityConfig, getVoiceInstructions } from './personality-configs';

export class PersonalityManager {
  private settings: VoicePersonalitySettings;
  private metrics: Map<PersonalityMode, PersonalityMetrics> = new Map();
  private transitions: PersonalityTransition[] = [];
  private events: PersonalityEvent[] = [];
  private eventListeners: Map<PersonalityEventType, ((event: PersonalityEvent) => void)[]> = new Map();

  constructor(initialSettings?: Partial<VoicePersonalitySettings>) {
    this.settings = {
      ...DEFAULT_PERSONALITY_SETTINGS,
      ...initialSettings,
    };

    // Initialize metrics for all personality modes
    Object.keys(PERSONALITY_CONFIGS).forEach(mode => {
      this.metrics.set(mode as PersonalityMode, {
        mode: mode as PersonalityMode,
        sessionsUsed: 0,
        averageSessionDuration: 0,
        safetyIncidentsReported: 0,
        userSatisfactionRating: 0,
        mostCommonQuestions: [],
        effectivenessScore: 0,
      });
    });
  }

  // Core personality management
  getCurrentPersonality(): PersonalityConfig {
    return getPersonalityConfig(this.settings.currentMode);
  }

  switchPersonality(newMode: PersonalityMode, reason: string = 'User selection'): boolean {
    const oldMode = this.settings.currentMode;
    
    if (oldMode === newMode) {
      return false;
    }

    // Record transition
    const transition: PersonalityTransition = {
      fromMode: oldMode,
      toMode: newMode,
      reason,
      timestamp: Date.now(),
    };
    
    this.transitions.push(transition);
    this.settings.currentMode = newMode;

    // Emit personality change event
    this.emitEvent({
      type: 'mode_changed',
      mode: newMode,
      timestamp: Date.now(),
      details: { fromMode: oldMode, reason },
      severity: 'low',
      resolved: true,
    });

    return true;
  }

  getSettings(): VoicePersonalitySettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<VoicePersonalitySettings>): void {
    this.settings = { ...this.settings, ...updates };
  }

  // Voice instructions generation
  generateVoiceInstructions(customContext?: string): string {
    const baseInstructions = getVoiceInstructions(
      this.settings.currentMode,
      this.settings.customInstructions,
      this.settings.safetyProtocolsEnabled
    );

    if (customContext) {
      return `${baseInstructions}\n\nCONTEXT:\n${customContext}`;
    }

    return baseInstructions;
  }

  // Safety protocol management
  triggerSafetyProtocol(protocolName: string, severity: 'low' | 'medium' | 'high' | 'critical', details: Record<string, unknown>): void {
    const currentPersonality = this.getCurrentPersonality();
    
    this.emitEvent({
      type: 'safety_protocol_triggered',
      mode: this.settings.currentMode,
      timestamp: Date.now(),
      details: { protocolName, ...details },
      severity,
      resolved: false,
    });

    // Update safety metrics
    const metrics = this.metrics.get(this.settings.currentMode);
    if (metrics) {
      metrics.safetyIncidentsReported += 1;
      this.metrics.set(this.settings.currentMode, metrics);
    }

    console.warn(`Safety protocol triggered: ${protocolName}`, {
      personality: currentPersonality.name,
      severity,
      details,
    });
  }

  requestConfirmation(action: string, riskLevel: 'low' | 'medium' | 'high'): Promise<boolean> {
    const currentPersonality = this.getCurrentPersonality();
    
    this.emitEvent({
      type: 'confirmation_requested',
      mode: this.settings.currentMode,
      timestamp: Date.now(),
      details: { action, riskLevel },
      severity: riskLevel === 'high' ? 'high' : 'medium',
      resolved: false,
    });

    return new Promise((resolve) => {
      // This would typically integrate with a UI confirmation dialog
      console.log(`Confirmation required for: ${action} (Risk: ${riskLevel})`);
      console.log(`Personality: ${currentPersonality.name} requires confirmation`);
      
      // For now, return based on personality settings and risk level
      const requiresConfirmation = currentPersonality.features.requiresConfirmation;
      const shouldConfirm = requiresConfirmation && (riskLevel === 'medium' || riskLevel === 'high');
      
      setTimeout(() => resolve(!shouldConfirm), 100); // Auto-resolve for demo
    });
  }

  // Metrics and analytics
  recordSessionStart(): void {
    const metrics = this.metrics.get(this.settings.currentMode);
    if (metrics) {
      metrics.sessionsUsed += 1;
      this.metrics.set(this.settings.currentMode, metrics);
    }
  }

  recordSessionEnd(duration: number, userRating?: number): void {
    const metrics = this.metrics.get(this.settings.currentMode);
    if (metrics) {
      // Update average session duration
      const totalSessions = metrics.sessionsUsed;
      const currentAverage = metrics.averageSessionDuration;
      metrics.averageSessionDuration = ((currentAverage * (totalSessions - 1)) + duration) / totalSessions;

      // Update user satisfaction rating
      if (userRating !== undefined) {
        metrics.userSatisfactionRating = ((metrics.userSatisfactionRating * (totalSessions - 1)) + userRating) / totalSessions;
      }

      this.metrics.set(this.settings.currentMode, metrics);
    }
  }

  recordQuestion(question: string): void {
    const metrics = this.metrics.get(this.settings.currentMode);
    if (metrics) {
      const existing = metrics.mostCommonQuestions.find(q => q === question);
      if (!existing) {
        metrics.mostCommonQuestions.push(question);
        // Keep only top 10 most common questions
        if (metrics.mostCommonQuestions.length > 10) {
          metrics.mostCommonQuestions = metrics.mostCommonQuestions.slice(0, 10);
        }
      }
      this.metrics.set(this.settings.currentMode, metrics);
    }
  }

  getPersonalityMetrics(mode?: PersonalityMode): PersonalityMetrics | PersonalityMetrics[] {
    if (mode) {
      return this.metrics.get(mode) || {
        mode,
        sessionsUsed: 0,
        averageSessionDuration: 0,
        safetyIncidentsReported: 0,
        userSatisfactionRating: 0,
        mostCommonQuestions: [],
        effectivenessScore: 0,
      };
    }
    return Array.from(this.metrics.values());
  }

  // Event system
  addEventListener(eventType: PersonalityEventType, listener: (event: PersonalityEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  removeEventListener(eventType: PersonalityEventType, listener: (event: PersonalityEvent) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitEvent(event: PersonalityEvent): void {
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }

    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in personality event listener:', error);
        }
      });
    }
  }

  // Advanced features
  suggestPersonalitySwitch(context: string): PersonalityMode | null {
    const currentMode = this.settings.currentMode;
    
    // Simple heuristics for personality suggestions
    if (context.toLowerCase().includes('emergency') || context.toLowerCase().includes('danger')) {
      if (currentMode !== 'safety-focused') {
        return 'safety-focused';
      }
    }
    
    if (context.toLowerCase().includes('technical') || context.toLowerCase().includes('specification')) {
      if (currentMode !== 'technical-expert') {
        return 'technical-expert';
      }
    }
    
    if (context.toLowerCase().includes('explain') || context.toLowerCase().includes('help me understand')) {
      if (currentMode !== 'friendly-assistant') {
        return 'friendly-assistant';
      }
    }
    
    return null;
  }

  getTransitionHistory(): PersonalityTransition[] {
    return [...this.transitions];
  }

  getEventHistory(eventType?: PersonalityEventType): PersonalityEvent[] {
    if (eventType) {
      return this.events.filter(event => event.type === eventType);
    }
    return [...this.events];
  }

  exportSettings(): string {
    return JSON.stringify({
      settings: this.settings,
      metrics: Object.fromEntries(this.metrics),
      transitions: this.transitions.slice(-50), // Last 50 transitions
      events: this.events.slice(-100), // Last 100 events
    }, null, 2);
  }

  importSettings(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      
      if (parsed.settings) {
        this.settings = { ...DEFAULT_PERSONALITY_SETTINGS, ...parsed.settings };
      }
      
      if (parsed.metrics) {
        this.metrics.clear();
        Object.entries(parsed.metrics).forEach(([mode, metrics]) => {
          this.metrics.set(mode as PersonalityMode, metrics as PersonalityMetrics);
        });
      }
      
      if (parsed.transitions) {
        this.transitions = parsed.transitions;
      }
      
      if (parsed.events) {
        this.events = parsed.events;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to import personality settings:', error);
      return false;
    }
  }
}

// Global personality manager instance
export const personalityManager = new PersonalityManager();

// Utility functions
export function createPersonalityManager(settings?: Partial<VoicePersonalitySettings>): PersonalityManager {
  return new PersonalityManager(settings);
}

export function getRecommendedPersonality(userQuery: string, currentMode: PersonalityMode): PersonalityMode {
  const query = userQuery.toLowerCase();
  
  // Safety keywords
  const safetyKeywords = ['safety', 'danger', 'emergency', 'hazard', 'risk', 'accident', 'incident', 'protocol'];
  if (safetyKeywords.some(keyword => query.includes(keyword)) && currentMode !== 'safety-focused') {
    return 'safety-focused';
  }
  
  // Technical keywords
  const technicalKeywords = ['specification', 'technical', 'engineering', 'system', 'component', 'analysis', 'diagnostic'];
  if (technicalKeywords.some(keyword => query.includes(keyword)) && currentMode !== 'technical-expert') {
    return 'technical-expert';
  }
  
  // Learning/help keywords
  const helpKeywords = ['explain', 'help', 'understand', 'learn', 'teach', 'guide', 'show me'];
  if (helpKeywords.some(keyword => query.includes(keyword)) && currentMode !== 'friendly-assistant') {
    return 'friendly-assistant';
  }
  
  return currentMode;
}