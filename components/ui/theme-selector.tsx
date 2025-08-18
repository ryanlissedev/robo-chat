"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DayNightSwitch } from "@/components/ui/day-night-switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type ThemeVariant = "hgg-professional" | "technical-industrial" | "modern-minimalist";

interface ThemeOption {
  id: ThemeVariant;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  features: string[];
  preview: string;
}

const themeOptions: ThemeOption[] = [
  {
    id: "hgg-professional",
    name: "HGG Professional",
    description: "Official HGG Group branding with professional blue and orange palette",
    colors: {
      primary: "#03189B",
      secondary: "#00AEEF", 
      accent: "#FF542D"
    },
    features: ["HGG Brand Colors", "Professional Shadows", "Gradient Buttons", "Corporate Feel"],
    preview: "Professional interface optimized for technical support and business use"
  },
  {
    id: "technical-industrial",
    name: "Technical Industrial",
    description: "High-contrast industrial theme for manufacturing environments",
    colors: {
      primary: "#2D3748",
      secondary: "#FF6B35",
      accent: "#F7931E"
    },
    features: ["High Contrast", "Status Indicators", "Industrial Colors", "Bold Typography"],
    preview: "Designed for shop floor and industrial control environments"
  },
  {
    id: "modern-minimalist",
    name: "Modern Minimalist", 
    description: "Clean, minimal design focused on content and readability",
    colors: {
      primary: "#1a1a1a",
      secondary: "#6b7280",
      accent: "#3b82f6"
    },
    features: ["Minimal Design", "Clean Typography", "Subtle Animations", "Focus on Content"],
    preview: "Streamlined interface for distraction-free technical support"
  }
];

interface ThemeSelectorProps {
  className?: string;
}

export function ThemeSelector({ className }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme();
  const [selectedVariant, setSelectedVariant] = React.useState<ThemeVariant>("hgg-professional");
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setIsDarkMode(theme === "dark");
  }, [theme]);

  const applyTheme = (variant: ThemeVariant, dark: boolean) => {
    const newTheme = dark ? "dark" : "light";
    setTheme(newTheme);
    setSelectedVariant(variant);
    setIsDarkMode(dark);
    
    // Apply theme variant class to document
    document.documentElement.classList.remove(
      "theme-hgg-professional",
      "theme-technical-industrial", 
      "theme-modern-minimalist"
    );
    document.documentElement.classList.add(`theme-${variant}`);
    
    // Store preference
    localStorage.setItem("theme-variant", variant);
  };

  const handleDarkModeToggle = (checked: boolean) => {
    applyTheme(selectedVariant, !checked); // checked=true means day mode, so !checked for dark mode
  };

  const handleVariantSelect = (variant: ThemeVariant) => {
    applyTheme(variant, isDarkMode);
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <Card className={cn("w-full max-w-4xl mx-auto", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-bold">RoboRail Assistant Themes</CardTitle>
            <CardDescription>
              Customize your interface with professional themes designed for technical support
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {isDarkMode ? "Dark" : "Light"} Mode
            </span>
            <DayNightSwitch
              defaultChecked={!isDarkMode}
              onToggle={handleDarkModeToggle}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedVariant} onValueChange={handleVariantSelect} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            {themeOptions.map((option) => (
              <TabsTrigger
                key={option.id}
                value={option.id}
                className="text-sm font-medium"
              >
                {option.name}
              </TabsTrigger>
            ))}
          </TabsList>
          
          <AnimatePresence mode="wait">
            {themeOptions.map((option) => (
              <TabsContent key={option.id} value={option.id} asChild>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="space-y-6">
                    {/* Theme Preview */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Color Palette</h3>
                        <div className="flex space-x-3 mb-4">
                          <div className="text-center">
                            <div
                              className="w-16 h-16 rounded-lg border-2 border-gray-200 mb-2"
                              style={{ backgroundColor: option.colors.primary }}
                            />
                            <span className="text-xs font-medium">Primary</span>
                          </div>
                          <div className="text-center">
                            <div
                              className="w-16 h-16 rounded-lg border-2 border-gray-200 mb-2"
                              style={{ backgroundColor: option.colors.secondary }}
                            />
                            <span className="text-xs font-medium">Secondary</span>
                          </div>
                          <div className="text-center">
                            <div
                              className="w-16 h-16 rounded-lg border-2 border-gray-200 mb-2"
                              style={{ backgroundColor: option.colors.accent }}
                            />
                            <span className="text-xs font-medium">Accent</span>
                          </div>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-4">
                          {option.description}
                        </p>
                        
                        <div className="flex flex-wrap gap-2">
                          {option.features.map((feature, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Preview</h3>
                        <div className="border rounded-lg p-4 bg-muted/30 min-h-[200px]">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="h-6 bg-primary/20 rounded w-32"></div>
                              <div className="h-4 bg-secondary/30 rounded w-16"></div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <div className="h-4 bg-muted-foreground/20 rounded w-full"></div>
                              <div className="h-4 bg-muted-foreground/20 rounded w-3/4"></div>
                              <div className="h-4 bg-accent/30 rounded w-1/2"></div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              <div 
                                className="h-8 rounded px-4 flex items-center text-xs font-medium text-white"
                                style={{ backgroundColor: option.colors.primary }}
                              >
                                Primary Button
                              </div>
                              <div 
                                className="h-8 rounded px-4 flex items-center text-xs font-medium border"
                                style={{ borderColor: option.colors.secondary }}
                              >
                                Secondary
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">
                          {option.preview}
                        </p>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between pt-4">
                      <div className="text-sm text-muted-foreground">
                        Theme will be applied immediately after selection
                      </div>
                      <Button
                        onClick={() => handleVariantSelect(option.id)}
                        className="font-medium"
                        style={{ 
                          backgroundColor: option.colors.primary,
                          borderColor: option.colors.primary
                        }}
                      >
                        Apply {option.name}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>
            ))}
          </AnimatePresence>
        </Tabs>
      </CardContent>
    </Card>
  );
}