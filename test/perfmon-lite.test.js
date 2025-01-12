"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("events");

const { perfMon, PerfMon } = require("../src/index.js");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("returns middleware by default", async () => {
  const middleware = perfMon({ sampleInterval: 50, metricsRoute: null });
  assert.strictEqual(typeof middleware, "function");
  assert.strictEqual(typeof middleware.start, "function");
  assert.strictEqual(typeof middleware.stop, "function");
  middleware.stop();
});

test("supports standalone mode", async () => {
  const monitor = perfMon({ standalone: true, sampleInterval: 50 });
  assert.ok(monitor instanceof PerfMon);
  monitor.start();
  await delay(80);
  const metrics = monitor.getMetrics();
  assert.ok(typeof metrics.eventLoopLag === "number");
  monitor.stop();
});

test("captures latency metrics for a single request", async () => {
  const middleware = perfMon({ sampleInterval: 50 });

  const req = { method: "GET", url: "/hello" };
  const res = new EventEmitter();
  res.setHeader = () => {};
  res.end = () => {};

  middleware(req, res, () => {});
  res.emit("finish");

  const metrics = middleware.metrics();
  assert.strictEqual(metrics.latency.totalRequests, 1);
  assert.strictEqual(metrics.latency.lastRequest.route, "GET /hello");
  assert.ok(metrics.latency.lastRequest.duration >= 0);

  middleware.stop();
});

test("responds with JSON metrics when hitting metrics route", async () => {
  const middleware = perfMon({ sampleInterval: 50, metricsRoute: "/metrics" });

  const req = { method: "GET", url: "/metrics" };
  let body = "";
  const res = new EventEmitter();
  res.setHeader = () => {};
  res.end = (payload) => {
    body = payload;
  };

  middleware(req, res);
  assert.ok(body.length > 0);
  const parsed = JSON.parse(body);
  assert.ok(Object.prototype.hasOwnProperty.call(parsed, "uptime"));
  middleware.stop();
});

test("updates event loop lag metric over time", async () => {
  const middleware = perfMon({ sampleInterval: 50 });
  await delay(120);
  const metrics = middleware.metrics();
  assert.ok(metrics.eventLoopLag >= 0);
  middleware.stop();
});
