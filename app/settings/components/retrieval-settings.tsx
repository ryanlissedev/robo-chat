'use client';

import {
  ArrowsClockwise,
  Brain,
  Funnel,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { createClient } from '@/lib/supabase/client';

type RetrievalConfig = {
  // Query Rewriting
  queryRewriting: boolean;
  rewriteStrategy:
    | 'expansion'
    | 'refinement'
    | 'decomposition'
    | 'multi-perspective';

  // Reranking
  reranking: boolean;
  rerankingMethod: 'semantic' | 'cross-encoder' | 'diversity';

  // Search Parameters
  topK: number;
  temperature: number;
  minScore: number;

  // Advanced
  useHyDE: boolean; // Hypothetical Document Embedding
  diversityLambda: number; // For MMR reranking
  chunkSize: number;
  chunkOverlap: number;
};

type RetrievalSettingsProps = {
  userId: string;
};

export function RetrievalSettings({}: RetrievalSettingsProps) {
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
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(true);
  const supabase = createClient();

  const loadSettings = useCallback(async () => {
    if (!supabase) {
      console.warn('Database connection not available');
      return;
    }
    
    try {
      // Note: user_retrieval_settings table may not exist yet
      // Since this table doesn't exist in the schema, we'll just use defaults
      console.info('Using default retrieval settings - table not implemented yet');
    } catch {
      console.warn('Retrieval settings table not found, using defaults');
    }
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    if (!supabase) {
      toast.error('Database connection not available');
      return;
    }

    setLoading(true);
    try {
      // Table doesn't exist yet - just show success for now
      // TODO: Implement user_retrieval_settings table
      toast.success('Retrieval settings saved (local only - table not implemented)');
      setSaved(true);
      console.info('Retrieval settings would be saved:', config);
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (key: keyof RetrievalConfig, value: RetrievalConfig[keyof RetrievalConfig]) => {
    setConfig({ ...config, [key]: value });
    setSaved(false);
  };

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
    });
    setSaved(false);
  };

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
              checked={config.queryRewriting}
              id="query-rewriting"
              onCheckedChange={(checked) =>
                updateConfig('queryRewriting', checked)
              }
            />
          </div>

          {config.queryRewriting && (
            <div className="space-y-2">
              <Label>Rewrite Strategy</Label>
              <Select
                onValueChange={(value) =>
                  updateConfig('rewriteStrategy', value)
                }
                value={config.rewriteStrategy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expansion">
                    <div>
                      <div className="font-medium">Query Expansion</div>
                      <div className="text-muted-foreground text-xs">
                        Add synonyms and related terms
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="refinement">
                    <div>
                      <div className="font-medium">Query Refinement</div>
                      <div className="text-muted-foreground text-xs">
                        Improve clarity and specificity
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="decomposition">
                    <div>
                      <div className="font-medium">Query Decomposition</div>
                      <div className="text-muted-foreground text-xs">
                        Break into sub-queries
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="multi-perspective">
                    <div>
                      <div className="font-medium">Multi-Perspective</div>
                      <div className="text-muted-foreground text-xs">
                        Generate different angles
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="use-hyde">
              Use Hypothetical Document Embedding (HyDE)
            </Label>
            <Switch
              checked={config.useHyDE}
              id="use-hyde"
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
              checked={config.reranking}
              id="reranking"
              onCheckedChange={(checked) => updateConfig('reranking', checked)}
            />
          </div>

          {config.reranking && (
            <>
              <div className="space-y-2">
                <Label>Reranking Method</Label>
                <Select
                  onValueChange={(value) =>
                    updateConfig('rerankingMethod', value)
                  }
                  value={config.rerankingMethod}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semantic">
                      <div>
                        <div className="font-medium">Semantic Reranking</div>
                        <div className="text-muted-foreground text-xs">
                          Fast, context-aware ranking
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="cross-encoder">
                      <div>
                        <div className="font-medium">Cross-Encoder</div>
                        <div className="text-muted-foreground text-xs">
                          High accuracy, slower
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="diversity">
                      <div>
                        <div className="font-medium">Diversity (MMR)</div>
                        <div className="text-muted-foreground text-xs">
                          Balance relevance and variety
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.rerankingMethod === 'diversity' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Diversity Lambda</Label>
                    <span className="text-muted-foreground text-sm">
                      {config.diversityLambda}
                    </span>
                  </div>
                  <Slider
                    max={1}
                    min={0}
                    onValueChange={([value]) =>
                      updateConfig('diversityLambda', value)
                    }
                    step={0.1}
                    value={[config.diversityLambda]}
                  />
                  <p className="text-muted-foreground text-xs">
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
              <span className="text-muted-foreground text-sm">
                {config.topK}
              </span>
            </div>
            <Slider
              max={20}
              min={1}
              onValueChange={([value]) => updateConfig('topK', value)}
              step={1}
              value={[config.topK]}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="text-muted-foreground text-sm">
                {config.temperature}
              </span>
            </div>
            <Slider
              max={1}
              min={0}
              onValueChange={([value]) => updateConfig('temperature', value)}
              step={0.1}
              value={[config.temperature]}
            />
            <p className="text-muted-foreground text-xs">
              Lower = More focused, Higher = More creative
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Minimum Score Threshold</Label>
              <span className="text-muted-foreground text-sm">
                {config.minScore}
              </span>
            </div>
            <Slider
              max={1}
              min={0}
              onValueChange={([value]) => updateConfig('minScore', value)}
              step={0.05}
              value={[config.minScore]}
            />
            <p className="text-muted-foreground text-xs">
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
              <span className="text-muted-foreground text-sm">
                {config.chunkSize}
              </span>
            </div>
            <Slider
              max={4000}
              min={200}
              onValueChange={([value]) => updateConfig('chunkSize', value)}
              step={100}
              value={[config.chunkSize]}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Chunk Overlap (characters)</Label>
              <span className="text-muted-foreground text-sm">
                {config.chunkOverlap}
              </span>
            </div>
            <Slider
              max={500}
              min={0}
              onValueChange={([value]) => updateConfig('chunkOverlap', value)}
              step={50}
              value={[config.chunkOverlap]}
            />
            <p className="text-muted-foreground text-xs">
              Overlap helps maintain context between chunks
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button onClick={resetToDefaults} variant="outline">
          Reset to Defaults
        </Button>
        <div className="flex items-center gap-2">
          {!saved && <Badge variant="secondary">Unsaved changes</Badge>}
          <Button disabled={loading || saved} onClick={saveSettings}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
