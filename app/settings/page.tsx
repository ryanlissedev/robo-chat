'use client';

import { Activity, Brain, Database, Key, Shield } from 'lucide-react';
import { Header } from '@/components/app/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/lib/user-store/provider';
import { ApiKeyManager } from './components/api-key-manager';
import { DiagnosticsPanel } from './components/diagnostics';
import { RetrievalSettings } from './components/retrieval-settings';
import { SecuritySettings } from './components/security-settings';
import { VectorStoreManager } from './components/vector-store-manager';

export default function SettingsPage() {
  const { user } = useUser();

  // Guest users can access the API Keys tab, but other tabs require authentication

  return (
    <div className="flex h-full flex-col">
      <Header hasSidebar={false} />

      <main className="flex-1 overflow-y-auto pt-app-header">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="mb-8">
            <h1 className="font-bold text-3xl">Settings</h1>
            <p className="mt-2 text-muted-foreground">
              Manage your API keys, vector stores, and retrieval configuration
            </p>
          </div>

          <Tabs className="space-y-6" defaultValue="api-keys">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger className="gap-2" value="api-keys">
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger className="gap-2" value="vector-stores">
                <Database className="h-4 w-4" />
                Vector Stores
              </TabsTrigger>
              <TabsTrigger className="gap-2" value="retrieval">
                <Brain className="h-4 w-4" />
                Retrieval
              </TabsTrigger>
              <TabsTrigger className="gap-2" value="security">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
              <TabsTrigger className="gap-2" value="diagnostics">
                <Activity className="h-4 w-4" />
                Diagnostics
              </TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="api-keys">
              <ApiKeyManager userId={user?.id} />
            </TabsContent>

            <TabsContent className="space-y-4" value="vector-stores">
              {user ? (
                <VectorStoreManager userId={user.id} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    Please log in to manage vector stores.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="retrieval">
              {user ? (
                <RetrievalSettings userId={user.id} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    Please log in to manage retrieval settings.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="security">
              {user ? (
                <SecuritySettings userId={user.id} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">
                    Please log in to manage security settings.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="diagnostics">
              <DiagnosticsPanel />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
