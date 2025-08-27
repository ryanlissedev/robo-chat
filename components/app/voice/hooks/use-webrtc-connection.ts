'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVoiceStore } from '../store/voice-store';

interface WebRTCConnectionOptions {
  iceServers?: RTCIceServer[];
  enableEchoCancellation?: boolean;
  enableNoiseSuppression?: boolean;
  enableAutoGainControl?: boolean;
  sampleRate?: number;
  channelCount?: number;
}

interface WebRTCConnectionState {
  connection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  error: Error | null;
}

const defaultOptions: WebRTCConnectionOptions = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  enableEchoCancellation: true,
  enableNoiseSuppression: true,
  enableAutoGainControl: true,
  sampleRate: 16000,
  channelCount: 1,
};

export function useWebRTCConnection(options: WebRTCConnectionOptions = {}) {
  const {
    status,
    sessionId,
    config,
    setError,
    updateAudioLevels,
    updateVisualizationData,
  } = useVoiceStore();

  const mergedOptions = useMemo(
    () => ({ ...defaultOptions, ...options }),
    [options]
  );

  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>(
    {
      connection: null,
      dataChannel: null,
      localStream: null,
      remoteStream: null,
      connectionState: 'new',
      iceConnectionState: 'new',
      error: null,
    }
  );

  const connectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  // keep a ref to the latest connect function to avoid circular deps
  const connectRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Initialize audio context and analyser
  const initializeAudioContext = useCallback(
    async (stream: MediaStream) => {
      const audioContext = new AudioContext({
        sampleRate: mergedOptions.sampleRate,
      });
      const analyser = audioContext.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      return { audioContext, analyser };
    },
    [mergedOptions.sampleRate]
  );

  // Get user media stream
  const getUserMedia = useCallback(async (): Promise<MediaStream> => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: mergedOptions.enableEchoCancellation,
          noiseSuppression: mergedOptions.enableNoiseSuppression,
          autoGainControl: mergedOptions.enableAutoGainControl,
          sampleRate: mergedOptions.sampleRate,
          channelCount: mergedOptions.channelCount,
        },
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Initialize audio processing
      await initializeAudioContext(stream);

      return stream;
    } catch (error) {
      throw new Error(
        `Microphone access denied: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }, [mergedOptions, initializeAudioContext]);

  // Handle data channel messages
  const handleDataChannelMessage = useCallback(
    (data: string) => {
      try {
        const message = JSON.parse(data);

        switch (message.type) {
          case 'transcript':
            // Handle incoming transcript data
            if (message.transcript) {
              useVoiceStore
                .getState()
                .updateCurrentTranscript(message.transcript);
            }
            break;

          case 'audio_levels':
            // Handle audio level updates
            if (message.inputLevel !== undefined) {
              updateAudioLevels(message.inputLevel, message.outputLevel);
            }
            break;

          case 'error':
            // Handle server-side errors
            setError({
              code: message.code || 'WEBRTC_ERROR',
              message: message.message || 'WebRTC communication error',
              timestamp: Date.now(),
            });
            break;
        }
      } catch (_error) {}
    },
    [setError, updateAudioLevels]
  );

  // Handle connection failures
  const handleConnectionFailure = useCallback(() => {
    if (reconnectAttempts < 3) {
      setReconnectAttempts((prev) => prev + 1);

      reconnectTimeoutRef.current = setTimeout(
        async () => {
          try {
            await connectRef.current?.();
          } catch (_error) {}
        },
        2000 * 2 ** reconnectAttempts
      ); // Exponential backoff
    } else {
      setError({
        code: 'CONNECTION_FAILED',
        message:
          'Failed to establish WebRTC connection after multiple attempts',
        timestamp: Date.now(),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectAttempts, setError]);

  // Create peer connection
  const createPeerConnection = useCallback((): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: mergedOptions.iceServers,
      iceCandidatePoolSize: 10,
    });

    // Connection state handlers
    pc.onconnectionstatechange = () => {
      setConnectionState((prev) => ({
        ...prev,
        connectionState: pc.connectionState,
      }));
    };

    pc.oniceconnectionstatechange = () => {
      setConnectionState((prev) => ({
        ...prev,
        iceConnectionState: pc.iceConnectionState,
      }));

      // Handle connection failures
      if (
        pc.iceConnectionState === 'failed' ||
        pc.iceConnectionState === 'disconnected'
      ) {
        handleConnectionFailure();
      }
    };

    // Data channel for real-time communication
    const dataChannel = pc.createDataChannel('voice-data', {
      ordered: true,
      maxRetransmits: 0,
    });

    dataChannel.onopen = () => {};

    dataChannel.onmessage = (event) => {
      handleDataChannelMessage(event.data);
    };

    dataChannelRef.current = dataChannel;
    connectionRef.current = pc;

    setConnectionState((prev) => ({
      ...prev,
      connection: pc,
      dataChannel,
    }));

    return pc;
  }, [
    mergedOptions.iceServers,
    handleConnectionFailure,
    handleDataChannelMessage,
  ]);

  // Connect to remote peer
  const connect = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      throw new Error('No session ID available');
    }

    try {
      // Clean up existing connection
      if (connectionRef.current) {
        connectionRef.current.close();
      }

      const pc = createPeerConnection();
      const stream = await getUserMedia();

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send offer to signaling server
      const response = await fetch('/api/voice/webrtc/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          offer: offer.sdp,
          config: config,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send offer: ${response.statusText}`);
      }

      const { answer } = await response.json();

      // Set remote description
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answer,
      });

      setConnectionState((prev) => ({
        ...prev,
        localStream: stream,
      }));

      // Reset reconnect attempts on successful connection
      setReconnectAttempts(0);
    } catch (error) {
      setError({
        code: 'CONNECTION_FAILED',
        message: error instanceof Error ? error.message : 'Failed to connect',
        timestamp: Date.now(),
      });
      throw error;
    }
  }, [sessionId, config, createPeerConnection, getUserMedia, setError]);

  // keep connect ref updated
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Disconnect and cleanup
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    setConnectionState({
      connection: null,
      dataChannel: null,
      localStream: null,
      remoteStream: null,
      connectionState: 'new',
      iceConnectionState: 'new',
      error: null,
    });

    setReconnectAttempts(0);
  }, []);

  // Send data through data channel
  const sendData = useCallback((data: unknown) => {
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === 'open'
    ) {
      dataChannelRef.current.send(JSON.stringify(data));
    }
  }, []);

  // Monitor audio levels and visualization data
  useEffect(() => {
    if (!analyserRef.current || status !== 'recording') {
      return;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const floatArray = new Float32Array(bufferLength);

    const updateAnalysis = () => {
      analyser.getByteFrequencyData(dataArray);
      analyser.getFloatFrequencyData(floatArray);

      // Calculate input level (0-100)
      const sum = dataArray.reduce((acc, value) => acc + value, 0);
      const average = sum / bufferLength;
      const inputLevel = Math.round((average / 255) * 100);

      // Update store
      updateAudioLevels(inputLevel);
      updateVisualizationData(floatArray);

      if (status === 'recording') {
        requestAnimationFrame(updateAnalysis);
      }
    };

    updateAnalysis();
  }, [status, updateAudioLevels, updateVisualizationData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...connectionState,
    connect,
    disconnect,
    sendData,
    isConnected: connectionState.connectionState === 'connected',
    isConnecting: connectionState.connectionState === 'connecting',
    reconnectAttempts,
  };
}
