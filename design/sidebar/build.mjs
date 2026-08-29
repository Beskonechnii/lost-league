import { writeFileSync, readFileSync } from "node:fs";

// Отдельный кит: единый профиль-ориентированный сайдбар LOST (турниры + админка + кабинет).
// Визуальный язык — Light Clay из ../kit/build.mjs: STYLE переиспользуем как единый источник
// рецептов (kit не трогаем), сюда добавляем только рецепты самого сайдбара.
const kitSrc = readFileSync(new URL("../kit/build.mjs", import.meta.url), "utf8");
const STYLE = kitSrc.match(/const STYLE = `([\s\S]*?)`;/)[1];

// Рецепты сайдбара — на тех же переменных (--grad-*, --sh-*), перенос в pouf прямой.
const SB = `
.sbstage{margin:40px;padding:44px;border-radius:48px;background:var(--grad-board);display:inline-block;
  box-shadow:0 0 0 1px rgba(255,255,255,.6),inset 3px 4px 6px -1px rgba(255,255,255,.95),inset -4px -5px 10px -2px rgba(150,135,105,.22),inset 0 -4px 0 rgba(178,164,132,.2),0 6px 10px rgba(120,108,78,.14),0 34px 60px -10px rgba(120,108,78,.30),0 90px 130px -30px rgba(120,108,78,.20);}
.sbcap{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--sub);margin-bottom:18px;}
.sb{width:300px;border-radius:34px;padding:14px 13px;background:var(--grad-surface);box-shadow:var(--sh-raise);display:flex;flex-direction:column;}
/* шапка: бренд + свернуть (следующий этап) */
.sbhead{display:flex;align-items:center;justify-content:space-between;padding:8px 8px 4px;}
.brand{display:flex;align-items:center;gap:11px;font-size:19px;font-weight:900;letter-spacing:-.4px;}
.brand .logo{width:38px;height:38px;border-radius:13px;display:grid;place-items:center;font-size:18px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.collapse{width:34px;height:34px;border-radius:12px;display:grid;place-items:center;color:var(--sub);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
/* профиль-блок — вход в кабинет */
.prof{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:20px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);margin:8px 2px;}
.prof .av{width:44px;height:44px;border-radius:999px;flex:none;display:grid;place-items:center;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);font-size:16px;}
.prof .nm{font-size:15px;font-weight:900;line-height:1.15;}
.prof .rl{font-size:12px;font-weight:800;color:var(--mut);margin-top:3px;display:flex;align-items:center;gap:6px;}
.prof .go{margin-left:auto;color:var(--sub);flex:none;}
.sdot{width:8px;height:8px;border-radius:999px;box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 1px 1px 1px rgba(255,255,255,.5),inset -1px -1px 2px rgba(0,0,0,.2);}
/* поиск */
.sbsearch{margin:2px 2px 4px;padding:12px 15px;font-size:13px;border-radius:18px;}
/* заголовок секции */
.sbsec{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.6px;color:var(--sub);padding:15px 12px 8px;}
/* пункт */
.sbi{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:16px;font-size:14.5px;font-weight:800;color:var(--ink);}
.sbi svg{flex:none;color:var(--mut);}
.sbi.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.sbi.on svg{color:var(--mint-ink);}
.sbi.muted{color:var(--mut);} .sbi.muted svg{color:var(--sub);}
.sbi.down{color:#B4595A;} .sbi.down svg{color:#B4595A;}
/* счётчик у пункта — тёплый, читается на любом фоне (как в реф1/реф4) */
.bd{margin-left:auto;border-radius:999px;min-width:23px;height:23px;padding:0 7px;display:inline-grid;place-items:center;font-size:11px;font-weight:900;font-variant-numeric:tabular-nums;color:#B4595A;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.sbi.on .bd{color:#184636;background:rgba(255,255,255,.7);box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),0 2px 4px rgba(40,100,76,.25);}
/* низ — прижат */
.sbfoot{margin-top:10px;padding-top:8px;border-top:1px solid var(--line);display:flex;flex-direction:column;}
/* свитчер темы: китовый .switch справа, ужат под ритм строк */
.thsw .switch{margin-left:auto;transform:scale(.78);transform-origin:right center;}
`;

