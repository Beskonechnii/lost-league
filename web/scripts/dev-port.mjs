// Запуск dev-сервера на первом свободном порту, начиная с 3000 (или с PORT).
// Зачем: соседнее окно часто уже держит 3000, и `next dev` в этом случае просто падает —
// вместо разбирательства поднимаемся на 3001, 3002 и так далее.
import { createServer } from "node:net";
import { spawn, execFileSync } from "node:child_process";

const FIRST = Number(process.env.PORT) || 3000;
const TRIES = 10;

// Next 16 не поднимает второй dev-сервер в той же папке — даже на другом порту. Поэтому сперва
// смотрим, не запущен ли наш же сервер в соседнем окне: если да, печатаем его адрес и выходим
// без ошибки, вместо невнятного «Another next dev server is already running».
function running() {
  for (let p = FIRST; p < FIRST + TRIES; p++) {
    let pids;
    try {
      pids = execFileSync("lsof", ["-nP", "-tiTCP:" + p, "-sTCP:LISTEN"], { encoding: "utf8" }).split(/\s+/).filter(Boolean);
    } catch { continue; }
    for (const pid of pids) {
      try {
        const out = execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" });
        const cwd = (out.match(/^n(.*)$/m) ?? [])[1];
        if (cwd === process.cwd()) return { port: p, pid };
      } catch { /* процесс мог уйти — не беда */ }
    }
  }
  return null;
}

const live = running();
if (live) {
  console.log(`Сервер этого проекта уже поднят: http://localhost:${live.port} (pid ${live.pid}).`);
  console.log("Нужен свежий — сперва погаси: скилл stop.");
  process.exit(0);
}

function free(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, "0.0.0.0");
  });
}

let port = null;
for (let p = FIRST; p < FIRST + TRIES; p++) {
  if (await free(p)) { port = p; break; }
}
if (port == null) {
  console.error(`Свободного порта в диапазоне ${FIRST}–${FIRST + TRIES - 1} нет. Погаси лишние: скилл stop.`);
  process.exit(1);
}
if (port !== FIRST) console.log(`Порт ${FIRST} занят — поднимаюсь на ${port}.`);

// Аргументы после `npm run dev --` пробрасываем как есть.
const extra = process.argv.slice(2);
const child = spawn("next", ["dev", "-p", String(port), ...extra], { stdio: "inherit", shell: false, env: process.env });
child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
