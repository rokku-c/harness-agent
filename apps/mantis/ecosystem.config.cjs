const path = require("node:path")

const logFiles = (name) => ({
  out_file: path.join(__dirname, "logs", name + ".out.log"),
  error_file: path.join(__dirname, "logs", name + ".err.log"),
  log_date_format: "YYYY-MM-DD HH:mm:ss Z",
})

const app = (name, channel) => ({
  name,
  script: "bun",
  args: channel === "web"
    ? "run src/hosts/webui/main.ts"
    : "run src/hosts/dingtalk/main.ts",
  cwd: __dirname,
  interpreter: "none", // run bun itself as the process
  autorestart: true,
  max_restarts: 10,
  min_uptime: "10s",
  kill_timeout: 10000,
  env: channel === "web"
    ? { NODE_ENV: "production" }
    : { NODE_ENV: "production", MANTIS_CHANNEL: channel },
  ...logFiles(name),
})

module.exports = {
  apps: [app("mantis-robot", "robot"), app("mantis-dws", "dws"), app("mantis-web", "web")],
}
