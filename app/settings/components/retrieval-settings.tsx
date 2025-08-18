'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Brain, MagnifyingGlass, ArrowsClockwise, Funnel } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'

interface RetrievalConfig {
  // Query Rewriting
  queryRewriting: boolean
  rewriteStrategy: 'expansion' | 'refinement' | 'decomposition' | 'multi-perspective'
  
  // Reranking
  reranking: boolean
  rerankingMethod: 'semantic' | 'cross-encoder' | 'diversity'
  
  // Search Parameters
  topK: number
  temperature: number
  minScore: number
  
  // Advanced
  useHyDE: boolean // Hypothetical Document Embedding
  diversityLambda: number // For MMR reranking
  chunkSize: number
  chunkOverlap: number
}

interface RetrievalSettingsProps {
  userId: string
}

export function RetrievalSettings({ userId }: RetrievalSettingsProps) {
  const [config, setConfig] = useState<RetrievalConfig>({
    queryRewriting: true,
    rewriteStrategy: 'expansion',
    reranking: true,
    rerankingMethod: 'semantic',
    topK: 5,
    temperature: 0.3,
    minScore: 0.7,
    useHyDE: false,
    diversityLambda: 0.5,
    chunkSize: 1000,
    chunkOverlap: 200,
  })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('user_retrieval_settings')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (data) {
        setConfig(data.config)
      }
    } catch (error) {
      console.error('Error loading retrieval settings:', error)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_retrieval_settings')
        .upsert({
          user_id: userId,
          config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        })

      if (error) throw error

      toast.success('Retrieval settings saved')
      setSaved(true)
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const updateConfig = (key: keyof RetrievalConfig, value: any) => {
    setConfig({ ...config, [key]: value })
    setSaved(false)
  }

  const resetToDefaults = () => {
    setConfig({
      queryRewriting: true,
      rewriteStrategy: 'expansion',
      reranking: true,
      rerankingMethod: 'semantic',
      topK: 5,
      temperature: 0.3,
      minScore: 0.7,
      useHyDE: false,
      diversityLambda: 0.5,
      chunkSize: 1000,
      chunkOverlap: 200,
    })
    setSaved(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MagnifyingGlass className="h-5 w-5" />
            Query Rewriting
          </CardTitle>
          <CardDescription>
            Improve search accuracy by automatically rewriting queries
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="query-rewriting">Enable Query Rewriting</Label>
            <Switch
              id="query-rewriting"
              checked={config.queryRewriting}
              onCheckedChange={(checked) => updateConfig('queryRewriting', checked)}
            />
          </div>

          {config.queryRewriting && (
            <div className="space-y-2">
              <Label>Rewrite Strategy</Label>
              <Select
                value={config.rewriteStrategy}
                onValueChange={(value) => updateConfig('rewriteStrategy', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expansion">
                    <div>
                      <div className="font-medium">Query Expansion</div>
                      <div className="text-xs text-muted-foreground">Add synonyms and related terms</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="refinement">
                    <div>
                      <div className="font-medium">Query Refinement</div>
                      <div className="text-xs text-muted-foreground">Improve clarity and specificity</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="decomposition">
                    <div>
                      <div className="font-medium">Query Decomposition</div>
                      <div className="text-xs text-muted-foreground">Break into sub-queries</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="multi-perspective">
                    <div>
                      <div className="font-medium">Multi-Perspective</div>
                      <div className="text-xs text-muted-foreground">Generate different angles</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="use-hyde">Use Hypothetical Document Embedding (HyDE)</Label>
            <Switch
              id="use-hyde"
              checked={config.useHyDE}
              onCheckedChange={(checked) => updateConfig('useHyDE', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowsClockwise className="h-5 w-5" />
            Reranking
          </CardTitle>
          <CardDescription>
            Reorder search results for better relevance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="reranking">Enable Reranking</Label>
            <Switch
              id="reranking"
              checked={config.reranking}
              onCheckedChange={(checked) => updateConfig('reranking', checked)}
            />
          </div>

          {config.reranking && (
            <>
              <div className="space-y-2">
                <Label>Reranking Method</Label>
                <Select
                  value={config.rerankingMethod}
                  onValueChange={(value) => updateConfig('rerankingMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semantic">
                      <div>
                        <div className="font-medium">Semantic Reranking</div>
                        <div className="text-xs text-muted-foreground">Fast, context-aware ranking</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="cross-encoder">
                      <div>
                        <div className="font-medium">Cross-Encoder</div>
                        <div className="text-xs text-muted-foreground">High accuracy, slower</div>
                      </div>
                    </SelectItem>
                    <SelectItem value="diversity">
                      <div>
                        <div className="font-medium">Diversity (MMR)</div>
                        <div className="text-xs text-muted-foreground">Balance relevance and variety</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.rerankingMethod === 'diversity' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Diversity Lambda</Label>
                    <span className="text-sm text-muted-foreground">{config.diversityLambda}</span>
                  </div>
                  <Slider
                    value={[config.diversityLambda]}
                    onValueChange={([value]) => updateConfig('diversityLambda', value)}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                  <p className="text-xs text-muted-foreground">
                    0 = Maximum diversity, 1 = Maximum relevance
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Funnel className="h-5 w-5" />
            Search Parameters
          </CardTitle>
          <CardDescription>
            Fine-tune search behavior and result filtering
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Top K Results</Label>
              <span className="text-sm text-muted-foreground">{config.topK}</span>
            </div>
            <Slider
              value={[config.topK]}
              onValueChange={([value]) => updateConfig('topK', value)}
              min={1}
              max={20}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-sm text-muted-foreground">{config.temperature}</span>
            </div>
            <Slider
              value={[config.temperature]}
              onValueChange={([value]) => updateConfig('temperature', value)}
              min={0}
              max={1}
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              Lower = More focused, Higher = More creative
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Minimum Score Threshold</Label>
              <span className="text-sm text-muted-foreground">{config.minScore}</span>
            </div>
            <Slider
              value={[config.minScore]}
              onValueChange={([value]) => updateConfig('minScore', value)}
              min={0}
              max={1}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              Filter out results below this relevance score
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Chunking Settings
          </CardTitle>
          <CardDescription>
            Configure how documents are split for indexing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chunk Size (characters)</Label>
              <span className="text-sm text-muted-foreground">{config.chunkSize}</span>
            </div>
            <Slider
              value={[config.chunkSize]}
              onValueChange={([value]) => updateConfig('chunkSize', value)}
              min={200}
              max={4000}
              step={100}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chunk Overlap (characters)</Label>
              <span className="text-sm text-muted-foreground">{config.chunkOverlap}</span>
            </div>
            <Slider
              value={[config.chunkOverlap]}
              onValueChange={([value]) => updateConfig('chunkOverlap', value)}
              min={0}
              max={500}
              step={50}
            />
            <p className="text-xs text-muted-foreground">
              Overlap helps maintain context between chunks
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={resetToDefaults}>
          Reset to Defaults
        </Button>
        <div className="flex items-center gap-2">
          {!saved && (
            <Badge variant="secondary">Unsaved changes</Badge>
          )}
          <Button onClick={saveSettings} disabled={loading || saved}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}