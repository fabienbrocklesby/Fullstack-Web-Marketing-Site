#!/usr/bin/env node
/*
 * Bulk Activation Code Generator
 * --------------------------------
 * Generates one-time activation codes for gated customer registration.
 *
 * Usage examples:
 *   node backend/create-activation-codes.js --count 25
 *   node backend/create-activation-codes.js --count 100 --prefix LAUNCH- --length 10 --note "Early access" --out launch-codes.csv
 *   CMS_URL=https://cms.example.com node backend/create-activation-codes.js -c 50 -p BETA- -l 6
 *   node backend/create-activation-codes.js -c 20 --internal   # uses Strapi entityService directly (no HTTP)
 *
 * Options:
 *   --count, -c   Number of codes to generate (default: 10)
 *   --prefix, -p  Optional prefix added before each random segment (default: "")
 *   --length, -l  Length of random segment (default: 8)
 *   --note, -n    Optional note stored with each code
 *   --out, -o     Optional file path to write generated codes as CSV
 *   --dry-run     Generate & display codes without sending to Strapi
 *   --concurrent  Number of concurrent POSTs (default: 5)
 *   --internal    Use Strapi programmatic API (bypasses HTTP perms)
 *   --token       Admin/User API token for authenticated HTTP requests
 *   --help, -h    Show help
 *
 * Environment overrides:
 *   CMS_URL or STRAPI_URL  Base URL of Strapi (default: http://localhost:1337)
 *
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Very light arg parser (no external deps)
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    let a = argv[i];
    if (a === "--help" || a === "-h") {
      args.help = true;
      continue;
    }
    if (a === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    const long = a.startsWith("--");
    const short = !long && a.startsWith("-");
    if (long || short) {
      const key = a.replace(/^--?/, "");
      let next = argv[i + 1];
      if (!next || next.startsWith("-")) {
        args[key] = true;
        continue;
      }

      // Handle quoted multi-word values
      if (
        (next.startsWith('"') && !next.endsWith('"')) ||
        (next.startsWith("'") && !next.endsWith("'"))
      ) {
        const quoteChar = next[0];
        let collected = next.slice(1);
        i += 2; // move past initial value
        while (i < argv.length) {
          const part = argv[i];
          if (part.endsWith(quoteChar)) {
            collected += " " + part.slice(0, -1);
            break;
          } else {
            collected += " " + part;
            i++;
          }
        }
        args[key] = collected;
        continue;
      }
      // Strip surrounding quotes if both ends quoted
      if (
        (next.startsWith('"') && next.endsWith('"')) ||
        (next.startsWith("'") && next.endsWith("'"))
      ) {
        next = next.slice(1, -1);
      }
      args[key] = next;
      i++;
    }
  }
  return args;
}

function showHelp() {
  console.log(
    `\nBulk Activation Code Generator\n--------------------------------\nUsage: node backend/create-activation-codes.js [options]\n\nOptions:\n  --count, -c       Number of codes to generate (default: 10)\n  --prefix, -p      Optional prefix added before random segment (default: "")\n  --length, -l      Length of random segment (default: 8)\n  --note, -n        Optional note stored with each code\n  --out, -o         Output CSV file path (optional)\n  --dry-run         Only generate locally; do not POST to Strapi\n  --concurrent      Concurrent POSTs (default: 5) (HTTP mode only)\n  --internal        Use Strapi programmatic API (bypasses HTTP perms)\n  --token           Admin/User API token for authenticated HTTP requests\n  --help, -h        Show this help\n\nEnvironment:\n  CMS_URL or STRAPI_URL override the base CMS URL (default: http://localhost:1337)\n`,
  );
}

(async () => {
  const argv = parseArgs(process.argv);
  if (argv.help) {
    showHelp();
    process.exit(0);
  }

  const count = parseInt(argv.count || argv.c || "10", 10);
  const prefix = (argv.prefix || argv.p || "").toString();
  const length = parseInt(argv.length || argv.l || "8", 10);
  const note = argv.note || argv.n || "";
  const outFile = argv.out || argv.o;
  const dryRun = !!argv.dryRun;
  const internal = !!argv.internal;
  const token = argv.token || process.env.STRAPI_TOKEN || process.env.CMS_TOKEN;
  const concurrent = Math.max(1, parseInt(argv.concurrent || "5", 10));

  if (isNaN(count) || count <= 0) {
    console.error("❌ Invalid --count value");
    process.exit(1);
  }
  if (isNaN(length) || length <= 0) {
    console.error("❌ Invalid --length value");
    process.exit(1);
  }

  const BASE_URL = (
    process.env.CMS_URL ||
    process.env.STRAPI_URL ||
    "http://localhost:1337"
  ).replace(/\/$/, "");
  const endpoint = `${BASE_URL}/api/activation-codes`;

  console.log(`\n⚙️  Configuration:`);
  console.log(`   Count       : ${count}`);
  console.log(`   Prefix      : ${prefix || "(none)"}`);
  console.log(`   Length      : ${length}`);
  console.log(`   Note        : ${note || "(none)"}`);
  console.log(`   Base URL    : ${BASE_URL}`);
  console.log(`   Endpoint    : ${endpoint}`);
  console.log(`   Dry Run     : ${dryRun ? "YES" : "NO"}`);
  console.log(
    `   Mode        : ${internal ? "INTERNAL (entityService)" : "HTTP API"}`,
  );
  if (!internal) console.log(`   Concurrent  : ${concurrent}`);
  if (token && !internal)
    console.log(`   Auth Token  : (provided, length ${token.length})`);
  if (outFile) console.log(`   Output File : ${outFile}`);
  console.log("");

  // Character set (avoid visually ambiguous chars)
  const charset = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function randomSegment(len) {
    const bytes = crypto.randomBytes(len * 2); // oversample
    let result = "";
    for (let i = 0; i < bytes.length && result.length < len; i++) {
      result += charset[bytes[i] % charset.length];
    }
    return result;
  }

  const codes = Array.from({ length: count }, () => ({
    code: `${prefix}${randomSegment(length)}`,
    note,
  }));

  if (dryRun) {
    console.log("🧪 Dry run mode — generated codes (not sent to Strapi):");
    codes.forEach((c) => console.log(c.code));
  } else if (internal) {
    // Programmatic Strapi mode (no HTTP, respects full permissions)
    console.log("🔌 Starting Strapi (internal mode)...");
    process.chdir(__dirname); // ensure we are in backend folder for resolution
    const strapiExport = require("@strapi/strapi");
    let strapiInstanceFactory;
    if (typeof strapiExport === "function") {
      // Direct factory export
      strapiInstanceFactory = strapiExport;
    } else if (strapiExport.createStrapi) {
      strapiInstanceFactory = strapiExport.createStrapi;
    } else {
      throw new Error("Unable to locate Strapi factory export");
    }
    const strapi = await strapiInstanceFactory();
    if (typeof strapi.start === "function") await strapi.start();
    else if (typeof strapi.load === "function") await strapi.load();

    let created = 0;
    let skipped = 0;
    const failures = [];

    for (const entry of codes) {
      try {
        // Check if code exists (unique constraint would also catch it but this is more explicit)
        const existing = await strapi.entityService.findMany(
          "api::activation-code.activation-code",
          { filters: { code: entry.code }, limit: 1 },
        );
        if (existing.length) {
          skipped++;
          process.stdout.write("~");
          continue;
        }
        await strapi.entityService.create(
          "api::activation-code.activation-code",
          { data: entry },
        );
        created++;
        process.stdout.write("✓");
      } catch (err) {
        if (/unique|duplicate/i.test(err?.message)) {
          skipped++;
          process.stdout.write("~");
        } else {
          failures.push({ code: entry.code, error: err.message });
          process.stdout.write("✗");
        }
      }
    }

    console.log("\n");
    console.log(`   Created : ${created}`);
    console.log(`   Skipped : ${skipped}`);
    console.log(`   Failed  : ${failures.length}`);
    if (failures.length) {
      console.log("\n❌ Failures:");
      failures
        .slice(0, 10)
        .forEach((f) => console.log(`   ${f.code}: ${f.error}`));
      if (failures.length > 10)
        console.log(`   ...and ${failures.length - 10} more`);
    }

    await strapi.destroy();
  } else {
    console.log("🚀 Creating activation codes in Strapi...");

    // Lazy require node-fetch (works with ESM/CJS variations)
    const fetch =
      require("node-fetch").default || global.fetch || require("node-fetch");

    let created = 0;
    let skipped = 0;
    const failures = [];

    // Simple concurrency control
    async function worker(queue) {
      while (queue.length) {
        const entry = queue.shift();
        try {
          const headers = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ data: entry }),
          });

          if (res.ok) {
            created++;
            process.stdout.write(`✓`);
          } else {
            const txt = await res.text();
            if (res.status === 405) {
              // Provide a clear hint for user
              failures.push({
                code: entry.code,
                error:
                  "405 Method Not Allowed (enable create permission or use --internal)",
              });
              process.stdout.write("✗");
            } else if (/unique|duplicate/i.test(txt)) {
              skipped++;
              process.stdout.write("~");
            } else {
              failures.push({ code: entry.code, error: txt });
              process.stdout.write("✗");
            }
          }
        } catch (err) {
          failures.push({ code: entry.code, error: err.message });
          process.stdout.write("✗");
        }
      }
    }

    const queue = [...codes];
    const workers = Array.from(
      { length: Math.min(concurrent, queue.length) },
      () => worker(queue),
    );
    await Promise.all(workers);

    console.log("\n");
    console.log(`   Created : ${created}`);
    console.log(`   Skipped : ${skipped}`);
    console.log(`   Failed  : ${failures.length}`);

    if (failures.length) {
      console.log("\n❌ Failures:");
      failures
        .slice(0, 10)
        .forEach((f) => console.log(`   ${f.code}: ${f.error}`));
      if (failures.length > 10)
        console.log(`   ...and ${failures.length - 10} more`);
    }
  }

  if (outFile) {
    const lines = [
      "code,note",
      ...codes.map((c) => `${c.code},"${(c.note || "").replace(/"/g, '""')}"`),
    ];
    const csv = lines.join("\n");
    const outPath = path.resolve(process.cwd(), outFile);
    fs.writeFileSync(outPath, csv, "utf8");
    console.log(`📄 Saved CSV to: ${outPath}`);
  }

  console.log("\n✅ Done!");
})();
