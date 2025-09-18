'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useGuestAuth } from '@/components/providers/guest-auth-provider';
import { guestSettings, type GuestSettings } from '@/lib/guest-settings';
import { GuestCredentialService } from '@/lib/services/guest-credential-service';

/**
 * Demo component to test guest mode functionality
 * This demonstrates all the guest features working together
 */
export function GuestModeDemo() {
  const {
    user,
    session,
    isLoading,
    isGuestMode,
    initializeGuestMode,
    clearGuestData,
    saveSettings,
    loadSettings,
    getAuthHeaders,
  } = useGuestAuth();

  const [settings, setSettings] = useState<GuestSettings | null>(null);
  const [testApiKey, setTestApiKey] = useState('');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [credentialService] = useState(() => new GuestCredentialService());

  useEffect(() => {
    const currentSettings = loadSettings();
    setSettings(currentSettings);
  }, [loadSettings]);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testGuestAuth = async () => {
    try {
      if (!isGuestMode) {
        await initializeGuestMode();
        addTestResult('✅ Guest mode initialized successfully');
      } else {
        addTestResult('✅ Already in guest mode');
      }

      // Test headers
      const headers = getAuthHeaders();
      addTestResult(`✅ Auth headers: ${JSON.stringify(headers)}`);

    } catch (error) {
      addTestResult(`❌ Guest auth test failed: ${error}`);
    }
  };

  const testSettings = async () => {
    try {
      // Test saving settings
      const testSettingsUpdate = {
        layout: 'sidebar' as const,
        rememberApiKeys: true,
        preferredStorage: 'session' as const,
      };

      saveSettings(testSettingsUpdate);
      addTestResult('✅ Settings saved successfully');

      // Test loading settings
      const loadedSettings = loadSettings();
      addTestResult(`✅ Settings loaded: layout=${loadedSettings?.layout}`);

      setSettings(loadedSettings);

    } catch (error) {
      addTestResult(`❌ Settings test failed: ${error}`);
    }
  };

  const testApiKeyManagement = async () => {
    try {
      if (!testApiKey) {
        addTestResult('❌ Please enter a test API key');
        return;
      }

      // Test saving credential
      const credential = await credentialService.saveCredential({
        provider: 'openai',
        key: testApiKey,
        storageScope: 'session',
      });

      addTestResult(`✅ API key saved: ${credential.masked}`);

      // Test loading credentials
      const credentials = await credentialService.loadCredentials();
      addTestResult(`✅ Credentials loaded: ${Object.keys(credentials).length} providers`);

      // Test deleting credential
      await credentialService.deleteCredential('openai');
      addTestResult('✅ API key deleted successfully');

    } catch (error) {
      addTestResult(`❌ API key test failed: ${error}`);
    }
  };

  const testChatHeaders = async () => {
    try {
      if (!user) {
        addTestResult('❌ No guest user available');
        return;
      }

      // Simulate a chat request with guest headers
      const headers = getAuthHeaders();
      const mockChatRequest = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello from guest mode!' }],
          userId: user.id,
          isAuthenticated: false,
          model: 'gpt-4o-mini',
        }),
      };

      addTestResult('✅ Chat request headers prepared');
      addTestResult(`✅ User ID: ${user.id}`);
      addTestResult(`✅ Session ID: ${session?.sessionId}`);
      addTestResult(`✅ Headers: ${JSON.stringify(headers)}`);

    } catch (error) {
      addTestResult(`❌ Chat headers test failed: ${error}`);
    }
  };

  const testStorageStats = () => {
    try {
      const stats = guestSettings.getStorageStats();
      addTestResult(`✅ Storage stats: ${stats.totalSize} bytes total`);
      addTestResult(`   - Settings: ${stats.settingsSize} bytes`);
      addTestResult(`   - API Keys Meta: ${stats.apiKeysMetaSize} bytes`);
    } catch (error) {
      addTestResult(`❌ Storage stats test failed: ${error}`);
    }
  };

  const runAllTests = async () => {
    setTestResults([]);
    addTestResult('🚀 Starting guest mode tests...');

    await testGuestAuth();
    await testSettings();
    await testApiKeyManagement();
    await testChatHeaders();
    testStorageStats();

    addTestResult('✅ All tests completed!');
  };

  const clearAllData = () => {
    clearGuestData();
    guestSettings.clearAllData();
    setSettings(null);
    setTestResults([]);
    addTestResult('🗑️ All guest data cleared');
  };

  if (isLoading) {
    return <div>Loading guest mode demo...</div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Guest Mode Demo & Test</CardTitle>
          <CardDescription>
            Test all guest mode functionality without requiring authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Guest Mode Status</Label>
              <p className="text-sm text-muted-foreground">
                {isGuestMode ? '✅ Active' : '❌ Inactive'}
              </p>
            </div>
            <div>
              <Label>User ID</Label>
              <p className="text-sm text-muted-foreground font-mono">
                {user?.id || 'None'}
              </p>
            </div>
          </div>

          {settings && (
            <div>
              <Label>Current Settings</Label>
              <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                {JSON.stringify(settings, null, 2)}
              </pre>
            </div>
          )}

          <Separator />

          {/* Test Controls */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-api-key">Test API Key (for API key management test)</Label>
              <Input
                id="test-api-key"
                type="password"
                value={testApiKey}
                onChange={(e) => setTestApiKey(e.target.value)}
                placeholder="sk-test-key-for-demo"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={testGuestAuth} variant="outline">
                Test Guest Auth
              </Button>
              <Button onClick={testSettings} variant="outline">
                Test Settings
              </Button>
              <Button onClick={testApiKeyManagement} variant="outline">
                Test API Keys
              </Button>
              <Button onClick={testChatHeaders} variant="outline">
                Test Chat Headers
              </Button>
              <Button onClick={runAllTests} className="bg-green-600 hover:bg-green-700">
                Run All Tests
              </Button>
              <Button onClick={clearAllData} variant="destructive">
                Clear All Data
              </Button>
            </div>
          </div>

          <Separator />

          {/* Test Results */}
          <div>
            <Label>Test Results</Label>
            <div className="bg-black text-green-400 p-4 rounded-md mt-2 h-64 overflow-y-auto font-mono text-sm">
              {testResults.length === 0 ? (
                <p className="text-gray-500">Run tests to see results...</p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="mb-1">
                    {result}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}