// line-иконки в стиле кита (stroke 2.2)
const svg = (d) => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  trophy: svg('<path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0V4z"/><path d="M18 5h3v2a4 4 0 0 1-4 4M6 5H3v2a4 4 0 0 0 4 4"/>'),
  users:  svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-3-4.9"/>'),
  table:  svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M12 4v16"/>'),
  versus: svg('<path d="M6 4l5 8-5 8M18 4l-5 8 5 8"/>'),
  star:   svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  studio: svg('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M4 18l5-4.5 4 3.2 3-2.4 4 3.7"/>'),
  monitor:svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  eye:    svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  draft:  svg('<path d="M4 5h5l2 3M4 19h5l7-11h4"/><path d="M16 5h4v4M20 15v4h-4"/>'),
  shield: svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="m9 11.5 2 2 4-4"/>'),
  archive:svg('<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 13h4"/>'),
  user:   svg('<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  lock:   svg('<rect x="4.5" y="10" width="15" height="10" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/><circle cx="12" cy="15" r="1.4"/>'),
  crown:  svg('<path d="M4 8l3.5 4L12 5l4.5 7L20 8l-1.5 10h-13z"/>'),
  palette:svg('<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.4-2-.6-1 0-2 1.1-2H16a5 5 0 0 0 5-5c0-4.4-4-6-9-6z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>'),
  book:   svg('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 1 6.5 21H19"/>'),
  out:    svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  chev:   svg('<path d="M15 6l-6 6 6 6"/>'),
  moon:   svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  sun:    svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/>'),
};

// пункт сайдбара
const item = (icon, label, o = {}) => {
  const cls = ["sbi", o.on && "on", o.muted && "muted", o.down && "down"].filter(Boolean).join(" ");
  const badge = o.badge ? `<span class="bd">${o.badge}</span>` : "";
  return `<div class="${cls}">${I[icon]}<span>${label}</span>${badge}</div>`;
};
const sec = (t) => `<div class="sbsec">${t}</div>`;

// профиль-блок
const prof = (initials, name, roleDot, roleText) =>
`<div class="prof"><span class="av">${initials}</span>
  <div><div class="nm">${name}</div><div class="rl"><span class="sdot" style="background:${roleDot}"></span>${roleText}</div></div>
  <span class="go">${I.chev.replace('M15 6l-6 6 6 6','M9 6l6 6-6 6')}</span></div>`;

const head =
`<div class="sbhead"><div class="brand"><span class="logo">L</span>LOST</div>
  <span class="collapse" title="Свернуть — следующий этап">${I.chev}</span></div>`;

const searchField =
`<div class="field sbsearch">Поиск по лиге…<span class="fico">${I.search}</span></div>`;

// Свитчер темы — строка сайдбара с китовым .switch/.knob (элемент из кита, не новый).
const themeRow =
`<div class="sbi thsw">${I.moon}<span>Тёмная тема</span>
  <span class="switch off"><span class="knob"></span></span></div>`;

const foot = (extra = "") =>
`<div class="sbfoot">${extra}${themeRow}${item("book","Правила лиги",{muted:true})}${item("out","Выйти",{down:true})}</div>`;

const boards = {
// ── Оператор: видит всё (турниры + инструменты + кабинет) ────────────────────
"Main": `<div class="sbstage">
  <div class="sbcap">Единый сайдбар · взгляд оператора</div>
  <aside class="sb">
    ${head}
    ${prof("СБ","Стас","#8CC9AA","Владелец лиги")}
    ${searchField}
    ${sec("Лига")}
    ${item("trophy","Турниры",{on:true})}
    ${item("users","Ростер")}
    ${item("table","Таблицы")}
    ${item("versus","Встречи")}
    ${item("star","TP-зачёт")}
    ${sec("Инструменты")}
    ${item("studio","Студия")}
    ${item("monitor","Матч")}
    ${item("eye","Карта вардов")}
    ${item("draft","UNDERBEER")}
    ${item("shield","Модерация",{badge:"3"})}
    ${item("archive","Архив серий")}
    ${sec("Кабинет")}
    ${item("user","Профиль")}
    ${item("lock","Безопасность")}
    ${item("crown","Команда лиги")}
    ${item("palette","Тема")}
    ${foot()}
  </aside>
</div>`,

// ── Игрок: короткий — лига + кабинет, без инструментов ───────────────────────
"Player": `<div class="sbstage">
  <div class="sbcap">Тот же сайдбар · взгляд игрока (по правам)</div>
  <aside class="sb">
    ${head}
    ${prof("ГЗ","Guzli","#E8C56E","Капитан · Guzliki")}
    ${searchField}
    ${sec("Лига")}
    ${item("trophy","Турниры")}
    ${item("users","Ростер")}
    ${item("table","Таблицы")}
    ${item("versus","Встречи")}
    ${item("star","TP-зачёт")}
    ${sec("Кабинет")}
    ${item("user","Профиль",{on:true})}
    ${item("lock","Безопасность")}
    ${item("crown","Моя команда")}
    ${foot()}
  </aside>
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
<helmet><style>${STYLE}${SB}</style></helmet>
${content}
</x-dc>
</body>
</html>
`;

for (const [name, content] of Object.entries(boards)) {
  writeFileSync(new URL(`./${name}.dc.html`, import.meta.url), wrap(content));
  console.log("wrote", name + ".dc.html");
}
