import { writeFileSync, readFileSync } from "node:fs";

// Экран входа/регистрации LOST. Композиция — свой канвас, но на рецептах кита:
// STYLE переиспузуем из ../kit/build.mjs (единый источник элементов). Переключатель
// Вход/Регистрация — китовый сегмент (.segset/.seg), не новый элемент. Соц-вход:
// Google / Telegram / Steam + почта+пароль. «Забыли пароль» нет — в LOST писем/сброса нет.
const kitSrc = readFileSync(new URL("../kit/build.mjs", import.meta.url), "utf8");
const STYLE = kitSrc.match(/const STYLE = `([\s\S]*?)`;/)[1];

const AU = `
.austage{margin:40px;padding:56px;border-radius:52px;background:var(--grad-board);display:inline-block;
  box-shadow:0 0 0 1px rgba(255,255,255,.6),inset 3px 4px 6px -1px rgba(255,255,255,.95),inset -4px -5px 10px -2px rgba(150,135,105,.22),inset 0 -4px 0 rgba(178,164,132,.2),0 6px 10px rgba(120,108,78,.14),0 34px 60px -10px rgba(120,108,78,.30),0 90px 130px -30px rgba(120,108,78,.20);}
.aucard{position:relative;width:420px;border-radius:36px;padding:34px 32px 30px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.auhead{display:flex;flex-direction:column;align-items:center;gap:13px;margin-bottom:22px;}
.aulogo{width:56px;height:56px;border-radius:19px;display:grid;place-items:center;font-size:24px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.autitle{font-size:22px;font-weight:900;letter-spacing:-.5px;}
.ausub{font-size:13px;font-weight:700;color:var(--mut);margin-top:-6px;}
/* переключатель Вход/Регистрация = китовый сегмент, растянут на ширину */
.auseg{display:flex;margin-bottom:22px;}
.auseg .seg{flex:1;text-align:center;}
/* соц-вход — круглые иконочные кнопки из кита (.btn.ib.round), рядком под формой */
.ausocrow{display:flex;gap:14px;justify-content:center;margin-top:6px;}
.ausocrow .btn{width:58px;height:58px;}
.aulink{color:var(--mint-ink);font-weight:900;}
.audiv{display:flex;align-items:center;gap:14px;color:var(--sub);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:20px 2px 16px;}
.audiv:before,.audiv:after{content:"";height:1px;flex:1;background:var(--line);}
.austack{display:flex;flex-direction:column;gap:13px;}
.aurow{display:flex;align-items:center;justify-content:space-between;margin:2px 2px;}
.aubtn{width:100%;justify-content:center;margin-top:18px;}
.aualt{text-align:center;font-size:13px;font-weight:700;color:var(--mut);margin-top:16px;}
.aualt b{color:var(--mint-ink);font-weight:900;}
/* ── квиз регистрации ───────────────────────────────────────────── */
.qcard{width:520px;}
.col2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.qcheck{display:flex;flex-direction:column;gap:12px;margin-top:18px;}
.qnav{display:flex;gap:12px;margin-top:22px;}
.qnav .btn.solid{flex:1;justify-content:center;}
.hint{font-size:12px;font-weight:700;color:var(--mut);margin-top:7px;line-height:1.5;}
.hint .aulink{white-space:nowrap;}
/* степпер */
.qsteps{display:flex;align-items:flex-start;margin-bottom:24px;}
.qstep{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;}
.qdot{width:38px;height:38px;border-radius:999px;display:grid;place-items:center;font-weight:900;font-size:15px;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);flex:none;}
.qdot.on,.qdot.done{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.qcap{font-size:11px;font-weight:800;color:var(--sub);text-align:center;line-height:1.25;text-wrap:pretty;} .qstep.on .qcap{color:var(--mint-ink);}
.qline{height:3px;width:28px;flex:none;border-radius:999px;background:var(--carve-bg);box-shadow:var(--sh-carve);margin:18px 4px 0;}
.qline.done{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* шапка шага с выходом + телефонный код */
.qexit{position:absolute;top:24px;right:24px;z-index:2;}
.codesel{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font-weight:800;padding-right:10px;border-right:1px solid var(--line2);}
/* ── состояния: календарь (дата рождения) + открытый дропдаун ────── */
.statesrow{display:flex;gap:44px;align-items:flex-start;}
.stlbl{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--sub);margin-bottom:14px;}
.cal{width:420px;border-radius:30px;padding:22px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.calhead{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.calnav{display:flex;gap:8px;}
.calbtn{width:44px;height:44px;border-radius:999px;display:grid;place-items:center;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.caldrop{flex:1;display:flex;align-items:center;justify-content:space-between;gap:8px;border-radius:15px;padding:12px 16px;font-size:14px;font-weight:800;color:var(--ink);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.caldrop.yr{flex:none;width:104px;}
.calgrid{border-radius:22px;padding:15px;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.calwk{display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:9px;}
.calwk span{text-align:center;font-size:10px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;}
.caldays{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;}
.calday{aspect-ratio:1;border-radius:12px;display:grid;place-items:center;font-size:13px;font-weight:800;color:var(--ink);}
.calday.mut{color:var(--sub);}
.calday.sel{border-radius:999px;color:var(--mint-ink);background:var(--grad-mint);box-shadow:inset 3px 4px 8px rgba(40,105,76,.62),inset -2px -3px 6px rgba(255,255,255,.55),inset 0 0 0 1px rgba(40,105,76,.2);}
.calpop{position:absolute;top:calc(100% + 8px);right:0;z-index:10;}
.calpop .cal{width:400px;box-shadow:var(--sh-raise),0 30px 60px -12px rgba(60,50,30,.42);}
`;

