# RoboRail Voice Assistant Features

## Overview

The RoboRail Assistant now includes comprehensive speech-to-speech voice interaction capabilities designed specifically for industrial environments. This allows operators to interact hands-free with the assistant while working on the RoboRail machine.

## Features

### 1. Speech-to-Speech Interaction

- **High-Quality STT**: OpenAI Whisper-1 model for accurate speech recognition
- **Specialized TTS**: Nova voice model optimized for industrial environments
- **Real-time Processing**: Fast audio processing with visual feedback
- **Hands-free Operation**: Complete voice interaction without touching the interface

### 2. Industrial-Optimized Voice

- **Noise Cancellation**: Built-in echo cancellation and noise suppression
- **Safety Context**: Voice prompts include RoboRail-specific terminology
- **Slower Playback**: TTS speed optimized for noisy environments (0.9x speed)
- **Professional Voice**: Nova voice model selected for clarity and professionalism

### 3. RoboRail Knowledge Integration

- **Technical Vocabulary**: Trained on RoboRail operation, maintenance, and safety terms
- **Error Code Recognition**: Voice recognition of error codes (E001-E005)
- **Safety Protocol Awareness**: Automatic safety warnings in voice responses
- **Contextual Responses**: Maintains conversation context across voice interactions

### 4. Enhanced User Interface

#### Voice Agent Component (`VoiceAgent`)

- **Visual Indicators**: Real-time audio level visualization during recording
- **Status Display**: Clear indication of listening, processing, and speaking states
- **Audio Controls**: Stop audio playback and recording controls
- **Error Handling**: Graceful error handling with user feedback

#### Icons and Visual Feedback

- 🎙️ **Microphone**: Start/stop voice input
- 🌊 **Waveform**: Audio processing indicator
- 🔊 **Speaker**: Audio output controls
- 📊 **Level Bars**: Real-time audio level visualization

### 5. LangSmith Integration

#### Feedback Collection

- **Thumbs Up/Down**: Quick feedback on voice responses
- **Detailed Comments**: Optional detailed feedback for improvements
- **Safety Flagging**: Automatic flagging of safety-critical feedback
- **Industrial Context**: Metadata tracking for manufacturing environment

#### Analytics and Monitoring

- **Voice Usage Tracking**: Complete interaction logging
- **Performance Metrics**: Processing time and accuracy monitoring
- **Safety Metrics**: Tracking of safety-related interactions
- **Quality Improvement**: Continuous learning from user feedback

## API Endpoints

### Voice Processing API (`/api/voice`)

#### POST - Speech-to-Speech Processing
```typescript
interface VoiceRequest {
  audio: string; // base64 encoded audio
  userId: string;
  chatId: string;
  isAuthenticated: boolean;
  sessionId?: string;
}

interface VoiceResponse {
  success: boolean;
  transcription: string;
  response_text: string;
  audio: string; // base64 encoded response audio
  session_id: string;
  error?: string;
}
```

#### PUT - Streaming Voice Processing
Real-time streaming voice interaction with Server-Sent Events.

### Enhanced Feedback API (`/api/feedback`)

Enhanced with RoboRail-specific metadata:
```typescript
{
  metadata: {
    source: 'roborail_assistant',
    messageId: string,
    feedback_type: 'upvote' | 'downvote',
    industrial_context: 'manufacturing_equipment',
    safety_critical: boolean,
  }
}
```

## Database Schema

### Voice Interactions Table

```sql
CREATE TABLE voice_interactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    chat_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    transcription TEXT NOT NULL,
    response_text TEXT NOT NULL,
    audio_duration_ms INTEGER,
    processing_time_ms INTEGER,
    model_used TEXT DEFAULT 'gpt-4o',
    voice_model TEXT DEFAULT 'nova',
    safety_warning_triggered BOOLEAN DEFAULT FALSE,
    error_occurred BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Usage Examples

### Basic Voice Interaction

```typescript
import { VoiceAgent } from '@/components/chat/voice-agent';

function ChatInterface({ chatId }: { chatId: string }) {
  return (
    <VoiceAgent
      chatId={chatId}
      onTranscription={(text) => {
        console.log('User said:', text);
      }}
      onResponse={(text) => {
        console.log('Assistant responded:', text);
      }}
    />
  );
}
```

### Voice Feedback Integration

```typescript
import { MessageFeedback } from '@/components/chat/message-feedback';

