/**
 * pm2 daemon config for mantis - one process per dingtalk channel:
 *
 *   mantis-robot  bot identity (dingtalk-stream)     - needs [dingtalk] credentials in config.toml
 *   mantis-dws    user identity (dws CLI polling)    - needs DWS_GROUP_ID or DWS_USER_ID
 *   mantis-web    observability + access console      - HTTP/SSE, no channel creds
 *
 * Start all (or pick one with --only) from the repo root:
 *   pm2 start apps/mantis/ecosystem.config.cjs
 *   pm2 start apps/mantis/ecosystem.config.cjs --only mantis-robot
 *
 * Config: both processes read config.toml (MANTIS_CONFIG_FILE or auto-
 * discovery - see src/config.ts). Secrets are "$ENV_NAME" placeholders
 * expanded from the environment, so export them in the shell before starting
 * (pm2 inherits the starting shell's env), e.g.
 *
 *   robot: export DINGTALK_CLIENT_ID=... DINGTALK_CLIENT_SECRET=... BAIZHI_API_KEY=...
 *   dws:   export BAIZHI_API_KEY=...  (dws identity needs no app credentials)
 *
 * Manage: pm2 logs mantis-robot | pm2 restart mantis-dws | pm2 stop mantis-robot
 */
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
    ? { NODE_ENV: "production" } // web console ignores MANTIS_CHANNEL
    : { NODE_ENV: "production", MANTIS_CHANNEL: channel },
  ...logFiles(name),
})

module.exports = {
  apps: [app("mantis-robot", "robot"), app("mantis-dws", "dws"), app("mantis-web", "web")],
}