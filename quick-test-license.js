const { execSync } = require("child_process");
const path = require("path");

// Change to backend directory and run the license check
const backendDir = path.join(__dirname, "backend");

try {
  console.log("Checking license status...");

  const output = execSync("node scripts/reset-license.js", {
    cwd: backendDir,
    encoding: "utf8",
  });

  console.log("License reset output:");
  console.log(output);
} catch (error) {
  console.error("Error:", error.message);
}
