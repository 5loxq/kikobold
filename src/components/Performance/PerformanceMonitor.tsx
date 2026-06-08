/**
 * Performance Monitor Component
 * 
 * Displays real-time performance metrics for the inference engine
 */

import React, { useEffect, useState } from 'react';
import { useInferencePerformance } from '../../hooks/useEnhancedInference';
import { metricsCollector, memoryManager, PERFORMANCE_CONFIG } from '../../services/inference';
import { formatFileSize } from '../../services/model-config';

interface PerformanceMonitorProps {
    className?: string;
    showMemory?: boolean;
    showTokens?: boolean;
    showLatency?: boolean;
}

interface PerformanceMetrics {
    tokensPerSecond: number;
    averageInferenceTime: number;
    totalTokensGenerated: number;
    uptime: number;
}

interface MemoryMetrics {
    usedMB: number;
    totalMB: number;
    availableMB: number;
    usagePercent: number;
    isCritical: boolean;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
    className = '',
    showMemory = true,
    showTokens = true,
    showLatency = true,
}) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        tokensPerSecond: 0,
        averageInferenceTime: 0,
        totalTokensGenerated: 0,
        uptime: 0,
    });
    
    const [memory, setMemory] = useState<MemoryMetrics>({
        usedMB: 0,
        totalMB: 0,
        availableMB: 0,
        usagePercent: 0,
        isCritical: false,
    });

    const [isVisible, setIsVisible] = useState(false);

    // Update metrics every second
    useEffect(() => {
        const updateMetrics = async () => {
            try {
                // Get performance metrics
                const perfMetrics = metricsCollector.getMetrics();
                setMetrics({
                    tokensPerSecond: perfMetrics.averageTokensPerSecond || 0,
                    averageInferenceTime: metricsCollector.getAverageInferenceTime(),
                    totalTokensGenerated: perfMetrics.totalTokensGenerated || 0,
                    uptime: perfMetrics.uptime || 0,
                });

                // Get memory metrics
                const memoryUsage = await memoryManager.getCurrentUsage();
                setMemory({
                    usedMB: memoryUsage.usedMB,
                    totalMB: memoryUsage.totalMB,
                    availableMB: memoryUsage.availableMB,
                    usagePercent: memoryUsage.usagePercent,
                    isCritical: memoryUsage.isCritical,
                });
            } catch {
                // Ignore errors
            }
        };

        // Initial update
        updateMetrics();

        // Set up interval
        const interval = setInterval(updateMetrics, 1000);

        return () => clearInterval(interval);
    }, []);

    // Format time duration
    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
    };

    // Format tokens per second
    const formatTokensPerSecond = (tps: number): string => {
        if (tps === 0) return '0';
        if (tps < 10) return tps.toFixed(1);
        return Math.round(tps).toString();
    };

    // Get memory color based on usage
    const getMemoryColor = (): string => {
        if (memory.usagePercent > PERFORMANCE_CONFIG.MEMORY_CRITICAL_THRESHOLD) {
            return 'text-red-500';
        }
        if (memory.usagePercent > PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD) {
            return 'text-yellow-500';
        }
        return 'text-green-500';
    };

    // Get tokens per second color
    const getTokensColor = (): string => {
        if (metrics.tokensPerSecond > 50) return 'text-green-500';
        if (metrics.tokensPerSecond > 20) return 'text-blue-500';
        if (metrics.tokensPerSecond > 10) return 'text-yellow-500';
        return 'text-red-500';
    };

    // Get latency color
    const getLatencyColor = (): string => {
        if (metrics.averageInferenceTime < 100) return 'text-green-500';
        if (metrics.averageInferenceTime < 500) return 'text-blue-500';
        if (metrics.averageInferenceTime < 1000) return 'text-yellow-500';
        return 'text-red-500';
    };

    // Format uptime
    const formatUptime = (ms: number): string => {
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
        return `${(ms / 3600000).toFixed(1)}h`;
    };

    return (
        <div className={`fixed bottom-4 right-4 bg-background/90 backdrop-blur-md rounded-lg shadow-lg p-4 ${className}`}>
            <button
                onClick={() => setIsVisible(!isVisible)}
                className="flex items-center justify-between w-full text-sm font-medium text-foreground mb-2"
            >
                <span>⚡ Performance Monitor</span>
                <span>{isVisible ? '▲' : '▼'}</span>
            </button>

            {isVisible && (
                <div className="space-y-2 text-xs">
                    {showTokens && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Tokens/sec</span>
                                <span className={`font-bold ${getTokensColor()}`}>
                                    {formatTokensPerSecond(metrics.tokensPerSecond)}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Total Tokens</span>
                                <span className="font-bold text-foreground">
                                    {metrics.totalTokensGenerated.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}

                    {showLatency && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Avg Latency</span>
                                <span className={`font-bold ${getLatencyColor()}`}>
                                    {formatDuration(metrics.averageInferenceTime)}
                                </span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-muted-foreground">Uptime</span>
                                <span className="font-bold text-foreground">
                                    {formatUptime(metrics.uptime)}
                                </span>
                            </div>
                        </div>
                    )}

                    {showMemory && (
                        <div className="flex flex-col gap-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Memory Usage</span>
                                <span className={`font-bold ${getMemoryColor()}`}>
                                    {formatFileSize(memory.usedMB * 1024 * 1024)} / {formatFileSize(memory.totalMB * 1024 * 1024)}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                    className={`bg-gradient-to-r from-blue-500 to-${getMemoryColor().split('-')[1]}-500 h-2 rounded-full`}
                                    style={{ width: `${Math.min(memory.usagePercent * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-muted-foreground text-[10px]">
                                <span>{Math.round(memory.usagePercent * 100)}%</span>
                                <span className={getMemoryColor()}>{
                                    memory.isCritical ? 'CRITICAL' : 
                                    memory.usagePercent > PERFORMANCE_CONFIG.MEMORY_WARNING_THRESHOLD ? 'WARNING' : 'OK'
                                }</span>
                            </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-border/50 text-center">
                        <button
                            onClick={() => {
                                metricsCollector.clear();
                                memoryManager.clear();
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Reset Metrics
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PerformanceMonitor;
