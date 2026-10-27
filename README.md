# ⚡ perf-guard

[![CI](https://github.com/AhmedHoussou/perf-guard/actions/workflows/ci.yml/badge.svg)](https://github.com/AhmedHoussou/perf-guard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Automated Performance SLA & Latency Regression Gatekeeper for CI/CD Pipelines.

`perf-guard` executes concurrent virtual-user load tests against target HTTP endpoints, tracks percentile latency ($p50$, $p90$, $p95$, $p99$) and error rates, compares runtime performance against committed historical baselines, and automatically fails builds when latency drifts beyond defined SLA thresholds.

---

## 🎯 The Problem

Automated functional E2E tests only verify that a feature returns `200 OK`. They cannot catch:
* Database query regressions causing $p95$ response times to climb from 50ms to 450ms.
* CPU-heavy middleware blocking the event loop under concurrent load.
* Upstream microservice degradation degrading throughput before code reaches production.

`perf-guard` brings non-functional automated gating directly into your pull requests.

---

## 🏗️ Architecture

```text
[Pull Request / CI Run]
           │
           ▼
   [perf-guard Engine]
           │
           ├─► Executes concurrent load (VUs over configurable duration)
           ├─► Calculates throughput (RPS), error rates, and percentiles (p50, p90, p95, p99)
           │
           ▼
[SLA Drift Evaluator]
           │
           ├─► Reads committed baseline (perf-baseline.json)
           ├─► Computes latency delta: ((current - baseline) / baseline) * 100
           │
           ▼
[Pipeline Decision]
   ├── p95/p99 Drift <= SLA Threshold ──► [PASS: Exit Code 0]
   └── p95/p99 Drift >  SLA Threshold ──► [FAIL: Exit Code 1 (Blocks Merge)]
```

---

## 🚀 Quick Start

### Installation

```bash
git clone [https://github.com/AhmedHoussou/perf-guard.git](https://github.com/AhmedHoussou/perf-guard.git)
cd perf-guard
npm install
npm run build
```

### Run Locally with Built-in Mock Server

```bash
# Healthy baseline execution (PASS)
node dist/cli.js --mock

# Simulated upstream degradation (SLA BREACH & FAIL)
node dist/cli.js --mock --simulate-regression
```

### Run Against a Target Environment

```bash
node dist/cli.js \
  --target [https://api.staging.example.com/health](https://api.staging.example.com/health) \
  --baseline perf-baseline.json \
  --users 25 \
  --duration 10 \
  --max-p95-drift 15 \
  --max-p99-drift 20
```

---

## ⚙️ CLI Options

| Flag | Argument | Description | Default |
| :--- | :--- | :--- | :--- |
| `-t, --target` | `<url>` | Target HTTP endpoint URL | `http://localhost:5050` |
| `-b, --baseline` | `<path>` | Path to baseline metrics JSON | `perf-baseline.json` |
| `-u, --users` | `<int>` | Concurrent virtual users (workers) | `15` |
| `-d, --duration` | `<sec>` | Test duration in seconds | `4` |
| `--max-p95-drift` | `<percent>`| Max allowed $p95$ latency increase | `15` (%) |
| `--max-p99-drift` | `<percent>`| Max allowed $p99$ latency increase | `20` (%) |
| `--mock` | *None* | Starts built-in server with realistic jitter | `false` |
| `--simulate-regression` | *None* | Injects server latency to test CI failure gating | `false` |
| `--update-baseline` | *None* | Persists current passing metrics as new baseline | `false` |

---

## 🔄 CI/CD Pipeline Integration

Add `perf-guard` to `.github/workflows/perf-gate.yml` to block pull requests introducing performance regressions:

```yaml
name: Performance SLA Gate

on:
  pull_request:
    branches: [ main ]

jobs:
  performance-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci
      - run: npm run build

      - name: Enforce Performance SLAs
        run: node dist/cli.js --mock --max-p95-drift 15 --max-p99-drift 20
```

---

## 📄 License

MIT