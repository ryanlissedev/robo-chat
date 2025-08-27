'use client';

import { Box, Cable, Key, Paintbrush, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DrawerClose } from '@/components/ui/drawer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import { cn, isDev } from '@/lib/utils';
import { ByokSection } from './apikeys/byok-section';
import { InteractionPreferences } from './appearance/interaction-preferences';
import { LayoutSettings } from './appearance/layout-settings';
import { ThemeSelection } from './appearance/theme-selection';
import { ConnectionsPlaceholder } from './connections/connections-placeholder';
import { DeveloperTools } from './connections/developer-tools';
import { OllamaSection } from './connections/ollama-section';
import { AccountManagement } from './general/account-management';
import { UserProfile } from './general/user-profile';
import { ModelsSettings } from './models/models-settings';

type SettingsContentProps = {
  isDrawer?: boolean;
};

type TabType = 'general' | 'appearance' | 'models' | 'connections';

export function SettingsContent({ isDrawer = false }: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>('general');

  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-y-auto',
        isDrawer ? 'p-0 pb-16' : 'py-0'
      )}
    >
      {isDrawer && (
        <div className="mb-2 flex items-center justify-between border-border border-b px-4 pb-2">
          <h2 className="font-medium text-lg">Settings</h2>
          <DrawerClose asChild>
            <Button size="icon" variant="ghost">
              <X className="size-4" />
            </Button>
          </DrawerClose>
        </div>
      )}

      <Tabs
        className={cn(
          'flex w-full flex-row',
          isDrawer ? '' : 'flex min-h-[400px]'
        )}
        onValueChange={(value) => setActiveTab(value as TabType)}
        value={activeTab}
      >
        {isDrawer ? (
          // Mobile version - tabs on top
          <div className="w-full items-start justify-start overflow-hidden py-4">
            <div>
              <TabsList className="mb-4 flex w-full min-w-0 flex-nowrap items-center justify-start overflow-x-auto bg-transparent px-0">
                <TabsTrigger
                  className="ml-6 flex shrink-0 items-center gap-2"
                  value="general"
                >
                  <Settings className="size-4" />
                  <span>General</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex shrink-0 items-center gap-2"
                  value="appearance"
                >
                  <Paintbrush className="size-4" />
                  <span>Appearance</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex shrink-0 items-center gap-2"
                  value="apikeys"
                >
                  <Key className="size-4" />
                  <span>API Keys</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex shrink-0 items-center gap-2"
                  value="models"
                >
                  <Box className="size-4" />
                  <span>Models</span>
                </TabsTrigger>
                <TabsTrigger
                  className="flex shrink-0 items-center gap-2"
                  value="connections"
                >
                  <Cable className="size-4" />
                  <span>Connections</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Mobile tabs content */}
            <TabsContent className="space-y-6 px-6" value="general">
              <UserProfile />
              {isSupabaseEnabled() && <AccountManagement />}
            </TabsContent>

            <TabsContent className="space-y-6 px-6" value="appearance">
              <ThemeSelection />
              <LayoutSettings />
              <InteractionPreferences />
            </TabsContent>

            <TabsContent className="px-6" value="apikeys">
              <ByokSection />
            </TabsContent>

            <TabsContent className="px-6" value="models">
              <ModelsSettings />
              {/* <ModelVisibilitySettings /> */}
            </TabsContent>

            <TabsContent className="space-y-6 px-6" value="connections">
              {!isDev && <ConnectionsPlaceholder />}
              {isDev && <OllamaSection />}
              {isDev && <DeveloperTools />}
            </TabsContent>
          </div>
        ) : (
          // Desktop version - tabs on left
          <>
            <TabsList className="block w-48 rounded-none bg-transparent px-3 pt-4">
              <div className="flex w-full flex-col gap-1">
                <TabsTrigger
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                  value="general"
                >
                  <div className="flex items-center gap-2">
                    <Settings className="size-4" />
                    <span>General</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                  value="appearance"
                >
                  <div className="flex items-center gap-2">
                    <Paintbrush className="size-4" />
                    <span>Appearance</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                  value="apikeys"
                >
                  <div className="flex items-center gap-2">
                    <Key className="size-4" />
                    <span>API Keys</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                  value="models"
                >
                  <div className="flex items-center gap-2">
                    <Box className="size-4" />
                    <span>Models</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                  value="connections"
                >
                  <div className="flex items-center gap-2">
                    <Cable className="size-4" />
                    <span>Connections</span>
                  </div>
                </TabsTrigger>
              </div>
            </TabsList>

            {/* Desktop tabs content */}
            <div className="flex-1 overflow-auto px-6 pt-4">
              <TabsContent className="mt-0 space-y-6" value="general">
                <UserProfile />
                {isSupabaseEnabled() && <AccountManagement />}
              </TabsContent>

              <TabsContent className="mt-0 space-y-6" value="appearance">
                <ThemeSelection />
                <LayoutSettings />
                <InteractionPreferences />
              </TabsContent>

              <TabsContent className="mt-0 space-y-6" value="apikeys">
                <ByokSection />
              </TabsContent>

              <TabsContent className="mt-0 space-y-6" value="models">
                <ModelsSettings />
                {/* <ModelVisibilitySettings /> */}
              </TabsContent>

              <TabsContent className="mt-0 space-y-6" value="connections">
                {!isDev && <ConnectionsPlaceholder />}
                {isDev && <OllamaSection />}
                {isDev && <DeveloperTools />}
              </TabsContent>
            </div>
          </>
        )}
      </Tabs>
    </div>
  );
}
