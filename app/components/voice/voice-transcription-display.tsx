"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { AudioWaveform, Mic, User } from "lucide-react"
import { useEffect, useRef } from "react"

export interface TranscriptionMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isPartial?: boolean
}

interface VoiceTranscriptionDisplayProps {
  messages: TranscriptionMessage[]
  isRecording?: boolean
  isProcessing?: boolean
  className?: string
}

export function VoiceTranscriptionDisplay({
  messages,
  isRecording = false,
  isProcessing = false,
  className
}: VoiceTranscriptionDisplayProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const endOfMessagesRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "end" 
      })
    }
  }, [messages])

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AudioWaveform className="size-5 text-primary" />
            <h3 className="text-lg font-semibold">Voice Conversation</h3>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <Mic className="size-4 animate-pulse" />
                <span>Recording...</span>
              </div>
            )}
            {isProcessing && (
              <div className="flex items-center gap-1 text-sm text-blue-600">
                <div className="size-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            )}
          </div>
        </div>

        <ScrollArea 
          className="h-96 w-full rounded-md border p-4"
          ref={scrollAreaRef}
        >
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <AudioWaveform className="size-12 mx-auto mb-4 opacity-50" />
                <p>Start speaking to begin voice conversation</p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 p-3 rounded-lg",
                    message.role === "user" 
                      ? "bg-primary/10 ml-8" 
                      : "bg-muted mr-8",
                    message.isPartial && "opacity-70 animate-pulse"
                  )}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback>
                      {message.role === "user" ? (
                        <User className="size-4" />
                      ) : (
                        <AudioWaveform className="size-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {message.role === "user" ? "You" : "RoboRail"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.isPartial && (
                        <span className="text-xs text-blue-600 font-medium">
                          Speaking...
                        </span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">
                      {message.content || (message.isPartial ? "..." : "No content")}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={endOfMessagesRef} />
          </div>
        </ScrollArea>

        {/* Voice activity indicator */}
        {(isRecording || isProcessing) && (
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-full">
              {isRecording ? (
                <>
                  <div className="size-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">Listening...</span>
                </>
              ) : (
                <>
                  <div className="size-2 bg-blue-500 rounded-full animate-pulse" />
                  <span className="text-sm text-muted-foreground">Processing...</span>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}