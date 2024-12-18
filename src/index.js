"use strict";

const { performance, monitorEventLoopDelay } = require("perf_hooks");
const { setInterval, clearInterval } = global;

const MB = 1024 * 1024;

const defaultConfig = {
  enableLag: true,
  enableMemory: true,
  enableLatency: true,
  metricsRoute: "/metrics",
  standalone: false,
  sampleInterval: 2000,
  alertThresholds: {
    lag: 200,
    memory: 500 * MB,
    latency: 1000
  },
  logger: console
};

class PerfMon {
  constructor(options = {}) {
    this.config = mergeConfig(defaultConfig, options);
    this.metrics = {
      eventLoopLag: 0,
      memory: formatMemory(process.memoryUsage()),
      uptime: process.uptime(),
      latency: {
        lastRequest: null,
        average: 0,
        totalRequests: 0,
        perRoute: {}
      }
    };
    this.loopMonitor = null;
    this.timers = [];
    this.startedAt = performance.now();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.startedAt = performance.now();

    if (this.config.enableLag) {
      this.loopMonitor = monitorEventLoopDelay({ resolution: 20 });
      this.loopMonitor.enable();
      const lagTimer = setInterval(() => {
        const lagNs = this.loopMonitor.mean;
        const lagMs = Number((lagNs / 1e6).toFixed(2));
        this.metrics.eventLoopLag = lagMs;
        this.loopMonitor.reset();
        if (
          this.config.alertThresholds.lag &&
          lagMs > this.config.alertThresholds.lag
        ) {
          this.logWarning(
            `Event loop lag: ${lagMs}ms (threshold ${this.config.alertThresholds.lag}ms)`
          );
        }
      }, this.config.sampleInterval);
      lagTimer.unref?.();
      this.timers.push(lagTimer);
    }

    if (this.config.enableMemory) {
      const memoryTimer = setInterval(() => {
        const usage = formatMemory(process.memoryUsage());
        this.metrics.memory = usage;
        if (
          this.config.alertThresholds.memory &&
          usage.heapUsed > this.config.alertThresholds.memory
        ) {
          this.logWarning(
            `High memory usage: ${(usage.heapUsed / MB).toFixed(1)}MB (threshold ${(
              this.config.alertThresholds.memory / MB
            ).toFixed(1)}MB)`
          );
        }
      }, this.config.sampleInterval);
      memoryTimer.unref?.();
      this.timers.push(memoryTimer);
    }
  }

  stop() {
    if (!this.isRunning) {
      return;
    }
    this.timers.forEach(clearInterval);
    this.timers = [];
    if (this.loopMonitor) {
      this.loopMonitor.disable();
      this.loopMonitor = null;
    }
    this.isRunning = false;
  }

  getMetrics() {
    return {
      uptime: Number((process.uptime()).toFixed(2)),
      eventLoopLag: this.metrics.eventLoopLag,
      memory: this.metrics.memory,
      latency: this.metrics.latency
    };
  }

  createMiddleware() {
    this.start();

    const monitor = this;

    return function perfMonMiddleware(req, res, next) {
      const routeKey = buildRouteKey(req);
      const startTime = monitor.config.enableLatency ? performance.now() : 0;

      if (monitor.config.metricsRoute && isMetricsRequest(req, monitor.config.metricsRoute)) {
        const body = JSON.stringify(monitor.getMetrics());
        res.statusCode = res.statusCode || 200;
        res.setHeader?.("Content-Type", "application/json");
        if (typeof res.end === "function") {
          res.end(body);
          return;
        }
      }

      if (monitor.config.enableLatency && res && typeof res.once === "function") {
        let recorded = false;
        const recordLatency = () => {
          if (recorded) {
            return;
          }
          recorded = true;
          const duration = Number((performance.now() - startTime).toFixed(2));
          monitor.metrics.latency.lastRequest = {
            route: routeKey,
            duration
          };
          monitor.metrics.latency.totalRequests += 1;
          const total = monitor.metrics.latency.average * (monitor.metrics.latency.totalRequests - 1) + duration;
          monitor.metrics.latency.average = Number((total / monitor.metrics.latency.totalRequests).toFixed(2));
          if (!monitor.metrics.latency.perRoute[routeKey]) {
            monitor.metrics.latency.perRoute[routeKey] = {
              count: 0,
              average: 0
            };
          }
          const routeMetrics = monitor.metrics.latency.perRoute[routeKey];
          routeMetrics.count += 1;
          routeMetrics.average = Number(
            (
              (routeMetrics.average * (routeMetrics.count - 1) + duration) /
              routeMetrics.count
            ).toFixed(2)
          );

          if (
            monitor.config.alertThresholds.latency &&
            duration > monitor.config.alertThresholds.latency
          ) {
            monitor.logWarning(
              `Slow request detected (${routeKey}): ${duration}ms (threshold ${monitor.config.alertThresholds.latency}ms)`
            );
          }
        };

        res.once("finish", recordLatency);
        res.once("close", recordLatency);
      }

      if (typeof next === "function") {
        return next();
      }

      return undefined;
    };
  }

  logWarning(message) {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const prefix = "\x1b[33m[perfmon-lite]\x1b[0m";
    this.config.logger.warn
      ? this.config.logger.warn(`${prefix} ${message}`)
      : this.config.logger.log(`${prefix} ${message}`);
  }
}

function perfMon(options = {}) {
  const monitor = new PerfMon(options);

  if (monitor.config.standalone) {
    return monitor;
  }

  const middleware = monitor.createMiddleware();
  middleware.start = () => monitor.start();
  middleware.stop = () => monitor.stop();
  middleware.metrics = () => monitor.getMetrics();
  middleware.monitor = monitor;

  return middleware;
}

function mergeConfig(defaults, overrides) {
  const result = { ...defaults, ...overrides };
  result.alertThresholds = {
    ...defaults.alertThresholds,
    ...(overrides.alertThresholds || {})
  };
  return result;
}

function formatMemory(usage) {
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers
  };
}

function buildRouteKey(req) {
  const method = req.method || "GET";
  const url = typeof req.originalUrl === "string" ? req.originalUrl : req.url || "/";
  const path = url.split("?")[0];
  return `${method.toUpperCase()} ${path}`;
}

function isMetricsRequest(req, metricsRoute) {
  if (!req || !req.url) {
    return false;
  }
  const method = (req.method || "GET").toUpperCase();
  if (method !== "GET") {
    return false;
  }
  const path = (req.url.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  const expected = metricsRoute.replace(/\/+$/, "") || "/";
  return path === expected;
}

module.exports = {
  perfMon,
  PerfMon
};

module.exports.default = perfMon;
module.exports.__esModule = true;
