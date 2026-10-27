export interface MetricSummary {
  p50: number; // Median
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

export interface PerformanceMetrics {
  timestamp: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number; // 0.0 to 1.0
  throughputRps: number;
  latencyMs: MetricSummary;
}

export interface SlaThresholds {
  maxErrorRate: number; // e.g. 0.01 (1%)
  maxP95DriftPercent: number; // e.g. 15.0 (+15% max acceptable regression)
  maxP99DriftPercent: number; // e.g. 20.0 (+20% max acceptable regression)
  hardMaxP95Ms?: number; // Absolute SLA ceiling (e.g. 250ms)
}

export interface MetricComparison {
  metricName: string;
  baseline: number;
  current: number;
  deltaPercent: number;
  breached: boolean;
  message: string;
}

export interface SlaEvaluationResult {
  passed: boolean;
  comparisons: MetricComparison[];
  currentMetrics: PerformanceMetrics;
  baselineMetrics?: PerformanceMetrics;
}