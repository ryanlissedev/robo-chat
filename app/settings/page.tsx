'use client';

import { Brain, Database, Key, Shield } from '@phosphor-icons/react';
import { redirect } from 'next/navigation';
import { Header } from '@/app/components/layout/header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/lib/user-store/provider';
import { ApiKeyManager } from './components/api-key-manager';
import { RetrievalSettings } from './components/retrieval-settings';
import { SecuritySettings } from './components/security-settings';
import { VectorStoreManager } from './components/vector-store-manager';

export default function SettingsPage() {
  const { user } = useUser();

  // Redirect if not authenticated
  if (!user) {
    redirect('/auth/login');
  }

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
            <TabsList className="grid w-full grid-cols-4">
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
            </TabsList>

            <TabsContent className="space-y-4" value="api-keys">
              <ApiKeyManager userId={user.id} />
            </TabsContent>

            <TabsContent className="space-y-4" value="vector-stores">
              <VectorStoreManager userId={user.id} />
            </TabsContent>

            <TabsContent className="space-y-4" value="retrieval">
              <RetrievalSettings userId={user.id} />
            </TabsContent>

            <TabsContent className="space-y-4" value="security">
              <SecuritySettings userId={user.id} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
