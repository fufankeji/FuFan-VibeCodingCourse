/**
 * Cross-platform port killer for development.
 * Kills any process occupying the given port before tsx watch starts.
 * Usage: node scripts/kill-port.cjs <port>
 */
const { execSync } = require("child_process");

const port = process.argv[2] || "3001";

try {
  if (process.platform === "win32") {
    // Windows: netstat to find PID, then taskkill
    const output = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    );
    const lines = output.trim().split("\n");
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== "0") {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "pipe" });
          console.log(`[kill-port] Freed port ${port} (killed PID ${pid})`);
        } catch {
          // Process already gone
        }
      }
    }
  } else {
    // Unix: fuser
    execSync(`fuser -k ${port}/tcp`, { stdio: "pipe" });
    console.log(`[kill-port] Freed port ${port}`);
  }
} catch {
  // Port was not in use — nothing to do
}
