'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useVoiceStore } from '../store/voice-store';

interface AudioVisualizerProps {
  className?: string;
  width?: number;
  height?: number;
  variant?: 'waveform' | 'frequency' | 'level' | 'pulse';
  showInputLevel?: boolean;
  showOutputLevel?: boolean;
  color?: string;
  backgroundColor?: string;
  sensitivity?: number;
}

export function AudioVisualizer({
  className,
  width = 300,
  height = 80,
  variant = 'waveform',
  showInputLevel = true,
  showOutputLevel = false,
  color = '#3b82f6',
  backgroundColor = 'transparent',
  sensitivity = 1.0
}: AudioVisualizerProps) {
  const {
    status,
    isRecording,
    inputLevel,
    outputLevel,
    visualizationData,
  } = useVoiceStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [isAnimating, setIsAnimating] = useState(false);

  // Generate sample visualization data when no real data is available
  const generateSampleData = useCallback((length: number = 128): Float32Array => {
    const data = new Float32Array(length);
    const now = Date.now() * 0.001;
    
    for (let i = 0; i < length; i++) {
      const freq = (i / length) * Math.PI * 4;
      data[i] = Math.sin(now * 2 + freq) * Math.sin(now * 0.5 + i * 0.1) * 0.5;
    }
    
    return data;
  }, []);

  // Waveform visualization
  const drawWaveform = useCallback((ctx: CanvasRenderingContext2D, data: Float32Array, width: number, height: number) => {
    const centerY = height / 2;
    const sliceWidth = width / data.length;

    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '20'; // 20% opacity for fill

    // Draw waveform path
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    const amplifier = (height / 2) * sensitivity;
    
    for (let i = 0; i < data.length; i++) {
      const x = i * sliceWidth;
      const y = centerY + (data[i] * amplifier);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Create filled area under waveform
    ctx.lineTo(width, centerY);
    ctx.lineTo(0, centerY);
    ctx.closePath();
    ctx.fill();
  }, [color, sensitivity]);

  // Frequency spectrum visualization
  const drawFrequency = useCallback((ctx: CanvasRenderingContext2D, data: Float32Array, width: number, height: number) => {
    const barWidth = width / data.length;
    const amplifier = height * sensitivity;

    ctx.fillStyle = color;
    
    for (let i = 0; i < data.length; i++) {
      const barHeight = Math.abs(data[i]) * amplifier;
      const x = i * barWidth;
      const y = height - barHeight;
      
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }, [color, sensitivity]);

  // Audio level meters
  const drawLevel = useCallback((ctx: CanvasRenderingContext2D, level: number, width: number, height: number, label?: string) => {
    const barHeight = height - 20;
    const barWidth = Math.max(20, width / 2 - 10);
    
    // Background
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 10, barWidth, barHeight);
    
    // Level indicator
    const levelHeight = (level / 100) * barHeight;
    const levelY = 10 + barHeight - levelHeight;
    
    // Color based on level
    if (level > 80) {
      ctx.fillStyle = '#ef4444'; // Red for high levels
    } else if (level > 60) {
      ctx.fillStyle = '#f59e0b'; // Yellow for medium levels
    } else {
      ctx.fillStyle = color; // Default color for low levels
    }
    
    ctx.fillRect(0, levelY, barWidth, levelHeight);
    
    // Label
    if (label) {
      ctx.fillStyle = '#374151';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, barWidth / 2, height - 2);
    }
  }, [color]);

  // Pulse animation for recording
  const drawPulse = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const now = Date.now() * 0.003;
    
    // Create pulsing circles
    for (let i = 0; i < 3; i++) {
      const radius = (Math.sin(now + i * 0.5) * 0.5 + 0.5) * (height / 4) + 10;
      const alpha = (Math.sin(now + i * 0.5) * 0.3 + 0.2);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    }
    
    // Center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }, [color]);

  // Main animation loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    if (backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    // Get visualization data or generate sample data
    const data = visualizationData || (isRecording ? generateSampleData(128) : new Float32Array(128));

    switch (variant) {
      case 'waveform':
        drawWaveform(ctx, data, width, height);
        break;
        
      case 'frequency':
        drawFrequency(ctx, data, width, height);
        break;
        
      case 'level':
        if (showInputLevel) {
          ctx.save();
          drawLevel(ctx, inputLevel, width / 2, height, 'Input');
          ctx.restore();
        }
        if (showOutputLevel) {
          ctx.save();
          ctx.translate(width / 2, 0);
          drawLevel(ctx, outputLevel, width / 2, height, 'Output');
          ctx.restore();
        }
        if (!showInputLevel && !showOutputLevel) {
          drawLevel(ctx, inputLevel, width, height);
        }
        break;
        
      case 'pulse':
        if (isRecording) {
          drawPulse(ctx, width, height);
        } else {
          // Static circle when not recording
          const centerX = width / 2;
          const centerY = height / 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
          ctx.fillStyle = color + '40';
          ctx.fill();
        }
        break;
    }

    if (isAnimating) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [
    width, 
    height, 
    backgroundColor, 
    visualizationData, 
    isRecording, 
    generateSampleData, 
    variant, 
    drawWaveform, 
    drawFrequency, 
    drawLevel, 
    drawPulse, 
    showInputLevel, 
    showOutputLevel, 
    inputLevel, 
    outputLevel, 
    isAnimating,
    color
  ]);

  // Start/stop animation based on recording state
  useEffect(() => {
    const shouldAnimate = isRecording || status === 'connecting' || status === 'processing' || variant === 'pulse';
    
    if (shouldAnimate && !isAnimating) {
      setIsAnimating(true);
    } else if (!shouldAnimate && isAnimating) {
      setIsAnimating(false);
    }
  }, [isRecording, status, variant, isAnimating]);

  // Handle animation lifecycle
  useEffect(() => {
    if (isAnimating) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      // Draw static state
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, animate]);

  // Set canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;
  }, [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        'border border-gray-200 rounded-lg',
        isRecording && 'border-red-300 shadow-lg',
        className
      )}
      width={width}
      height={height}
      aria-label={`Audio visualizer - ${variant} mode`}
      role="img"
    />
  );
}

// Preset configurations for common use cases
export const AudioVisualizerPresets = {
  compact: {
    width: 200,
    height: 40,
    variant: 'waveform' as const,
  },
  
  standard: {
    width: 300,
    height: 80,
    variant: 'waveform' as const,
  },
  
  spectrum: {
    width: 300,
    height: 120,
    variant: 'frequency' as const,
  },
  
  levels: {
    width: 100,
    height: 80,
    variant: 'level' as const,
    showInputLevel: true,
    showOutputLevel: true,
  },
  
  pulse: {
    width: 80,
    height: 80,
    variant: 'pulse' as const,
  },
};

// Hook for using preset configurations
export function useAudioVisualizerPreset(presetName: keyof typeof AudioVisualizerPresets) {
  return AudioVisualizerPresets[presetName];
}