"use client";

import React from "react";
import { ThemeSelector } from "@/components/ui/theme-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Palette, Monitor, Zap } from "lucide-react";
import Link from "next/link";

export default function ThemesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Chat
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Palette className="w-6 h-6" />
              <h1 className="text-2xl font-bold">Theme Customization</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="w-5 h-5" />
                RoboRail Assistant UI Variants
              </CardTitle>
              <CardDescription>
                Choose from three carefully designed themes, each optimized for different use cases and environments.
                Each theme includes both light and dark mode variants with the interactive day/night switch.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <div className="w-3 h-3 rounded-full bg-[#03189B]"></div>
                  <div>
                    <div className="font-medium">HGG Professional</div>
                    <div className="text-sm text-muted-foreground">Corporate branding</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <div className="w-3 h-3 rounded-full bg-[#2D3748]"></div>
                  <div>
                    <div className="font-medium">Technical Industrial</div>
                    <div className="text-sm text-muted-foreground">High contrast</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-lg border">
                  <div className="w-3 h-3 rounded-full bg-[#1a1a1a]"></div>
                  <div>
                    <div className="font-medium">Modern Minimalist</div>
                    <div className="text-sm text-muted-foreground">Clean & minimal</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Professional Theming
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Each theme follows design system principles with consistent color palettes, typography, and spacing.
                </p>
                <div className="space-y-2">
                  <Badge variant="secondary">Color Variables</Badge>
                  <Badge variant="secondary">Typography Scale</Badge>
                  <Badge variant="secondary">Component Styling</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Monitor className="w-5 h-5" />
                  Dark Mode Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Animated day/night switch with smooth transitions and proper contrast ratios for accessibility.
                </p>
                <div className="space-y-2">
                  <Badge variant="secondary">Smooth Transitions</Badge>
                  <Badge variant="secondary">WCAG Compliant</Badge>
                  <Badge variant="secondary">System Preference</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Framer Motion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Enhanced with Framer Motion animations for smooth interactions and delightful user experience.
                </p>
                <div className="space-y-2">
                  <Badge variant="secondary">Smooth Animations</Badge>
                  <Badge variant="secondary">Gesture Support</Badge>
                  <Badge variant="secondary">Layout Animations</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Theme Selector */}
          <ThemeSelector />
          
          {/* Implementation Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Implementation Details</CardTitle>
              <CardDescription>
                Technical information about the theme system implementation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Technologies Used</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Next.js 15 with App Router</li>
                    <li>• TailwindCSS 4 with CSS variables</li>
                    <li>• Framer Motion for animations</li>
                    <li>• next-themes for theme management</li>
                    <li>• Radix UI for accessible components</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Features Implemented</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>• Three distinct UI variants</li>
                    <li>• Animated day/night switch</li>
                    <li>• Persistent theme preferences</li>
                    <li>• Resumable streams integration</li>
                    <li>• Comprehensive testing setup</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}