function AssistantMessage({ 
  messageId, 
  langsmithRunId 
}: { 
  messageId: string;
  langsmithRunId?: string;
}) {
  return (
    <MessageFeedback
      messageId={messageId}
      langsmithRunId={langsmithRunId}
      onFeedback={async (feedback, comment) => {
        // Automatically includes RoboRail context
        console.log('Feedback:', feedback, comment);
      }}
    />
  );
}
```

## Safety Features

### Automatic Safety Detection

- **Keyword Recognition**: Detects safety-related terms in voice input
- **Visual Warnings**: Safety warning banners for critical responses
- **Audio Alerts**: Safety reminders in voice responses
- **Compliance Tracking**: Logs safety-related interactions for compliance

### Safety Keywords Monitored

- "safety", "warning", "danger", "caution", "hazard"
- Error codes (E001-E005)
- Emergency procedures
- Personal protective equipment (PPE)

## Performance Optimizations

### Voice Processing

- **Chunked Audio**: Processes audio in optimized chunks for faster response
- **Caching**: Intelligent caching of common responses
- **Compression**: Optimized audio compression for industrial networks
- **Fallback**: Graceful degradation when voice services are unavailable

### Industrial Environment Adaptations

- **Noise Handling**: Advanced noise suppression for factory environments
- **Network Resilience**: Robust handling of poor network conditions
- **Offline Fallback**: Graceful degradation when internet is unavailable
- **Low Latency**: Optimized for real-time industrial operations

## Configuration

### Environment Variables

```bash
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key

# Voice Settings
VOICE_MODEL=nova
TTS_SPEED=0.9
STT_LANGUAGE=en

# LangSmith Configuration
LANGSMITH_API_KEY=your_langsmith_key
LANGSMITH_PROJECT=roborail-assistant
```

### Voice Model Selection

- **Nova**: Default professional voice (recommended)
- **Alloy**: Alternative neutral voice
- **Echo**: Male voice option
- **Fable**: Expressive voice (not recommended for industrial use)

## Troubleshooting

### Common Issues

1. **Microphone Access Denied**
   - Ensure browser permissions are granted
   - Check HTTPS requirement for microphone access

2. **Poor Audio Quality**
   - Check microphone quality and placement
   - Ensure stable network connection
   - Verify audio codec support

3. **Slow Response Times**
   - Check network latency
   - Verify OpenAI API key and quota
   - Monitor processing time metrics

### Debugging

Enable voice debugging:
```typescript
const voiceAgent = useVoiceAgent(chatId);
console.log('Voice history:', voiceAgent.voiceHistory);
```

## Security Considerations

### Data Privacy

- **Audio Encryption**: All audio data transmitted over HTTPS
- **Temporary Storage**: Audio is not permanently stored
- **User Consent**: Clear user consent for voice recording
- **Data Retention**: Voice interactions logged for improvement only

### Access Control

- **Authentication Required**: Voice features require user authentication
- **Role-Based Access**: Different voice features for different user roles
- **Audit Logging**: Complete audit trail of voice interactions
- **Compliance**: GDPR and industrial privacy compliance

## Future Enhancements

### Planned Features

1. **Offline Voice Processing**: Local STT/TTS for air-gapped environments
2. **Voice Biometrics**: User identification via voice patterns
3. **Multi-language Support**: Support for additional languages
4. **Custom Wake Words**: "Hey RoboRail" activation phrase
5. **Voice Commands**: Direct machine control via voice commands

### Integration Roadmap

1. **Machine Integration**: Direct control of RoboRail functions
2. **IoT Connectivity**: Voice control of connected devices
3. **Predictive Maintenance**: Voice-activated maintenance scheduling
4. **Training Modules**: Interactive voice-based training

## Support

For technical support with voice features:

- **HGG Support**: +31 (0)573 408 408
- **Emergency**: +31 (0)573 408 400 (24/7)
- **Email**: support@hgg-group.com
- **Documentation**: This document and inline help

## Version History

- **v1.0**: Initial voice implementation with basic STT/TTS
- **v1.1**: Added RoboRail knowledge integration
- **v1.2**: Enhanced industrial optimizations
- **v1.3**: LangSmith feedback integration
- **v1.4**: Voice analytics and safety features