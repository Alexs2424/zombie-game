// Development screenshot driver for the weapon pass (headless Chrome over CDP).
// node tools/weapon-1970s/shoot.mjs <outDir> '<json script>'
// The script is a list of steps: {"action":"give-magnum"} | {"wait":ms} | {"shot":"name"} | {"eval":"js"}
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const [outDir, scriptJson, url = "http://127.0.0.1:5173/?playtest=1"] = process.argv.slice(2);
const steps = JSON.parse(scriptJson.startsWith('@') ? readFileSync(scriptJson.slice(1),'utf8') : scriptJson);
mkdirSync(outDir, { recursive: true });
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 400);
const proc = spawn(chrome, [
  "--headless=new", `--remote-debugging-port=${port}`, "--window-size=1600,900", "--use-angle=metal",
  "--enable-gpu", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required", "--mute-audio",
  `--user-data-dir=${outDir}/.chrome`, "about:blank",
], { stdio: "ignore" });
let ws, id = 0;
const pending = new Map();
const logs = [];
async function connect() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("chrome did not start");
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msg = { id: ++id, method, params };
    pending.set(msg.id, { resolve, reject });
    ws.send(JSON.stringify(msg));
  });
}
async function evaluate(expression) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener("open", r));
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error.message));
      else p.resolve(d.result);
    } else if (d.method === "Runtime.consoleAPICalled") logs.push(`${d.params.type}: ${d.params.args.map((a) => a.value ?? a.description).join(" ")}`);
    else if (d.method === "Runtime.exceptionThrown") logs.push(`exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`);
  });
  await send("Runtime.enable");
  await send("Page.enable");
  // Optional asset-failure verification; normal captures leave networking untouched.
  if (process.env.CAPTURE_BLOCK_URLS) {
    await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: JSON.parse(process.env.CAPTURE_BLOCK_URLS) });
  }
  await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  for (let i = 0; i < 240; i++) {
    const ok = await evaluate("!!window.__lastJackpot && !document.querySelector('button[disabled]')").catch(() => false);
    if (ok) break;
    await sleep(500);
  }
  await sleep(800);
  for (const step of steps) {
    if (step.action) await evaluate(`window.__lastJackpot.testAction(${JSON.stringify(step.action)})`);
    if (step.eval) console.log("eval:", JSON.stringify(await evaluate(step.eval)));
    if (step.wait) await sleep(step.wait);
    if (step.shot) {
      const r = await send("Page.captureScreenshot", { format: "png" });
      writeFileSync(`${outDir}/${step.shot}.png`, Buffer.from(r.data, "base64"));
      console.log("shot", step.shot);
    }
  }
} catch (e) {
  console.error("driver error:", e.message);
  process.exitCode = 1;
} finally {
  if (logs.length) console.log(logs.filter((l) => !/Download the React DevTools|\[vite\]/.test(l)).slice(0, 40).join("\n"));
  ws?.close();
  proc.kill("SIGKILL");
}
