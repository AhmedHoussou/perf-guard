import pc from 'picocolors';
export function printPerformanceReport(result) {
    const { currentMetrics, comparisons, passed } = result;
    console.log('\n' + pc.bold(pc.cyan('━'.repeat(80))));
    console.log(pc.bold(pc.cyan(' ⚡ PERF-GUARD: Automated CI Performance & Latency SLA Report')));
    console.log(pc.bold(pc.cyan('━'.repeat(80))) + '\n');
    console.log(` ${pc.bold('Throughput:')} ${pc.yellow(`${currentMetrics.throughputRps} req/s`)} | ` +
        ` ${pc.bold('Total Req:')} ${pc.white(String(currentMetrics.totalRequests))} | ` +
        ` ${pc.bold('Failed:')} ${currentMetrics.failedRequests > 0 ? pc.red(String(currentMetrics.failedRequests)) : pc.green('0')}`);
    console.log(` ${pc.bold('Latency:')} p50: ${pc.cyan(`${currentMetrics.latencyMs.p50}ms`)} | ` +
        ` p90: ${pc.cyan(`${currentMetrics.latencyMs.p90}ms`)} | ` +
        ` p95: ${pc.cyan(`${currentMetrics.latencyMs.p95}ms`)} | ` +
        ` p99: ${pc.cyan(`${currentMetrics.latencyMs.p99}ms`)}\n`);
    console.log(pc.bold(' SLA Drift Analysis:'));
    console.log(pc.dim(' ─'.repeat(40)));
    for (const cmp of comparisons) {
        const badge = cmp.breached
            ? pc.bgRed(pc.white(' SLA BREACH '))
            : pc.bgGreen(pc.black(' SLA PASS '));
        const unit = cmp.metricName.includes('Rate') ? '%' : 'ms';
        const deltaSign = cmp.deltaPercent > 0 ? `+${cmp.deltaPercent}%` : `${cmp.deltaPercent}%`;
        const deltaColored = cmp.breached
            ? pc.red(deltaSign)
            : cmp.deltaPercent > 0
                ? pc.yellow(deltaSign)
                : pc.green(deltaSign);
        const deltaDisplay = cmp.metricName.includes('Rate') ? '' : `(${deltaColored})`;
        console.log(` ${badge} ${pc.bold(cmp.metricName.padEnd(16))} ` +
            `Baseline: ${pc.dim(`${cmp.baseline}${unit}`)} ➔ Current: ${pc.bold(`${cmp.current}${unit}`)} ` +
            deltaDisplay);
        if (cmp.breached) {
            console.log(`          ${pc.red('↳')} ${pc.red(cmp.message)}`);
        }
    }
    console.log('\n' + pc.bold(pc.cyan('━'.repeat(80))));
    const verdictBadge = passed
        ? pc.bgGreen(pc.black(pc.bold(' OVERALL STATUS: PASSED ')))
        : pc.bgRed(pc.white(pc.bold(' OVERALL STATUS: FAILED (PERFORMANCE REGRESSION DETECTED) ')));
    console.log(` ${verdictBadge}`);
    console.log(pc.bold(pc.cyan('━'.repeat(80))) + '\n');
}
