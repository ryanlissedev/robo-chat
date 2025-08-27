export type PersonalityMode =
  | 'safety-focused'
  | 'technical-expert'
  | 'friendly-assistant';

export interface PersonalityConfig {
  id: PersonalityMode;
  name: string;
  description: string;
  shortDescription: string;
  icon: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
  voiceSettings: {
    voice: 'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer';
    speed: number;
    pitch: number;
    temperature: number;
    maxTokens: number;
  };
  instructions: {
    systemPrompt: string;
    safetyProtocols: string[];
    responseStyle: string;
    priorities: string[];
    examples: string[];
  };
  features: {
    emphasizesSafety: boolean;
    providesDetailedExplanations: boolean;
    usesTechnicalTerminology: boolean;
    isEncouraging: boolean;
    requiresConfirmation: boolean;
    includesWarnings: boolean;
  };
  audioSettings: {
    pauseDuration: number;
    emphasisLevel: number;
    confirmationRequired: boolean;
    warningTone: boolean;
  };
}

export interface VoicePersonalitySettings {
  currentMode: PersonalityMode;
  safetyProtocolsEnabled: boolean;
  customInstructions?: string;
  audioPreferences: {
    preferredVoice: string;
    speechRate: number;
    volume: number;
  };
  behaviorSettings: {
    confirmCriticalActions: boolean;
    provideDetailedExplanations: boolean;
    useIndustryTerminology: boolean;
    enableEmergencyProtocols: boolean;
  };
}

export interface PersonalityMetrics {
  mode: PersonalityMode;
  sessionsUsed: number;
  averageSessionDuration: number;
  safetyIncidentsReported: number;
  userSatisfactionRating: number;
  mostCommonQuestions: string[];
  effectivenessScore: number;
}

export interface PersonalityTransition {
  fromMode: PersonalityMode;
  toMode: PersonalityMode;
  reason: string;
  timestamp: number;
  context?: string;
}

export type PersonalityEventType =
  | 'mode_changed'
  | 'safety_protocol_triggered'
  | 'confirmation_requested'
  | 'technical_explanation_provided'
  | 'warning_issued'
  | 'emergency_procedure_activated';

export interface PersonalityEvent {
  type: PersonalityEventType;
  mode: PersonalityMode;
  timestamp: number;
  details: Record<string, unknown>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}
