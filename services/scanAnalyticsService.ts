// Scan Analytics Service
// Tracks and analyzes check-in scanner performance

import { offlineSyncService } from './offlineSyncService';

interface ScanMetric {
  eventId: string;
  ticketId?: string;
  success: boolean;
  errorMessage?: string;
  duration: number;
  timestamp: number;
  scanMethod?: 'camera' | 'upload' | 'manual';
  deviceInfo?: {
    userAgent: string;
    platform: string;
    online: boolean;
  };
}

interface ScanAnalytics {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  successRate: number;
  averageScanTime: number;
  fastestScan: number;
  slowestScan: number;
  scansPerMinute: number;
  peakScanTime: string;
  errorBreakdown: { [key: string]: number };
  scansByMethod: { [key: string]: number };
}

class ScanAnalyticsService {
  private metricsBuffer: ScanMetric[] = [];
  private bufferFlushInterval = 30000; // 30 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startBufferFlush();
  }

  // Track a scan
  async trackScan(metric: Omit<ScanMetric, 'deviceInfo'>): Promise<void> {
    const fullMetric: ScanMetric = {
      ...metric,
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        online: navigator.onLine
      }
    };

    // Add to buffer
    this.metricsBuffer.push(fullMetric);

    // Save to IndexedDB immediately
    try {
      await offlineSyncService.saveScanAnalytics(fullMetric);
    } catch (error) {
      console.error('[Analytics] Failed to save metric:', error);
    }

    // Send to backend if online
    if (navigator.onLine) {
      this.sendMetricsToBackend([fullMetric]).catch(console.error);
    }
  }

  // Start automatic buffer flush
  private startBufferFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.bufferFlushInterval);
  }

  // Flush metrics buffer to backend
  private async flushBuffer(): Promise<void> {
    if (this.metricsBuffer.length === 0 || !navigator.onLine) {
      return;
    }

    const metricsToSend = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.sendMetricsToBackend(metricsToSend);
      console.log(`[Analytics] Flushed ${metricsToSend.length} metrics`);
    } catch (error) {
      console.error('[Analytics] Flush failed:', error);
      // Put back in buffer to retry
      this.metricsBuffer.push(...metricsToSend);
    }
  }

  // Send metrics to backend
  private async sendMetricsToBackend(metrics: ScanMetric[]): Promise<void> {
    try {
      const token = await import('./firebaseConfig').then(m => m.getAuthToken());
      
      const response = await fetch('/api/analytics/scan-metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ metrics })
      });

      if (!response.ok) {
        throw new Error(`Analytics upload failed: ${response.status}`);
      }
    } catch (error) {
      console.error('[Analytics] Backend upload failed:', error);
      throw error;
    }
  }

  // Get analytics for event
  async getAnalytics(eventId: string, timeRange?: {
    start: number;
    end: number;
  }): Promise<ScanAnalytics> {
    try {
      // Get from IndexedDB
      let scans = await offlineSyncService.getScanAnalytics(eventId);

      // Filter by time range if provided
      if (timeRange) {
        scans = scans.filter(scan => 
          scan.timestamp >= timeRange.start && 
          scan.timestamp <= timeRange.end
        );
      }

      return this.calculateAnalytics(scans);
    } catch (error) {
      console.error('[Analytics] Failed to get analytics:', error);
      return this.getEmptyAnalytics();
    }
  }

  // Calculate analytics from raw scans
  private calculateAnalytics(scans: ScanMetric[]): ScanAnalytics {
    if (scans.length === 0) {
      return this.getEmptyAnalytics();
    }

    const totalScans = scans.length;
    const successfulScans = scans.filter(s => s.success).length;
    const failedScans = totalScans - successfulScans;
    const successRate = (successfulScans / totalScans) * 100;

    // Calculate average scan time
    const durations = scans.map(s => s.duration);
    const averageScanTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const fastestScan = Math.min(...durations);
    const slowestScan = Math.max(...durations);

    // Calculate scans per minute
    const timeSpan = Math.max(...scans.map(s => s.timestamp)) - 
                     Math.min(...scans.map(s => s.timestamp));
    const scansPerMinute = (totalScans / (timeSpan / 60000)) || 0;

    // Find peak scan time
    const hourCounts = new Map<number, number>();
    scans.forEach(scan => {
      const hour = new Date(scan.timestamp).getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    });
    const peakHour = Array.from(hourCounts.entries())
      .reduce((a, b) => a[1] > b[1] ? a : b, [0, 0])[0];
    const peakScanTime = `${peakHour}:00`;

    // Error breakdown
    const errorBreakdown: { [key: string]: number } = {};
    scans.filter(s => !s.success).forEach(scan => {
      const error = scan.errorMessage || 'Unknown Error';
      errorBreakdown[error] = (errorBreakdown[error] || 0) + 1;
    });

    // Scans by method
    const scansByMethod: { [key: string]: number } = {};
    scans.forEach(scan => {
      const method = scan.scanMethod || 'unknown';
      scansByMethod[method] = (scansByMethod[method] || 0) + 1;
    });

    return {
      totalScans,
      successfulScans,
      failedScans,
      successRate: Math.round(successRate * 100) / 100,
      averageScanTime: Math.round(averageScanTime),
      fastestScan: Math.round(fastestScan),
      slowestScan: Math.round(slowestScan),
      scansPerMinute: Math.round(scansPerMinute * 100) / 100,
      peakScanTime,
      errorBreakdown,
      scansByMethod
    };
  }

  // Get empty analytics
  private getEmptyAnalytics(): ScanAnalytics {
    return {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      successRate: 0,
      averageScanTime: 0,
      fastestScan: 0,
      slowestScan: 0,
      scansPerMinute: 0,
      peakScanTime: 'N/A',
      errorBreakdown: {},
      scansByMethod: {}
    };
  }

  // Export analytics to CSV
  async exportToCSV(eventId: string): Promise<string> {
    const scans = await offlineSyncService.getScanAnalytics(eventId);
    
    const headers = ['Timestamp', 'Success', 'Duration (ms)', 'Ticket ID', 'Error', 'Method', 'Online'];
    const rows = scans.map(scan => [
      new Date(scan.timestamp).toISOString(),
      scan.success ? 'Yes' : 'No',
      scan.duration.toString(),
      scan.ticketId || 'N/A',
      scan.errorMessage || 'N/A',
      scan.scanMethod || 'N/A',
      scan.deviceInfo?.online ? 'Yes' : 'No'
    ]);

    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    return csv;
  }

  // Clear analytics for event
  async clearAnalytics(eventId: string): Promise<void> {
    // This would require a more sophisticated IndexedDB query
    console.log('[Analytics] Clear analytics not fully implemented yet');
  }

  // Stop buffer flush (cleanup)
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush remaining metrics
    this.flushBuffer();
  }
}

// Export singleton instance
export const scanAnalyticsService = new ScanAnalyticsService();
export default scanAnalyticsService;
