/**
 * Chat UI Performance Monitor
 * Tracks key performance metrics for the chat interface
 */

import { useEffect } from 'react';

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface RenderMetrics {
  messageCount: number;
  renderTime: number;
  reRenderCount: number;
  memoryUsage: number;
}

class ChatPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private renderCounts = new Map<string, number>();
  private lastRenderTime = new Map<string, number>();

  /**
   * Track render performance for a component
   */
  trackRender(componentName: string, messageCount: number = 0): void {
    const now = performance.now();
    const renderCount = (this.renderCounts.get(componentName) || 0) + 1;
    this.renderCounts.set(componentName, renderCount);

    const lastRender = this.lastRenderTime.get(componentName) || now;
    const timeSinceLastRender = now - lastRender;
    this.lastRenderTime.set(componentName, now);

    this.addMetric('component_render', timeSinceLastRender, {
      componentName,
      messageCount,
      renderCount,
    });

    // Log excessive re-renders
    if (renderCount > 10 && timeSinceLastRender < 100) {
    }
  }

  /**
   * Track streaming performance
   */
  trackStreaming(
    eventType: 'start' | 'chunk' | 'complete',
    metadata?: Record<string, any>
  ): void {
    this.addMetric(`streaming_${eventType}`, performance.now(), metadata);
  }

  /**
   * Track memory usage
   */
  trackMemoryUsage(componentName: string): void {
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      this.addMetric('memory_usage', memInfo.usedJSHeapSize, {
        componentName,
        totalHeapSize: memInfo.totalJSHeapSize,
        heapSizeLimit: memInfo.jsHeapSizeLimit,
      });
    }
  }

  /**
   * Track animation performance
   */
  trackAnimation(animationName: string, duration: number): void {
    this.addMetric('animation_duration', duration, { animationName });

    if (duration > 16.67) {
    }
  }

  /**
   * Track bundle loading performance
   */
  trackBundleLoad(bundleName: string, loadTime: number): void {
    this.addMetric('bundle_load', loadTime, { bundleName });
  }

  private addMetric(
    name: string,
    value: number,
    metadata?: Record<string, any>
  ): void {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      metadata,
    });

    // Keep only recent metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageRenderTime: number;
    totalRenders: number;
    slowestComponent: string;
    memoryTrend: string;
    recommendations: string[];
  } {
    const renderMetrics = this.metrics.filter(
      (m) => m.name === 'component_render'
    );
    const memoryMetrics = this.metrics.filter((m) => m.name === 'memory_usage');

    const avgRenderTime =
      renderMetrics.length > 0
        ? renderMetrics.reduce((sum, m) => sum + m.value, 0) /
          renderMetrics.length
        : 0;

    const componentRenderCounts = new Map<string, number>();
    renderMetrics.forEach((metric) => {
      const componentName = metric.metadata?.componentName || 'unknown';
      componentRenderCounts.set(
        componentName,
        (componentRenderCounts.get(componentName) || 0) + 1
      );
    });

    const slowestComponent =
      Array.from(componentRenderCounts.entries()).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0] || 'none';

    const recommendations: string[] = [];

    if (avgRenderTime > 16) {
      recommendations.push(
        'Consider memoizing components to reduce render time'
      );
    }

    if (componentRenderCounts.size > 0) {
      const maxRenders = Math.max(...componentRenderCounts.values());
      if (maxRenders > 20) {
        recommendations.push(
          'Some components are re-rendering excessively. Check dependency arrays.'
        );
      }
    }

    if (memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1]?.value || 0;
      const earliestMemory = memoryMetrics[0]?.value || 0;
      const memoryTrend =
        latestMemory > earliestMemory * 1.5 ? 'increasing' : 'stable';

      if (memoryTrend === 'increasing') {
        recommendations.push(
          'Memory usage is increasing. Check for memory leaks.'
        );
      }

      return {
        averageRenderTime: Math.round(avgRenderTime * 100) / 100,
        totalRenders: renderMetrics.length,
        slowestComponent,
        memoryTrend,
        recommendations,
      };
    }

    return {
      averageRenderTime: Math.round(avgRenderTime * 100) / 100,
      totalRenders: renderMetrics.length,
      slowestComponent,
      memoryTrend: 'unknown',
      recommendations,
    };
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.renderCounts.clear();
    this.lastRenderTime.clear();
  }
}

// Singleton instance
export const chatPerformanceMonitor = new ChatPerformanceMonitor();

/**
 * React hook for tracking component renders
 */
export function usePerformanceTracking(
  componentName: string,
  dependencies?: any[]
) {
  const startTime = performance.now();

  useEffect(() => {
    const endTime = performance.now();
    chatPerformanceMonitor.trackRender(
      componentName,
      dependencies?.length || 0
    );
    chatPerformanceMonitor.trackAnimation(
      `${componentName}_mount`,
      endTime - startTime
    );
  });

  useEffect(() => {
    chatPerformanceMonitor.trackMemoryUsage(componentName);
  }, dependencies);
}

// Only enable in development
export const performanceEnabled = process.env.NODE_ENV === 'development';
