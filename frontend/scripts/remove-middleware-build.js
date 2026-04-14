#!/usr/bin/env node
// Remove middleware.js from build output to avoid node-module-in-edge-runtime in Docker.
var fs = require("fs");
var path = require("path");
[
  ".next/server/middleware.js",
  ".next/standalone/.next/server/middleware.js",
].forEach(function (p) {
  try {
    var full = path.join(__dirname, "..", p);
    if (fs.existsSync(full)) {
      fs.unlinkSync(full);
      console.log("Removed:", p);
    }
  } catch (e) {}
});
