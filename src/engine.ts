import * as fs from 'fs';
import * as path from 'path';
import {
  PerformanceMetrics,
  SlaThresholds,
  SlaEvaluationResult,
  MetricComparison,
} from './types.js';

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export async function runLoadTest(
  targetUrl: string,
  virtualUsers = 20,
  durationSeconds = 5
): Promise<PerformanceMetrics> {
  const latencies: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  const endTime = Date.now() + durationSeconds * 1000;
  const startTime = Date.now();

  async function worker() {
    while (Date.now() < endTime) {
      const reqStart = performance.now();
      try {
        const res = await fetch(targetUrl);
        const reqDuration = performance.now() - reqStart;
        latencies.push(reqDuration);

        if (res.ok) {
          successfulRequests++;
        } else {
          failedRequests++;
        }
      } catch {
        const reqDuration = performance.now() - reqStart;
        latencies.push(reqDuration);
        failedRequests++;
      }
    }
  }

  // Run workers concurrently
  const workers = Array.from({ length: virtualUsers }, () => worker());
  await Promise.all(workers);

  const totalDurationSec = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const total = latencies.length;
  const sum = latencies.reduce((acc, v) => acc + v, 0);

  return {
    timestamp: new Date().toISOString(),
    totalRequests: total,
    successfulRequests,
    failedRequests,
    errorRate: total > 0 ? failedRequests / total : 0,
    throughputRps: Math.round((total / totalDurationSec) * 10) / 10,
    latencyMs: {
      min: Math.round((latencies[0] || 0) * 10) / 10,
      max: Math.round((latencies[total - 1] || 0) * 10) / 10,
      avg: Math.round((sum / (total || 1)) * 10) / 10,
      p50: Math.round(calculatePercentile(latencies, 50) * 10) / 10,
      p90: Math.round(calculatePercentile(latencies, 90) * 10) / 10,
      p95: Math.round(calculatePercentile(latencies, 95) * 10) / 10,
      p99: Math.round(calculatePercentile(latencies, 99) * 10) / 10,
    },
  };
}

export function evaluateSla(
  current: PerformanceMetrics,
  baselinePath: string,
  thresholds: SlaThresholds
): SlaEvaluationResult {
  const comparisons: MetricComparison[] = [];
  let passed = true;

  const resolvedPath = path.resolve(process.cwd(), baselinePath);
  let baseline: PerformanceMetrics | undefined;

  if (fs.existsSync(resolvedPath)) {
    baseline = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  }

  // 1. Error Rate SLA Check
  const errorBreached = current.errorRate > thresholds.maxErrorRate;
  if (errorBreached) passed = false;

  comparisons.push({
    metricName: 'Error Rate',
    baseline: baseline ? baseline.errorRate * 100 : 0,
    current: Math.round(current.errorRate * 1000) / 10,
    deltaPercent: 0,
    breached: errorBreached,
    message: errorBreached
      ? `Error rate ${(current.errorRate * 100).toFixed(1)}% exceeds max allowed ${(thresholds.maxErrorRate * 100).toFixed(1)}%`
      : 'Within acceptable error ceiling',
  });

  // 2. Relative SLA Drift Checks against Baseline
  if (baseline) {
    // p95 drift check
    const p95Delta = ((current.latencyMs.p95 - baseline.latencyMs.p95) / baseline.latencyMs.p95) * 100;
    const p95Breached = p95Delta > thresholds.maxP95DriftPercent;
    if (p95Breached) passed = false;

    comparisons.push({
      metricName: 'p95 Latency',
      baseline: baseline.latencyMs.p95,
      current: current.latencyMs.p95,
      deltaPercent: Math.round(p95Delta * 10) / 10,
      breached: p95Breached,
      message: p95Breached
        ? `Regression of +${p95Delta.toFixed(1)}% exceeds allowed +${thresholds.maxP95DriftPercent}% SLA tolerance`
        : 'SLA target met',
    });

    // p99 drift check
    const p99Delta = ((current.latencyMs.p99 - baseline.latencyMs.p99) / baseline.latencyMs.p99) * 100;
    const p99Breached = p99Delta > thresholds.maxP99DriftPercent;
    if (p99Breached) passed = false;

    comparisons.push({
      metricName: 'p99 Latency',
      baseline: baseline.latencyMs.p99,
      current: current.latencyMs.p99,
      deltaPercent: Math.round(p99Delta * 10) / 10,
      breached: p99Breached,
      message: p99Breached
        ? `Regression of +${p99Delta.toFixed(1)}% exceeds allowed +${thresholds.maxP99DriftPercent}% SLA tolerance`
        : 'SLA target met',
    });
  }

  // 3. Absolute Hard Ceiling Check
  if (thresholds.hardMaxP95Ms && current.latencyMs.p95 > thresholds.hardMaxP95Ms) {
    passed = false;
    comparisons.push({
      metricName: 'p95 Hard Ceiling',
      baseline: thresholds.hardMaxP95Ms,
      current: current.latencyMs.p95,
      deltaPercent: 0,
      breached: true,
      message: `Absolute p95 ceiling breached: ${current.latencyMs.p95}ms > ${thresholds.hardMaxP95Ms}ms`,
    });
  }

  return {
    passed,
    comparisons,
    currentMetrics: current,
    baselineMetrics: baseline,
  };
}