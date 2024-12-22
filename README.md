# perfmon-lite

Lightweight, zero-dependency performance monitoring middleware for Node.js servers. `perfmon-lite` gives you real-time insight into the event loop, memory usage, and request latency without introducing heavy instrumentation or complex setup.

## Features

- Event loop lag tracking powered by `perf_hooks.monitorEventLoopDelay`
- Memory sampling with configurable warnings for high heap usage
- Request latency measurement with per-route averages
- Optional `/metrics` JSON endpoint for dashboards and health checks
- Works with Express, Fastify, Koa (via middleware) or plain HTTP servers
- No runtime dependencies; compatible with Node.js 16 and newer

## Installation

```bash
npm install perfmon-lite
```

## Quick Start (Express)

```js
const express = require("express");
const { perfMon } = require("perfmon-lite");

const app = express();

app.use(
  perfMon({
    enableLag: true,
    enableMemory: true,
    enableLatency: true,
    metricsRoute: "/metrics",
    alertThresholds: {
      lag: 120,
      memory: 350 * 1024 * 1024,
      latency: 750
    }
  })
);

app.get("/hello", (req, res) => {
  res.json({ message: "world" });
});

app.listen(3000, () => {
  console.log("Server listening on http://localhost:3000");
});
```

Visit `http://localhost:3000/metrics` to inspect the metrics endpoint. During development, warnings are logged to the console whenever a threshold is exceeded.

## Standalone Mode

Need monitoring without middleware? Set `standalone: true` to manage the lifecycle manually:

```js
const { perfMon } = require("perfmon-lite");

const monitor = perfMon({ standalone: true });
monitor.start();

setInterval(() => {
  console.log(monitor.getMetrics());
}, 2000);
```

## Configuration

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enableLag` | boolean | `true` | Track event loop lag |
| `enableMemory` | boolean | `true` | Sample memory usage |
| `enableLatency` | boolean | `true` | Measure per-request latency |
| `metricsRoute` | string&#124;null | `"/metrics"` | If provided, respond with JSON metrics when the path matches |
| `standalone` | boolean | `false` | Return a monitor instance instead of middleware |
| `sampleInterval` | number | `2000` | Sampling interval (ms) for lag and memory |
| `alertThresholds.lag` | number | `200` | Warn when lag exceeds N ms |
| `alertThresholds.memory` | number | `500 * 1024 * 1024` | Warn when heap used exceeds N bytes |
| `alertThresholds.latency` | number | `1000` | Warn when request latency exceeds N ms |
| `logger` | object | `console` | Replace with a custom logger (`warn`/`log`) |

## Metrics

`perfmon-lite` exposes the following metrics through `monitor.getMetrics()` and the `/metrics` endpoint:

```json
{
  "uptime": 123.45,
  "eventLoopLag": 7.8,
  "memory": {
    "rss": 123456789,
    "heapTotal": 98765432,
    "heapUsed": 55555555,
    "external": 11111111,
    "arrayBuffers": 2222222
  },
  "latency": {
    "lastRequest": {
      "route": "GET /hello",
      "duration": 45.1
    },
    "average": 32.9,
    "totalRequests": 18,
    "perRoute": {
      "GET /hello": {
        "count": 18,
        "average": 32.9
      }
    }
  }
}
```

## Examples

The repository includes `/examples/express-demo.js` with a runnable Express server showcasing middleware integration and live metrics.

## Testing

Run the bundled unit tests using the Node.js test runner:

```bash
npm test
```

## License

MIT © Haresh Vidja
