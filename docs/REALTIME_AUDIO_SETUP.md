# Realtime Audio Setup Guide

## Overview
The Realtime Audio feature provides a natural voice conversation interface powered by OpenAI's Realtime API, allowing users to interact with AI through voice in real-time.

## Features
- Real-time voice transcription
- Natural conversation flow
- Visual audio feedback with waveform visualization
- Mobile-responsive modal interface
- WebSocket-based communication for low latency

## Setup Instructions

### 1. Environment Configuration
Ensure your `.env.local` file includes the OpenAI API key:

```bash
OPENAI_API_KEY=sk-your_openai_api_key
```

### 2. Required Permissions
The application requires microphone access. Users will be prompted to grant permission when they first use the voice feature.

### 3. Usage

#### Desktop
1. Click the AudioWaveform icon in the chat input area
2. The Realtime Audio modal will open
3. Click "Connect" to establish a connection to the OpenAI Realtime API
4. Click "Start Recording" or hold the microphone button to speak
5. Your speech will be transcribed in real-time
6. Click "Stop Recording" when finished
7. The transcript will be added to your chat input

#### Mobile
1. Tap the AudioWaveform icon (smaller size on mobile)
2. The modal opens in full-screen mode for better mobile experience
3. Tap "Connect" to start
4. Tap "Record" to begin speaking
5. Tap "Stop" when done
6. Swipe down or tap the X to close the modal

## Mobile Responsiveness

The interface adapts to different screen sizes:

### Mobile (< 640px)
- Compact button sizes (8x8px for buttons)
- Simplified labels ("Record" instead of "Start Recording")
- Full-screen modal with swipe-to-close gesture
- Smaller text and spacing

### Tablet (640px - 1024px)
- Medium button sizes
- Standard labels
- 80% viewport height modal

### Desktop (> 1024px)
- Full-size buttons and labels
- Fixed 600px height modal
- Enhanced visual feedback

## Technical Details

### WebSocket Connection
The application establishes a WebSocket connection to OpenAI's Realtime API endpoint:
- URL: `wss://api.openai.com/v1/realtime`
- Protocol: WebSocket with OpenAI-Beta header

### Audio Processing
- Audio is captured using the Web Audio API
- MediaRecorder captures audio in WebM format
- Audio chunks are sent every 100ms for real-time processing
- Includes echo cancellation, noise suppression, and auto-gain control

### Security
- API keys are never exposed to the client
- Server-side endpoint handles authentication
- WebSocket connections are encrypted (WSS)

## Troubleshooting

### Connection Issues
- Verify your OpenAI API key is valid and has access to the Realtime API
- Check your internet connection stability
- Ensure WebSocket connections are not blocked by firewalls

### Audio Issues
- Grant microphone permissions when prompted
- Check your microphone is working in system settings
- Try refreshing the page if audio capture fails

### Mobile Issues
- Ensure you're using a modern mobile browser (Chrome, Safari, Firefox)
- Check that your device supports getUserMedia API
- Try rotating your device if the layout appears incorrect

## Browser Support
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14.1+
- Edge 90+

## API Limits
Be aware of OpenAI's API rate limits and pricing for the Realtime API. Monitor your usage through the OpenAI dashboard.