// бренд-иконки (в китовом белом диске .idisc.neu)
const gGoogle = `<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.7 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.15-3.1-.4-4.6H24v9.1h12.7c-.55 2.9-2.2 5.4-4.7 7.1l7.4 5.7c4.3-4 6.1-9.9 6.1-17.3z"/><path fill="#FBBC05" d="M10.4 28.6a14.5 14.5 0 0 1 0-9.2l-7.8-6.1a24 24 0 0 0 0 21.4l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.5 2.2-6.3 0-11.7-3.8-13.6-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>`;
const gTelegram = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#229ED9"><path d="M21.9 4.34 3.2 11.3c-.9.35-.88 1.64.03 1.93l4.7 1.47 1.8 5.48c.24.72 1.12.9 1.63.35l2.55-2.68 4.66 3.44c.6.44 1.46.11 1.62-.62l3-14.35c.2-.95-.72-1.72-1.6-1.34zM9.7 15.05l-.28 3.9 2.03-2.83 5.6-5.9c.12-.13-.04-.32-.2-.22l-7.15 5.05z"/></svg>`;
const gSteam = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171a21" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15.2 8 16.9"/><circle cx="9.4" cy="9.2" r="4"/><circle cx="9.4" cy="9.2" r="1.5" fill="#171a21" stroke="none"/><circle cx="16.4" cy="14.4" r="2.6"/></svg>`;

const eye = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/></svg>`;

// круглая иконочная кнопка соц-входа = китовый .btn.ib.round
const socRound = (icon) => `<span class="btn quiet ib round">${icon}</span>`;
const socialsRow = () => `<div class="ausocrow">${socRound(gGoogle)}${socRound(gTelegram)}${socRound(gSteam)}</div>`;

const seg = (active) =>
`<div class="segset auseg"><span class="seg${active === 0 ? " on" : ""}">Вход</span><span class="seg${active === 1 ? " on" : ""}">Регистрация</span></div>`;

const check = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 6"/></svg>`;

const field = (label, val, opts = {}) => {
  const ic = opts.eye ? eye : opts.icon || null;
  return `<div><label class="flabel">${label}</label><div class="field${opts.focus ? " focus" : ""}">${val}${ic ? `<span class="fico">${ic}</span>` : ""}</div></div>`;
};
const two = (a, b) => `<div class="col2">${a}${b}</div>`;

// иконки полей квиза
const svgq = (d, w = 2.2) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const icLock = svgq('<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>');
const icChev = svgq('<path d="M6 9l6 6 6-6"/>', 2.4);
const icPhone = svgq('<path d="M6.5 3h3l1.6 4.2-2.1 1.3a11 11 0 0 0 5.2 5.2l1.3-2.1L20.9 16v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/>', 2.1);
const icCal = svgq('<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>', 2.1);
const icExt = svgq('<path d="M14 4h6v6M20 4l-8 8M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>', 2.1);

