"use client"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { AudioWaveform, Mic, MicOff } from "lucide-react"
import { useState, useCallback, useEffect } from "react"

interface VoiceRecordingButtonProps {
  isAuthenticated: boolean
  onStartRecording?: () => void
  onStopRecording?: () => void
  isRecording?: boolean
  isSupported?: boolean
  className?: string
  disabled?: boolean
}

export function VoiceRecordingButton({
  isAuthenticated,
  onStartRecording,
  onStopRecording,
  isRecording = false,
  isSupported = true,
  className,
  disabled = false
}: VoiceRecordingButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  // Prevent hydration mismatch by ensuring client-side only rendering of dynamic content
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleClick = useCallback(() => {
    if (disabled || !isSupported) return
    
    if (!isAuthenticated) {
      // TODO: Show authentication required modal
      console.log("Authentication required for voice features")
      return
    }

    if (isRecording) {
      onStopRecording?.()
    } else {
      onStartRecording?.()
    }
  }, [disabled, isSupported, isAuthenticated, isRecording, onStartRecording, onStopRecording])

  const getIcon = () => {
    if (isRecording) {
      return <MicOff className="size-4 text-red-500" />
    }
    
    if (isHovered && isSupported) {
      return <Mic className="size-4" />
    }
    
    return <AudioWaveform className="size-4" />
  }

  const getTooltipText = () => {
    // Use consistent default during server-side rendering to prevent hydration mismatch
    if (!isMounted) return "Voice recording"
    if (!isSupported) return "Voice input not supported"
    if (!isAuthenticated) return "Sign in to use voice features"
    if (isRecording) return "Stop recording"
    return "Start voice recording"
  }

  const getButtonVariant = () => {
    if (isRecording) return "destructive"
    if (!isSupported || !isAuthenticated) return "ghost"
    return "ghost"
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant={getButtonVariant()}
          className={cn(
            "size-9 rounded-full transition-all duration-200",
            isRecording && "animate-pulse bg-red-100 hover:bg-red-200",
            (!isSupported || !isAuthenticated) && "opacity-50 cursor-not-allowed",
            className
          )}
          onClick={handleClick}
          disabled={disabled}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={getTooltipText()}
        >
          {getIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" align="center">
        <p>{getTooltipText()}</p>
      </TooltipContent>
    </Tooltip>
  )
}