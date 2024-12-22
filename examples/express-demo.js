"use strict";

/**
 * Example Express integration for perfmon-lite.
 *
 * To run locally:
 *   npm install express
 *   node examples/express-demo.js
 */

const express = require("express");
const { perfMon } = require("perfmon-lite");

const app = express();

app.use(
  perfMon({
    alertThresholds: {
      lag: 150,
      memory: 400 * 1024 * 1024,
      latency: 750
    }
  })
);

app.get("/slow", async (req, res) => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  res.json({ status: "ok", delay: 600 });
});

app.get("/fast", (req, res) => {
  res.json({ status: "fast" });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`perfmon-lite demo running on http://localhost:${port}`);
  console.log(`Metrics available at http://localhost:${port}/metrics`);
});