// степпер: active — индекс текущего шага (0..2)
const QSTEPS = ["Контактная информация", "Киберспортивный профиль", "Рейтинг и позиция"];
const stepper = (active) => {
  let out = '<div class="qsteps">';
  QSTEPS.forEach((name, i) => {
    const state = i < active ? "done" : i === active ? "on" : "";
    const inner = i < active ? check : i + 1;
    out += `<div class="qstep${i === active ? " on" : ""}"><div class="qdot ${state}">${inner}</div><div class="qcap">${name}</div></div>`;
    if (i < QSTEPS.length - 1) out += `<div class="qline${i < active ? " done" : ""}"></div>`;
  });
  return out + "</div>";
};

// выход из регистрации + шапка шага
// шапка шага: как на входе — лого сверху, заголовок по центру; крестик выхода в углу
const xmark = svgq('<path d="M6 6l12 12M18 6L6 18"/>', 2.4);
const qhead = (title) => `<button class="xbtn qexit" title="Выйти из регистрации">${xmark}</button>
    <div class="auhead"><div class="aulogo">L</div><div class="autitle">${title}</div></div>`;

// открытый календарь даты рождения (нейтральный пример: март 2001, выбран 12)
const chL = svgq('<path d="M15 6l-6 6 6 6"/>', 2.4);
const chR = svgq('<path d="M9 6l6 6-6 6"/>', 2.4);
const calDays = () => {
  let c = "";
  [26, 27, 28].forEach((d) => (c += `<div class="calday mut">${d}</div>`));   // хвост прошлого месяца
  for (let d = 1; d <= 31; d++) c += `<div class="calday${d === 12 ? " sel" : ""}">${d}</div>`;
  for (let d = 1; d <= 42 - 3 - 31; d++) c += `<div class="calday mut">${d}</div>`; // начало следующего
  return c;
};
const calOpen = `<div class="cal">
  <div class="calhead">
    <div class="calnav"><span class="calbtn">${chL}</span><span class="calbtn">${chR}</span></div>
    <div class="caldrop">Март${icChev}</div>
    <div class="caldrop yr">2001${icChev}</div>
  </div>
  <div class="calgrid">
    <div class="calwk"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
    <div class="caldays">${calDays()}</div>
  </div>
</div>`;
// поле даты рождения: закрыто (дефолт) или открыто (календарь-поповер)
const phoneVal = `<span style="display:inline-flex;align-items:center;gap:10px"><span class="codesel">+—${icChev}</span>__ ___ __ __</span>`;
const dateField = (open) => `<div style="position:relative">
      <label class="flabel">Дата рождения</label>
      <div class="field${open ? " focus" : ""}">${open ? "12.03.2001" : "ДД.ММ.ГГГГ"}<span class="fico">${icCal}</span></div>
      ${open ? `<div class="calpop">${calOpen}</div>` : ""}
    </div>`;

// экраны квиза — функции (open рисует раскрытое состояние того же экрана)
const step1 = (open) => `<div class="austage">
  <div class="aucard qcard">
    ${qhead("Контактная информация")}
    ${stepper(0)}
    <div class="austack">
      <div><label class="flabel">Почта</label><div class="field" style="color:var(--ink)">captain@lost.gg<span class="fico" style="color:#2E7D5E">${icLock}</span></div></div>
      ${field("Никнейм", "Ваш ник")}
      ${two(field("Имя", "Имя"), field("Фамилия", "Фамилия"))}
      ${two(field("Страна", "Выберите страну", { icon: icChev }), field("Город", "Город"))}
      ${field("Telegram", `<span style="color:var(--sub)">@</span>username`)}
      ${two(field("Телефон", phoneVal), dateField(open))}
    </div>
    <div class="qcheck">
      <label class="chkrow"><span class="chk on">${check}</span><span>Принимаю <a class="aulink">политику конфиденциальности</a></span></label>
      <label class="chkrow"><span class="chk on">${check}</span><span>Согласен с <a class="aulink">правилами лиги</a></span></label>
    </div>
    <div class="qnav"><button class="btn solid lg">Далее</button></div>
  </div>
</div>`;

