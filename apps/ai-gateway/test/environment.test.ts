import { expect, test } from "bun:test"

// Isolate the environment: never read, mutate, or forward the developer's real provider secrets.
test("imports and requests ignore all provider environment variables", async () => {
  const script = `
    const { effectApp } = await import("./apps/ai-gateway/src/effect-app.ts");
    const { makeAiGatewayEffectPlugin } = await import("./apps/ai-gateway/src/effect-plugin.ts");
    const { gatewayConfig } = await import("./apps/ai-gateway/src/config.ts");
    let calls = 0;
    const send = async () => { calls++; return Response.json({}); };
    const empty = await makeAiGatewayEffectPlugin({ send }).load();
    const input = () => new Request("http://gateway.test/v1/chat/completions", { method: "POST", body: "{}" });
    const status = (await empty.handle(input())).status;
    let auth;
    const explicit = await makeAiGatewayEffectPlugin({
      getConfig: () => ({ providers: [{ id: "chat", apiType: "openai.chat", baseURL: "https://explicit.test" }] }),
      send: async (r) => { auth = r.headers.get("authorization"); return Response.json({}); },
    }).load();
    await explicit.handle(input());
    console.log(JSON.stringify({ status, calls, config: gatewayConfig().providers ?? null, auth,
      factory: typeof effectApp.createPlugin, hasPlugin: effectApp.plugin !== undefined }));
  `
  const child = Bun.spawn([process.execPath, "--eval", script], {
    cwd: new URL("../../../", import.meta.url).pathname,
    env: { AI_GATEWAY_UPSTREAM: "https://env.test", AI_GATEWAY_API_KEY: "test-only-key",
      ANTHROPIC_UPSTREAM: "https://env-anthropic.test", ANTHROPIC_API_KEY: "test-only-key",
      OPENAI_BASE_URL: "https://env-openai.test", OPENAI_API_KEY: "test-only-key" },
    stdout: "pipe", stderr: "pipe",
  })
  const [out, err, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  expect(err).toBe("")
  expect(exit).toBe(0)
  expect(JSON.parse(out)).toEqual({ status: 503, calls: 0, config: null, auth: null, factory: "function", hasPlugin: false })
})
