import * as http from 'http';
export function startMockServer(port = 5050, regressionMode = false) {
    const server = http.createServer((req, res) => {
        // Healthy baseline: 20ms-45ms latency with rare 80ms spike
        // Regression mode: 75ms-140ms latency (triggers SLA failure)
        const baseDelay = regressionMode ? 85 : 25;
        const jitter = regressionMode ? Math.random() * 55 : Math.random() * 20;
        const totalDelay = Math.round(baseDelay + jitter);
        setTimeout(() => {
            // Simulate 0.5% transient error rate
            const isError = Math.random() < 0.005;
            if (isError) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
            }
            else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', data: { processedAt: Date.now() } }));
            }
        }, totalDelay);
    });
    server.listen(port);
    return server;
}
