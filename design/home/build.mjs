import { writeFileSync, readFileSync } from "node:fs";

// Главная страница LOST. Визуальный язык — Light Clay из ../kit/build.mjs: STYLE и готовые
// рецепты (шапка, карточка встречи, таблица) переиспользуем, кит не трогаем. Здесь только
// рецепты композиции самой главной — сетка 60/40, карточки турниров, топы.
const kitSrc = readFileSync(new URL("../kit/build.mjs", import.meta.url), "utf8");
const STYLE = kitSrc.match(/const STYLE = `([\s\S]*?)`;/)[1];
// хвост CSS листа кита лежит рядом с его разметкой — kit/parts/<Имя>.css
const kitExtra = (name) => readFileSync(new URL(`../kit/parts/${name}.css`, import.meta.url), "utf8");
const BASE = STYLE + kitExtra("SiteNav") + kitExtra("SeriesCard") + kitExtra("Standings");

const HOME = `
/* ——— страница ——— */
.page{width:1440px;padding:28px 80px 64px;display:flex;flex-direction:column;gap:28px;}
.sect{display:flex;flex-direction:column;gap:16px;}
/* подложка смыслового блока: секция лежит на доске, карточки — на ней */
.slab{border-radius:40px;padding:20px 20px 20px;background:var(--grad-board);box-shadow:var(--sh-raise);display:flex;flex-direction:column;gap:16px;}
.slab .shead{padding:0 6px;}
.shead{display:flex;align-items:baseline;gap:14px;}
.stitle{font-size:22px;font-weight:900;letter-spacing:-.5px;}
.smore{margin-left:auto;font-size:13px;font-weight:800;color:var(--mut);display:inline-flex;align-items:center;gap:6px;}
/* в блоках нижнего ряда ссылка уходит под список — одинаково у матчей и баллов */
.dmore{margin-top:auto;padding:4px 6px 0;display:flex;justify-content:flex-end;font-size:13px;font-weight:800;color:var(--mut);align-items:center;gap:6px;}
/* шапка: три отдельных острова вместо одной плиты */
.topbar{display:flex;align-items:center;gap:14px;}
.island{border-radius:26px;padding:10px 14px;background:var(--grad-surface);box-shadow:var(--sh-raise);display:flex;align-items:center;gap:10px;}
.island.brandbox{padding:10px 18px 10px 12px;}
.island .btn.ib.round{width:48px;height:48px;padding:0;}
/* колокольчик со счётчиком непрочитанных */
.bellwrap{position:relative;display:grid;place-items:center;}
.bellbd{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;font-size:11px;font-weight:900;color:#fff;background:linear-gradient(135deg,#E28B8B,#C25E5E);box-shadow:0 0 0 3px #F6F2EB,0 2px 4px rgba(150,60,60,.4);}
/* выпадающая панель — общая основа для меню и уведомлений */
.drop{border-radius:28px;padding:10px;background:var(--grad-surface);box-shadow:0 0 0 1px rgba(255,255,255,.55),inset 2px 3px 4px -1px rgba(255,255,255,.95),0 30px 60px -12px rgba(60,50,30,.4);}
.drop.menu{width:280px;}
.drop.noti{width:400px;}
.dhead{display:flex;align-items:center;gap:12px;padding:12px 14px 14px;border-bottom:1px solid var(--line);margin-bottom:8px;}
.dhead .nm{font-size:15px;font-weight:900;letter-spacing:-.2px;}
.dhead .sub{font-size:12px;font-weight:800;color:var(--mut);margin-top:3px;}
.dhead .act{margin-left:auto;font-size:12px;font-weight:800;color:var(--mut);}
.ditem{display:flex;align-items:center;gap:12px;height:44px;padding:0 14px;border-radius:16px;font-size:14.5px;font-weight:800;color:var(--ink);}
.ditem svg{flex:none;color:var(--mut);}
.ditem.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.ditem.on svg{color:var(--mint-ink);}
.ditem .cnt{margin-left:auto;font-size:11px;font-weight:900;color:#B4595A;}
.ditem.down{color:#B4595A;} .ditem.down svg{color:#B4595A;}
.dsep{height:1px;background:var(--line);margin:8px 12px;}
/* строка уведомления: слева тип, справа время */
.nrow{display:flex;gap:12px;padding:12px 14px;border-radius:20px;}
.nrow+.nrow{margin-top:2px;}
.nrow.unread{background:var(--grad-board);box-shadow:var(--sh-raise-sm);}
.nicon{width:34px;height:34px;border-radius:12px;flex:none;display:grid;place-items:center;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.nicon.sys{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.ntext{min-width:0;}
.ntitle{font-size:13.5px;font-weight:900;letter-spacing:-.1px;}
.nbody{font-size:12.5px;font-weight:700;color:var(--mut);margin-top:3px;line-height:1.45;}
.ntime{margin-left:auto;font-size:11px;font-weight:800;color:var(--sub);white-space:nowrap;}
.ngroup{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:var(--sub);padding:12px 14px 8px;}
.navset .pill.cup{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* герой 60 / карточка 40 */
.top{display:grid;grid-template-columns:1fr 351px;gap:24px;align-items:stretch;}
.hero{border-radius:38px;padding:22px;background:var(--grad-surface);box-shadow:var(--sh-raise);display:flex;flex-direction:column;gap:18px;}
.heroart{height:300px;border-radius:28px;background:var(--grad-mint);box-shadow:var(--sh-mint);position:relative;overflow:hidden;display:grid;place-items:center;}
.heroart .ph{font-size:12px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:rgba(24,70,54,.55);}
.herotext{padding:0 8px 4px;display:flex;flex-direction:column;gap:9px;}
.herokicker{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.6px;color:var(--sub);}
.heroh{font-size:28px;font-weight:900;letter-spacing:-.8px;line-height:1.15;}
.herop{font-size:14px;font-weight:700;color:var(--mut);line-height:1.5;max-width:560px;}
.dots{display:flex;gap:8px;margin-top:4px;}
.dots i{width:9px;height:9px;border-radius:999px;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.dots i.on{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* карточка игрока */
.me{border-radius:38px;padding:24px;background:var(--grad-surface);box-shadow:var(--sh-raise);display:flex;flex-direction:column;gap:18px;}
.mehead{display:flex;align-items:center;gap:16px;}
.meav{width:76px;height:76px;border-radius:999px;flex:none;display:grid;place-items:center;font-size:26px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.menick{font-size:22px;font-weight:900;letter-spacing:-.5px;}
.meteam{font-size:13px;font-weight:800;color:var(--mut);margin-top:4px;display:flex;align-items:center;gap:7px;}
.merole{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--sub);margin-top:5px;}
.mestats{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.wr{border-radius:26px;padding:16px 20px 18px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.wr .wrtop{display:flex;align-items:baseline;gap:10px;}
.wr .wrv{font-size:28px;font-weight:900;letter-spacing:-.5px;font-variant-numeric:tabular-nums;}
.wr .wrc{margin-left:auto;font-size:12px;font-weight:800;color:var(--mut);font-variant-numeric:tabular-nums;}
.wr .meter{width:100%;margin-top:12px;}
.mestats .tile{min-width:0;}
.mefoot{margin-top:auto;}
.mefoot .btn{width:100%;justify-content:center;}
/* гость */
.guest{align-items:center;text-align:center;justify-content:center;gap:16px;}
.guestart{width:96px;height:96px;border-radius:999px;display:grid;place-items:center;color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint);}
.guesth{font-size:20px;font-weight:900;letter-spacing:-.4px;}
.guestp{font-size:13.5px;font-weight:700;color:var(--mut);line-height:1.5;max-width:280px;}
/* турниры */
.tours{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;}
.tour{border-radius:32px;padding:22px;background:var(--grad-surface);box-shadow:var(--sh-raise);display:flex;flex-direction:column;gap:16px;}
.tourname{font-size:20px;font-weight:900;letter-spacing:-.5px;}
.toursub{font-size:12px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.8px;margin-top:4px;}
.tourfoot{display:flex;gap:12px;}
.tourfoot .tile{flex:1;min-width:0;padding:14px 16px;border-radius:22px;}
.tourfoot .tile .tv{font-size:22px;}
.tour.empty{align-items:center;justify-content:center;text-align:center;color:var(--mut);font-size:13.5px;font-weight:800;border-radius:32px;background:var(--carve-bg);box-shadow:var(--sh-carve);}
/* матчи — карточка в колонку: турнир, под ним команды строками */
.matchlist{display:flex;flex-direction:column;gap:12px;}
.mcard+.mcard{margin-top:0;}
/* нижний ряд: матчи фиксированной ширины + баллы на остаток, высоты равны */
.lower{display:grid;grid-template-columns:400px 340px;justify-content:space-between;gap:20px;align-items:start;}
.lower .slab{min-height:640px;}
/* в узкой колонке шапка блока в две строки: заголовок и вкладки под ним */
.slab.matches .shead{flex-wrap:wrap;}
.slab.matches .l3bar{margin-left:0;width:100%;}
.slab.matches .tab{flex:1;text-align:center;padding:11px 0;}
.mcard{border-radius:24px;padding:4px 8px 8px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.mchead{display:flex;align-items:center;gap:9px;height:40px;padding:0 10px;border-bottom:1px solid var(--line);}
.mchead .tn{font-size:12px;font-weight:800;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mchead .when{margin-left:auto;font-size:11.5px;font-weight:800;color:var(--sub);font-variant-numeric:tabular-nums;white-space:nowrap;}
.mcteam{display:flex;align-items:center;gap:11px;height:40px;padding:0 11px;border-radius:16px;}
.mcteam .nm{font-size:14px;font-weight:900;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.mcteam .sc{margin-left:auto;font-size:17px;font-weight:900;font-variant-numeric:tabular-nums;padding-right:4px;}
/* проигравшая сторона приглушена — счёт читается без разбора цифр */
.mcteam.lose .nm,.mcteam.lose .sc{color:var(--sub);}
.mcteam.win{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.mcteam.win .nm,.mcteam.win .sc{color:var(--mint-ink);}
.mcteam.soon .sc{font-size:13px;color:var(--mut);}
/* топы */

.rtabs{margin-left:auto;display:flex;gap:5px;padding:5px;border-radius:16px;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.rtabs span{border-radius:12px;padding:7px 12px;font-size:12px;font-weight:800;color:var(--mut);}
.rtabs span.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* строка без колонки команды — второй топ живёт в узкой колонке */
.trline.slim{grid-template-columns:28px 1fr 60px;gap:10px;height:40px;padding:0 12px;}
.top10{border-radius:28px;padding:8px;background:var(--grad-surface);box-shadow:var(--sh-raise);flex:1;}
.trline{display:grid;grid-template-columns:34px 1fr 150px 84px;align-items:center;gap:12px;padding:10px 14px;border-radius:22px;font-weight:800;}
.trline+.trline{margin-top:2px;}
.trline.lead{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);color:var(--mint-ink);}
.trn{font-size:15px;font-weight:900;font-variant-numeric:tabular-nums;text-align:center;color:var(--mut);}
.trline.lead .trn{color:var(--mint-ink);}
.trnick{font-size:15px;font-weight:900;letter-spacing:-.2px;display:flex;align-items:center;gap:10px;min-width:0;}
.trteam{font-size:12px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.trval{text-align:right;font-size:15px;font-weight:900;font-variant-numeric:tabular-nums;}
/* мобильная колонка */
.mpage{width:390px;padding:14px 16px 40px;display:flex;flex-direction:column;gap:20px;}
.mpage .stitle{font-size:18px;}
.mpage .top,.mpage .tops{grid-template-columns:1fr;gap:16px;}
.mpage .hero{border-radius:30px;padding:14px;}
.mpage .heroart{height:170px;border-radius:22px;}
.mpage .heroh{font-size:21px;}
.mpage .me{border-radius:30px;padding:18px;}
.mscroll{display:flex;gap:14px;overflow:hidden;}
.mscroll .tour{width:250px;flex:none;}
`;

