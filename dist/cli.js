#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { runLoadTest, evaluateSla } from './engine.js';
import { printPerformanceReport } from './reporter.js';
import { startMockServer } from './server.js';
const program = new Command();
program
    .name('perf-guard')
    .description('Automated Performance SLA & Latency Regression Gatekeeper')
    .version('1.0.0')
    .option('-t, --target <url>', 'Target endpoint URL', 'http://localhost:5050')
    .option('-b, --baseline <path>', 'Path to baseline metrics JSON', 'perf-baseline.json')
    .option('-u, --users <number>', 'Number of concurrent virtual users', '15')
    .option('-d, --duration <seconds>', 'Duration of the load test in seconds', '4')
    .option('--max-p95-drift <percent>', 'Max allowed p95 drift percentage', '15')
    .option('--max-p99-drift <percent>', 'Max allowed p99 drift percentage', '20')
    .option('--mock', 'Spins up an internal mock server for instant local/CI execution', false)
    .option('--simulate-regression', 'Simulates upstream server degradation to verify CI failure gate', false)
    .option('--update-baseline', 'Overwrites baseline with current test metrics upon passing', false)
    .action(async (options) => {
    let mockServer = null;
    try {
        if (options.mock) {
            mockServer = startMockServer(5050, Boolean(options.simulateRegression));
        }
        console.log(`[PerfGuard] Target: ${options.target}`);
        console.log(`[PerfGuard] Executing load run (${options.users} VUs over ${options.duration}s)...`);
        const currentMetrics = await runLoadTest(options.target, Number(options.users), Number(options.duration));
        const evaluation = evaluateSla(currentMetrics, options.baseline, {
            maxErrorRate: 0.01,
            maxP95DriftPercent: Number(options.maxP95Drift),
            maxP99DriftPercent: Number(options.maxP99Drift),
        });
        printPerformanceReport(evaluation);
        if (options.updateBaseline && evaluation.passed) {
            const resolvedPath = path.resolve(process.cwd(), options.baseline);
            fs.writeFileSync(resolvedPath, JSON.stringify(currentMetrics, null, 2));
            console.log(`[PerfGuard] Updated baseline saved to: ${options.baseline}`);
        }
        if (mockServer) {
            mockServer.close();
        }
        process.exit(evaluation.passed ? 0 : 1);
    }
    catch (err) {
        if (mockServer) {
            mockServer.close();
        }
        console.error(`[PerfGuard] Error: ${err.message}`);
        process.exit(1);
    }
});
program.parse(process.argv);