const step2 = `<div class="austage">
  <div class="aucard qcard">
    ${qhead("Киберспортивный профиль")}
    ${stepper(1)}
    <div class="austack">
      <div>${field("Dotabuff", "dotabuff.com/players/…", { icon: icExt })}<div class="hint">Ссылка на ваш профиль. <a class="aulink">Открыть dotabuff.com ↗</a></div></div>
      <div>${field("Steam", "steamcommunity.com/id/…", { icon: icExt })}<div class="hint">Ссылка на профиль Steam. <a class="aulink">Открыть steamcommunity.com ↗</a></div></div>
    </div>
    <div class="qnav"><button class="btn quiet lg">Назад</button><button class="btn solid lg">Далее</button></div>
  </div>
</div>`;

const step3 = (open) => `<div class="austage">
  <div class="aucard qcard">
    ${qhead("Рейтинг и позиция")}
    ${stepper(2)}
    <div class="austack">
      <div style="max-width:190px">${field("Текущий MMR", "Например, 4000")}</div>
      <div><label class="flabel">Роль / позиция</label>
        <div class="field${open ? " focus" : ""}">${open ? "Мид · позиция 2" : "Выберите позицию"}<span class="fico">${icChev}</span></div>
        ${open ? `<div class="menu" style="width:100%;margin-top:8px"><div class="mi">1 · Керри</div><div class="mi hl">2 · Мид</div><div class="mi">3 · Оффлейн</div><div class="mi">4 · Саппорт</div><div class="mi">5 · Фулл-саппорт</div></div>` : ""}
      </div>
    </div>
    <div class="qnav"><button class="btn quiet lg">Назад</button><button class="btn solid lg">Отправить анкету</button></div>
  </div>
</div>`;

const boards = {
// ── Вход: сначала почта+пароль, соц-вход ниже ────────────────────────────────
"Login": `<div class="austage">
  <div class="aucard">
    <div class="auhead"><div class="aulogo">L</div><div class="autitle">Вход в лигу</div></div>
    ${seg(0)}
    <div class="austack">
      ${field("Почта", "captain@lost.gg")}
      ${field("Пароль", "••••••••••", { eye: true })}
    </div>
    <div class="aurow" style="margin-top:14px">
      <label class="chkrow"><span class="chk on">${check}</span><span>Запомнить меня</span></label>
    </div>
    <button class="btn solid lg aubtn">Войти</button>
    <div class="audiv">или через</div>
    ${socialsRow()}
    <div class="aualt">Нет аккаунта? <b>Регистрация</b></div>
  </div>
</div>`,

// ── Регистрация: базовое окно, без шагов (шаги — на страницах квиза) ──────────
"Register": `<div class="austage">
  <div class="aucard">
    <div class="auhead"><div class="aulogo">L</div><div class="autitle">Регистрация</div></div>
    ${seg(1)}
    <div class="austack">
      ${field("Почта", "captain@lost.gg")}
      ${field("Пароль", "Придумайте пароль", { eye: true })}
      ${field("Повторите пароль", "Ещё раз пароль", { eye: true })}
    </div>
    <div class="aurow" style="margin-top:14px">
      <label class="chkrow"><span class="chk on">${check}</span><span>Согласен с <a class="aulink">правилами</a> лиги</span></label>
    </div>
    <button class="btn solid lg aubtn">Продолжить</button>
    <div class="audiv">или через</div>
    ${socialsRow()}
    <div class="aualt">Уже есть аккаунт? <b>Войти</b></div>
  </div>
</div>`,

// ── Квиз: дефолтные экраны (закрытые состояния) ──────────────────────────────
"Step1": step1(false),
"Step2": step2,
"Step3": step3(false),
// ── Квиз: те же экраны с раскрытыми элементами (полные экраны, не куски) ──────
"Step1Open": step1(true),
"Step3Open": step3(true),
};

const wrap = (content) =>
`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet><style>${STYLE}${AU}</style></helmet>
${content}
</x-dc>
</body>
</html>
`;

for (const [name, content] of Object.entries(boards)) {
  const file = name === "Login" ? "Main.dc.html" : `${name}.dc.html`;
  writeFileSync(new URL(`./${file}`, import.meta.url), wrap(content));
  console.log("wrote", file);
}