const svg = (d, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const I = {
  bell:   svg('<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/>', 22),
  user:   svg('<circle cx="12" cy="9" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>'),
  mail:   svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
  shield: svg('<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>'),
  gear:   svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3"/>'),
  exit:   svg('<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>'),
  chev:   svg('<path d="M9 6l6 6-6 6"/>', 14),
  user:   svg('<circle cx="12" cy="9" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>', 36),
  down:   svg('<path d="M6 9l6 6 6-6"/>', 14),
};

// Шапка: три отдельных острова — бренд, меню, вход. «LOST cup» акцентный, до «Главной».
const bar = (auth) => `<div class="topbar">
  <div class="island brandbox"><span class="blogo">S</span><span style="font-size:15px;font-weight:900;letter-spacing:-.2px">SPIRIT CTRL</span></div>
  <div class="island"><div class="navset">
    <span class="pill cup">LOST cup</span><span class="pill on">Главная</span><span class="pill">Новости</span><span class="pill">Правила</span><span class="pill">Команды</span><span class="pill">Игроки</span>
  </div></div>
  <div class="spacer"></div>
  <div class="island">
    ${auth === "guest" ? "" : `<span class="bellwrap"><span class="btn quiet ib round">${I.bell}</span><span class="bellbd">3</span></span>`}
    ${auth === "guest"
      ? `<span class="btn sm solid">Войти</span>`
      : `<span class="userchip"><span class="av" style="width:30px;height:30px"></span>Ник игрока${I.down}</span>`}
  </div>
</div>`;

const hero = `<div class="hero">
  <div class="heroart"><span class="ph">Графика новости / анонса</span></div>
  <div class="herotext">
    <span class="herokicker">Новости · 12 сентября</span>
    <h2 class="heroh">Групповой этап LOST cup #3 закрыт: восемь команд идут в плей-офф</h2>
    <p class="herop">Разбираем, кто прошёл с первого места, кто вытащил серию на тай-брейке и что осталось решить в последнем туре нижнего дивизиона.</p>
    <div class="dots"><i class="on"></i><i></i><i></i><i></i></div>
  </div>
</div>`;

const meCard = `<div class="me">
  <div class="mehead">
    <div class="meav">Н</div>
    <div>
      <div class="menick">Ник игрока</div>
      <div class="meteam"><span class="tmark" style="width:22px;height:22px;border-radius:8px;font-size:10px">TM</span>Название команды</div>
      <div class="merole">Позиция 3 · оффлейн</div>
    </div>
  </div>
  <div class="mestats">
    <div class="tile"><div class="tl">MMR</div><div class="tv">5 430</div></div>
    <div class="tile acc"><div class="tl">Место в TR</div><div class="tv">14</div></div>
  </div>
  <div class="wr">
    <div class="tl">Винрейт за сезон</div>
    <div class="wrtop"><span class="wrv">67%</span><span class="wrc">12–6</span></div>
    <div class="meter"><i style="width:67%"></i></div>
  </div>
  <div class="mefoot"><span class="btn quiet">Мой профиль</span></div>
</div>`;

const guestCard = `<div class="me guest">
  <div class="guestart">${I.user}</div>
  <div class="guesth">Войди в аккаунт</div>
  <p class="guestp">Профиль игрока, статистика сезона и место в рейтинге — после входа.</p>
  <span class="btn solid lg">Войти</span>
</div>`;

const tour = (state, name, season, teams, prize, max) => {
  const meta = { live: ["Идёт", "linear-gradient(135deg,#B7E4CD,#7FC3A4)", "sel"],
                 soon: ["Регистрация открыта", "linear-gradient(135deg,#EFE6C8,#D9C78F)", "sel"],
                 done: ["Завершён", "linear-gradient(135deg,#E2DED4,#C3BDB0)", "plain"] }[state];
  // у турнира с регистрацией в плитке счёт набора и шкала заполнения
  const slots = max
    ? `<div class="tile"><div class="tl">Набрано</div><div class="tv">${teams} / ${max}</div><div class="meter" style="width:100%;margin-top:8px"><i style="width:${Math.round((teams / max) * 100)}%"></i></div></div>`
    : `<div class="tile"><div class="tl">Команд</div><div class="tv">${teams}</div></div>`;
  return `<div class="tour">
  <div><span class="chip ${meta[2]}"><span class="dot" style="background:${meta[1]}"></span>${meta[0]}</span></div>
  <div><div class="tourname">${name}</div><div class="toursub">${season}</div></div>
  <div class="tourfoot">
    ${slots}
    <div class="tile"><div class="tl">Призовой</div><div class="tv">${prize}</div></div>
  </div>
</div>`;
};

const mcard = (tour, when, a, b, score) => {
  const cls = (mine, other) => score === null ? " soon" : mine > other ? " win" : " lose";
  const line = (t, mine, other) => `<div class="mcteam${cls(mine, other)}">
    <span class="tmark" style="width:28px;height:28px;border-radius:11px;font-size:10px">${t[1]}</span><span class="nm">${t[0]}</span>
    <span class="sc">${score === null ? "—" : mine}</span>
  </div>`;
  return `<div class="mcard">
  <div class="mchead"><span class="tmark" style="width:22px;height:22px;border-radius:9px;font-size:9px">LC</span><span class="tn">${tour}</span><span class="when">${when}</span></div>
  ${line(a, score ? score[0] : 0, score ? score[1] : 0)}
  ${line(b, score ? score[1] : 0, score ? score[0] : 0)}
</div>`;
};

const matches = `<div class="slab matches">
  <div class="shead"><div class="stitle">Матчи</div>
    <div class="l3bar"><span class="tab on">Прошедшие</span><span class="tab">Сегодня</span><span class="tab">Будущие</span></div>
  </div>
  <div class="matchlist">
    ${mcard("LOST cup #3", "03.09 в 23:30", ["Название команды", "TA"], ["Вторая команда", "TB"], [0, 1])}
    ${mcard("LOST cup #3", "03.09 в 23:30", ["Третья команда", "TC"], ["Четвёртая", "TD"], [1, 0])}
    ${mcard("LOST cup #3", "03.09 в 22:30", ["Пятая команда", "TE"], ["Шестая команда", "TF"], [0, 1])}
  </div>
  <div class="dmore">все матчи ${I.chev}</div>
</div>`;

const topRow = (n, nick, team, val, lead) => `<div class="trline${team === null ? " slim" : ""}${lead ? " lead" : ""}">
  <div class="trn">${n}</div>
  <div class="trnick"><span class="av" style="width:30px;height:30px"></span>${nick}</div>
  ${team === null ? "" : `<div class="trteam">${team}</div>`}
  <div class="trval">${val}</div>
</div>`;

const top10 = (rows, slim) => `<div class="top10">${rows.map((r, i) => topRow(i + 1, r[0], slim ? null : r[1], r[2], i === 0)).join("")}</div>`;

// TP и Shards живут в одном блоке: переключатель вместо второй таблицы
const TP = [["Ник игрока", "", "128"], ["Второй ник", "", "115"], ["Третий ник", "", "104"], ["Четвёртый", "", "97"], ["Пятый ник", "", "91"],
  ["Шестой ник", "", "84"], ["Седьмой", "", "78"], ["Восьмой ник", "", "71"], ["Девятый", "", "66"], ["Десятый ник", "", "60"]];

const tops = `<div class="slab">
    <div class="shead"><div class="stitle">Баллы</div><div class="rtabs"><span class="on">TP</span><span>Shards</span></div></div>
    ${top10(TP, true)}
    <div class="dmore">весь топ ${I.chev}</div>
  </div>`;

const toursSect = `<div class="slab">
  <div class="shead"><div class="stitle">Турниры</div></div>
  <div class="tours">
    ${tour("live", "LOST cup #3", "Сезон 3 · дивизион 1", "16", "50 000 ₽")}
    ${tour("soon", "LOST cup #4", "Приём заявок до 20.09", "8", "30 000 ₽", "16")}
    ${tour("done", "LOST cup #2", "Сезон 2 · завершён", "16", "40 000 ₽")}
  </div>
  <div class="dmore">все турниры ${I.chev}</div>
</div>`;


// Меню игрока и панель уведомлений — состояния шапки, отдельным листом
const playerMenu = `<div class="drop menu">
  <div class="dhead">
    <span class="av" style="width:42px;height:42px"></span>
    <div><div class="nm">Ник игрока</div><div class="sub">Название команды · оффлейн</div></div>
  </div>
  <div class="ditem">${I.user}Мой профиль</div>
  <div class="ditem">${I.mail}Сообщения<span class="cnt">2</span></div>
  <div class="dsep"></div>
  <div class="ditem">${I.shield}Админ</div>
  <div class="dsep"></div>
  <div class="ditem">${I.gear}Настройки</div>
  <div class="ditem down">${I.exit}Выйти</div>
</div>`;

const noti = (icon, sys, title, body, time, unread) => `<div class="nrow${unread ? " unread" : ""}">
  <span class="nicon${sys ? " sys" : ""}">${icon}</span>
  <div class="ntext"><div class="ntitle">${title}</div><div class="nbody">${body}</div></div>
  <span class="ntime">${time}</span>
</div>`;

const notiPanel = `<div class="drop noti">
  <div class="dhead"><div><div class="nm">Уведомления</div><div class="sub">3 непрочитанных</div></div><span class="act">прочитать все</span></div>
  <div class="ngroup">Служебные</div>
  ${noti(I.chev, true, "Матч через 30 минут", "LOST cup #3 · Название команды — Вторая команда", "19:30", true)}
  ${noti(I.shield, true, "Заявка принята", "Ты добавлен в состав «Название команды» на сезон 3", "вчера", true)}
  <div class="ngroup">Личные</div>
  ${noti(I.mail, false, "Сообщение от капитана", "«Готов на сегодня? Сбор за 15 минут до старта»", "18:04", true)}
  ${noti(I.user, false, "Приглашение в команду", "«Третья команда» зовёт тебя на позицию 3", "10.09", false)}
</div>`;

const boards = {
  Menus: `<div class="page" style="padding-bottom:36px;gap:20px">
  ${bar("auth")}
  <div class="row" style="gap:36px;align-items:flex-start;margin-top:6px">
    <div>
      <div class="herokicker" style="margin-bottom:12px">Меню игрока · открыто по клику на аватар</div>
      ${playerMenu}
    </div>
    <div>
      <div class="herokicker" style="margin-bottom:12px">Уведомления · открыты по клику на колокольчик</div>
      ${notiPanel}
    </div>
  </div>
</div>`,

  Main: `<div class="page">
  ${bar("auth")}
  <div class="top">${hero}${meCard}</div>
  ${toursSect}
  <div class="lower">${matches}${tops}</div>
</div>`,

  Guest: `<div class="page" style="padding-bottom:40px">
  ${bar("guest")}
  <div class="top">${hero}${guestCard}</div>
  <div class="slab">
    <div class="shead"><div class="stitle">Турниры</div></div>
    <div class="tours">
      ${tour("live", "LOST cup #3", "Сезон 3 · дивизион 1", "16", "50 000 ₽")}
      ${tour("soon", "LOST cup #4", "Приём заявок до 20.09", "8", "30 000 ₽", "16")}
      <div class="tour empty">Завершённых турниров<br>пока нет</div>
    </div>
    <div class="dmore">все турниры ${I.chev}</div>
  </div>
</div>`,

  Mobile: `<div class="mpage">
  <div class="mbar">
    <span class="burger"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span>
    <div class="brand" style="font-size:14px"><span class="blogo" style="width:34px;height:34px;border-radius:12px;font-size:13px">S</span>SPIRIT CTRL</div>
    <div class="spacer"></div>
    <span class="btn sm solid">Войти</span>
  </div>
  ${guestCard}
  <div class="hero">
    <div class="heroart"><span class="ph">Графика новости</span></div>
    <div class="herotext">
      <span class="herokicker">Новости · 12 сентября</span>
      <h2 class="heroh">Групповой этап LOST cup #3 закрыт</h2>
      <p class="herop">Восемь команд идут в плей-офф, последний тур решает нижний дивизион.</p>
      <div class="dots"><i class="on"></i><i></i><i></i><i></i></div>
    </div>
  </div>
  <div class="slab">
    <div class="shead"><div class="stitle">Турниры</div></div>
    <div class="mscroll">
      ${tour("live", "LOST cup #3", "Сезон 3 · дивизион 1", "16", "50 000 ₽")}
      ${tour("soon", "LOST cup #4", "Приём заявок до 20.09", "8", "30 000 ₽", "16")}
    </div>
    <div class="dmore">все турниры ${I.chev}</div>
  </div>
  <div class="slab">
    <div class="shead"><div class="stitle">Матчи</div></div>
    <div class="l3bar"><span class="tab on">Идут</span><span class="tab">Ближайшие</span><span class="tab">Итоги</span></div>
    <div class="matchlist" style="grid-template-columns:1fr;gap:10px">
      ${mcard("LOST cup #3", "сегодня в 19:00", ["Команда A", "TA"], ["Команда B", "TB"], [2, 1])}
      ${mcard("LOST cup #3", "завтра в 20:00", ["Команда C", "TC"], ["Команда D", "TD"], null)}
    </div>
  </div>
  <div class="slab">
    <div class="shead"><div class="stitle">Баллы</div><div class="rtabs"><span class="on">TP</span><span>Shards</span></div></div>
    <div class="top10" style="padding:8px">${[0,1,2,3,4].map((i) => `<div class="trline slim${i===0?" lead":""}"><div class="trn">${i+1}</div><div class="trnick"><span class="av" style="width:28px;height:28px"></span>${TP[i][0]}</div><div class="trval">${TP[i][2]}</div></div>`).join("")}</div>
  <div class="dmore">весь топ ${I.chev}</div>
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
<helmet><style>${BASE}${HOME}</style></helmet>
${content}
</x-dc>
</body>
</html>
`;

for (const [name, content] of Object.entries(boards)) {
  writeFileSync(new URL(`./${name}.dc.html`, import.meta.url), wrap(content));
  console.log("wrote", name + ".dc.html");
}
