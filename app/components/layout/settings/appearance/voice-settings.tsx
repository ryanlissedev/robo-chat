"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { AudioWaveform, PlayIcon, Volume2 } from "lucide-react"
import { useState } from "react"

export type VoiceType = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"

interface VoiceOption {
  id: VoiceType
  name: string
  description: string
  gender: "Female" | "Male" | "Neutral"
  tone: string
}

const voiceOptions: VoiceOption[] = [
  {
    id: "alloy",
    name: "Alloy",
    description: "Neutral, balanced tone",
    gender: "Neutral",
    tone: "Professional"
  },
  {
    id: "echo", 
    name: "Echo",
    description: "Male, clear and direct",
    gender: "Male",
    tone: "Authoritative"
  },
  {
    id: "fable",
    name: "Fable",
    description: "British accent, storytelling",
    gender: "Male", 
    tone: "Narrative"
  },
  {
    id: "onyx",
    name: "Onyx",
    description: "Deep, resonant male voice",
    gender: "Male",
    tone: "Deep"
  },
  {
    id: "nova",
    name: "Nova",
    description: "Young, energetic female",
    gender: "Female",
    tone: "Energetic"
  },
  {
    id: "shimmer",
    name: "Shimmer", 
    description: "Soft, warm female voice",
    gender: "Female",
    tone: "Gentle"
  }
]

interface VoiceSettingsProps {
  className?: string
}

export function VoiceSettings({ className }: VoiceSettingsProps) {
  const [selectedVoice, setSelectedVoice] = useState<VoiceType>("alloy")
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [autoTranscription, setAutoTranscription] = useState(true)
  const [voiceActivityDetection, setVoiceActivityDetection] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const selectedVoiceOption = voiceOptions.find(v => v.id === selectedVoice)

  const handlePreviewVoice = async (voiceId: VoiceType) => {
    setIsPlaying(true)
    // TODO: Implement voice preview functionality
    // This would play a sample audio with the selected voice
    console.log(`Preview voice: ${voiceId}`)
    
    // Simulate audio playback
    setTimeout(() => {
      setIsPlaying(false)
    }, 3000)
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AudioWaveform className="size-5 text-primary" />
          <CardTitle>Voice Settings</CardTitle>
        </div>
        <CardDescription>
          Configure voice interaction preferences for RoboRail Assistant
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Enable Voice Features */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Enable Voice Features</Label>
            <p className="text-sm text-muted-foreground">
              Allow voice input and audio responses
            </p>
          </div>
          <Switch
            checked={voiceEnabled}
            onCheckedChange={setVoiceEnabled}
            disabled={isPlaying}
          />
        </div>

        <Separator />

        {/* Voice Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Assistant Voice</Label>
          <p className="text-sm text-muted-foreground">
            Choose the voice for RoboRail Assistant responses
          </p>
          
          <div className="grid gap-4">
            <Select
              value={selectedVoice}
              onValueChange={(value: VoiceType) => setSelectedVoice(value)}
              disabled={!voiceEnabled}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {voiceOptions.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="font-medium">{voice.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {voice.gender} • {voice.tone}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Selected Voice Info */}
            {selectedVoiceOption && (
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{selectedVoiceOption.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedVoiceOption.description}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePreviewVoice(selectedVoice)}
                  disabled={!voiceEnabled || isPlaying}
                  className="shrink-0"
                >
                  {isPlaying ? (
                    <Volume2 className="size-4 animate-pulse" />
                  ) : (
                    <PlayIcon className="size-4" />
                  )}
                  <span className="ml-2">
                    {isPlaying ? "Playing..." : "Preview"}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Voice Activity Detection */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Voice Activity Detection</Label>
            <p className="text-sm text-muted-foreground">
              Automatically detect when you start and stop speaking
            </p>
          </div>
          <Switch
            checked={voiceActivityDetection}
            onCheckedChange={setVoiceActivityDetection}
            disabled={!voiceEnabled}
          />
        </div>

        {/* Auto Transcription */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Live Transcription</Label>
            <p className="text-sm text-muted-foreground">
              Show real-time transcription of your speech
            </p>
          </div>
          <Switch
            checked={autoTranscription}
            onCheckedChange={setAutoTranscription}
            disabled={!voiceEnabled}
          />
        </div>

        <Separator />

        {/* Voice Quality Info */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-start gap-2">
            <AudioWaveform className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Voice Quality</p>
              <p className="text-xs text-muted-foreground">
                Voice features use OpenAI&apos;s Realtime API for low-latency speech-to-speech conversations.
                Microphone access is required for voice input.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}