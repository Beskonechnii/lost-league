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
.aucard{width:420px;border-radius:36px;padding:34px 32px 30px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
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

const field = (label, val, opts = {}) =>
`<div><label class="flabel">${label}</label><div class="field${opts.focus ? " focus" : ""}">${val}${opts.eye ? `<span class="fico">${eye}</span>` : ""}</div></div>`;

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
