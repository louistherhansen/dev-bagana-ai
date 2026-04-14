#!/usr/bin/env node
/**
 * Overwrite middleware.js in standalone .next with a safe stub.
 * Prevents __import_unsupported / node-module-in-edge-runtime crash at container start.
 */
var fs = require("fs");
var path = require("path");

var stub = 'module.exports={default:function(){return Promise.resolve({next:function(){return{};}});}};';
var dir = "/app/.next";

function walk(d) {
  try {
    var entries = fs.readdirSync(d, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === "middleware.js") {
        try {
          fs.writeFileSync(full, stub);
          console.error("[overwrite-middleware] overwrote:", full);
        } catch (err) {
          console.error("[overwrite-middleware] failed:", full, err.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") console.error("[overwrite-middleware] walk error:", err.message);
  }
}

if (fs.existsSync(dir)) walk(dir);
