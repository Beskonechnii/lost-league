import { writeFileSync } from "node:fs";

// Зафиксированный рецепт объёма: направленный свет ↖, светлая оконтовка, растушёванные тени,
// idisc/iwell для вложенных элементов. Всё — через переменные-рецепты (перенос в pouf.css прямой).
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
:root{
  /* --mut затемнён против первой редакции Кита (#807C73 → #69655D, 04.09.2026): на бумаге
     старое значение давало 3.24:1, а им набрана вся мелочь 11px/800 — шапки колонок, теги,
     легенды. #69655D — 4.52:1, минимальное значение, проходящее AA. Разбор — DECISIONS.md.
     --sub (1.81:1) оставлен, но он ДЕКОРАТИВНЫЙ: точка, штрих, разделитель, не текст. */
  --paper:#E7E3D8;--ink:#33322E;--mut:#69655D;--sub:#AEAAA0;--line:#E0DACE;--line2:#D3CCBE;--mint-ink:#184636;
  --grad-surface:linear-gradient(135deg,#FFFFFF,#F8F4EC 55%,#EEE8DD);
  --grad-mint:linear-gradient(135deg,#D5F2E2,#A9DCC3 52%,#8CCBAD);
  --grad-board:linear-gradient(135deg,#FDFBF6,#F1ECE1);
  /* приподнятая поверхность — крупная */
  --sh-raise:0 0 0 1px rgba(255,255,255,.55),inset 2px 3px 4px -1px rgba(255,255,255,.95),inset -3px -4px 7px -2px rgba(150,135,105,.30),inset 0 -3px 0 rgba(178,164,132,.24),0 4px 7px rgba(120,108,78,.15),0 22px 40px -8px rgba(120,108,78,.30),0 58px 88px -24px rgba(120,108,78,.22);
  /* приподнятая — мелкая (пилюли, чипы, тайлы) */
  --sh-raise-sm:0 0 0 1px rgba(255,255,255,.55),inset 2px 2px 3px -1px rgba(255,255,255,.95),inset -2px -3px 4px -1px rgba(150,135,105,.28),0 3px 5px rgba(120,108,78,.16),0 12px 22px -5px rgba(120,108,78,.28);
  /* мятный акцент — крупный */
  --sh-mint:0 0 0 1px rgba(255,255,255,.4),inset 2px 3px 4px -1px rgba(255,255,255,.9),inset -3px -4px 6px -2px rgba(70,140,105,.4),inset 0 -3px 0 rgba(84,150,116,.45),0 4px 7px rgba(80,150,115,.26),0 16px 28px -6px rgba(80,150,115,.42),0 34px 50px -16px rgba(80,150,115,.26);
  /* мятный — мелкий */
  --sh-mint-sm:0 0 0 1px rgba(255,255,255,.4),inset 2px 2px 3px -1px rgba(255,255,255,.9),inset -2px -3px 4px -1px rgba(70,140,105,.38),0 3px 5px rgba(80,150,115,.26),0 12px 22px -5px rgba(80,150,115,.42);
  /* вдавленное (поля, лунки, дорожки) */
  --sh-carve:inset 2px 3px 5px rgba(120,108,78,.26),inset -1px -1px 1px rgba(255,255,255,.55),inset 0 -1px 0 rgba(255,255,255,.4);
  --carve-bg:#ECE7DD;
}
*{box-sizing:border-box;} h1,h2,h3,p{margin:0;}
body{margin:0;background:var(--paper);color:var(--ink);font-family:'Nunito',system-ui,sans-serif;-webkit-font-smoothing:antialiased;background-image:radial-gradient(120% 80% at 12% 0%,rgba(255,255,255,.42),transparent 55%);}
.board{margin:40px;padding:44px 48px 58px;border-radius:46px;background:var(--grad-board);max-width:1120px;
  box-shadow:0 0 0 1px rgba(255,255,255,.6),inset 3px 4px 6px -1px rgba(255,255,255,.95),inset -4px -5px 10px -2px rgba(150,135,105,.22),inset 0 -4px 0 rgba(178,164,132,.2),0 6px 10px rgba(120,108,78,.14),0 34px 60px -10px rgba(120,108,78,.30),0 90px 130px -30px rgba(120,108,78,.20);}
.title{font-size:36px;font-weight:900;letter-spacing:-1.2px;} .subt{color:var(--mut);font-weight:700;font-size:14px;margin-top:8px;}
.h2{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:2px;color:var(--sub);margin:36px 0 18px;border-top:1px solid var(--line);padding-top:22px;}
.lbl{font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.6px;margin-bottom:11px;}
.row{display:flex;gap:16px;flex-wrap:wrap;align-items:center;} .cols{display:grid;grid-template-columns:1fr 1fr;gap:42px;}
.raise{border-radius:30px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
/* вложенные элементы */
.idisc{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;color:var(--mint-ink);background:linear-gradient(135deg,#FFFFFF,#E6F4EE);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 1px 1px 2px rgba(255,255,255,.95),inset -1px -2px 3px rgba(70,140,105,.34),0 3px 5px -1px rgba(40,100,76,.32);}
.idisc.neu{color:var(--mut);background:linear-gradient(135deg,#FFFFFF,#EEE9DF);box-shadow:0 0 0 1px rgba(255,255,255,.55),inset 1px 1px 2px rgba(255,255,255,.95),inset -1px -2px 3px rgba(150,135,105,.32),0 3px 5px -1px rgba(120,108,78,.26);}
.iwell{width:26px;height:26px;border-radius:999px;display:grid;place-items:center;color:#2E7D5E;background:#E7F2EC;box-shadow:inset 2px 3px 4px rgba(40,100,76,.32),inset -1px -1px 0 rgba(255,255,255,.5);}
/* buttons */
.btn{border-radius:22px;padding:14px 26px;font-size:15px;font-weight:900;display:inline-flex;align-items:center;gap:9px;color:var(--mint-ink);}
.btn.sm{border-radius:18px;padding:10px 18px;font-size:13px;} .btn.lg{border-radius:26px;padding:18px 32px;font-size:17px;}
.solid{background:var(--grad-mint);box-shadow:var(--sh-mint);}
.hover{background:linear-gradient(135deg,#DEF6EA,#B2E1CB 52%,#94D2B5);box-shadow:0 0 0 1px rgba(255,255,255,.45),inset 2px 3px 4px -1px rgba(255,255,255,1),inset -3px -4px 7px -2px rgba(70,140,105,.44),0 6px 10px rgba(80,155,116,.3),0 22px 36px -6px rgba(80,155,116,.5),0 44px 62px -18px rgba(80,155,116,.3);transform:translateY(-3px);}
.press{background:linear-gradient(135deg,#B8E2CB,#8CC9AA);box-shadow:0 0 0 1px rgba(255,255,255,.3),inset 3px 4px 8px rgba(40,105,76,.5),inset -1px -1px 2px rgba(255,255,255,.4);transform:translateY(3px);}
.disabled{color:#9C988F;background:linear-gradient(135deg,#EFEBE2,#DFD9CD);box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 1px 1px 2px rgba(255,255,255,.6),inset -1px -2px 3px rgba(150,135,105,.2),0 3px 6px rgba(120,108,78,.12);}
.quiet{color:var(--ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.ib{width:52px;padding:0;justify-content:center;} .ib.sm{width:42px;} .ib.lg{width:60px;} .ib.round{border-radius:999px;}
.spin{width:16px;height:16px;border-radius:50%;border:3px solid rgba(24,70,54,.3);border-top-color:#184636;display:inline-block;}
/* pills */
.pill{display:inline-flex;align-items:center;border-radius:20px;padding:11px 18px;font-size:13px;font-weight:800;color:var(--mut);}
.pill.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.pill.field{color:var(--ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.sep{width:1px;height:24px;background:var(--line2);margin:0 5px;}
/* segmented / tabs */
.segset{display:inline-flex;gap:9px;padding:9px;border-radius:24px;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.seg{border-radius:18px;padding:12px 22px;font-size:14px;font-weight:800;color:var(--mut);}
.seg.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* fields */
.field{display:flex;align-items:center;gap:12px;border-radius:22px;padding:16px 20px;font-size:14px;font-weight:700;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.field.focus{box-shadow:var(--sh-carve),0 0 0 4px rgba(18,190,178,.5);color:var(--ink);}
.field.area{align-items:flex-start;min-height:100px;}
.fico{margin-left:auto;color:var(--mut);}
.flabel{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);margin-bottom:8px;display:block;}
.chkrow{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:800;}
.chk{width:28px;height:28px;border-radius:11px;flex:none;display:grid;place-items:center;}
.chk.off{background:var(--carve-bg);box-shadow:var(--sh-carve);}
.chk.on{background:var(--grad-mint);color:var(--mint-ink);box-shadow:var(--sh-mint-sm);}
/* radio */
.radio{width:28px;height:28px;border-radius:999px;flex:none;display:grid;place-items:center;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.radio.on{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.radio .in{width:12px;height:12px;border-radius:999px;background:#184636;box-shadow:inset 0 -1px 1px rgba(0,0,0,.25);}
/* switch */
.switch{width:72px;height:42px;border-radius:999px;padding:5px;display:flex;align-items:center;}
.switch.off{background:var(--carve-bg);justify-content:flex-start;box-shadow:var(--sh-carve);}
.switch.on{background:var(--grad-mint);justify-content:flex-end;box-shadow:var(--sh-mint-sm);}
.knob{width:32px;height:32px;border-radius:999px;background:linear-gradient(135deg,#FFFFFF,#EFEBE2);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 1px 1px 2px rgba(255,255,255,1),inset -1px -2px 3px rgba(150,135,105,.24),0 4px 7px -1px rgba(120,108,78,.34);}
/* pagination */
.pager{display:flex;gap:9px;align-items:center;}
.pg{min-width:46px;height:46px;padding:0 12px;border-radius:16px;display:grid;place-items:center;font-weight:800;font-size:14px;color:var(--mut);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.pg.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.pg.gap{background:none;box-shadow:none;color:var(--sub);}
/* chips/badges */
.chip{border-radius:999px;padding:9px 16px;font-size:12px;font-weight:800;display:inline-flex;align-items:center;gap:7px;}
.chip.plain{color:var(--mut);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.chip.sel{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.chip.dis{color:#A6A299;background:linear-gradient(135deg,#EDE9E0,#DFD9CD);box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 1px 1px 2px rgba(255,255,255,.6),inset -1px -2px 3px rgba(150,135,105,.18);}
.dot{width:10px;height:10px;border-radius:999px;box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 1px 1px 1px rgba(255,255,255,.5),inset -1px -2px 2px rgba(0,0,0,.22);}
.badge{border-radius:999px;padding:8px 15px;font-size:12px;font-weight:900;box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 2px 2px 3px -1px rgba(255,255,255,.6),inset -2px -3px 4px -1px rgba(0,0,0,.08),0 4px 8px -2px rgba(120,108,78,.2);}
/* stattile */
.tile{border-radius:26px;padding:18px 20px;background:var(--grad-surface);box-shadow:var(--sh-raise);min-width:130px;}
.tile.acc{background:var(--grad-mint);box-shadow:var(--sh-mint);}
.tile .tl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);} .tile.acc .tl{color:rgba(24,70,54,.72);}
.tile .tv{font-size:28px;font-weight:900;letter-spacing:-.5px;margin-top:4px;font-variant-numeric:tabular-nums;} .tile.acc .tv{color:var(--mint-ink);}
.tile .th{font-size:12px;font-weight:700;color:var(--mut);margin-top:2px;}
.meter{height:11px;border-radius:999px;background:var(--carve-bg);box-shadow:var(--sh-carve);overflow:hidden;width:220px;}
.meter>i{display:block;height:100%;border-radius:999px;background:linear-gradient(135deg,#C4EAD7,#8CC9AA);box-shadow:0 0 0 1px rgba(255,255,255,.3),inset 1px 1px 1px rgba(255,255,255,.5),inset -1px -2px 3px rgba(40,105,76,.3);}
/* avatar / marks */
.av{border-radius:999px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);flex:none;}
.tmark{border-radius:14px;background:var(--grad-surface);display:inline-grid;place-items:center;font-size:12px;font-weight:800;color:var(--mut);box-shadow:var(--sh-raise-sm);flex:none;}
.zbar{width:7px;height:26px;border-radius:999px;box-shadow:0 0 0 1px rgba(255,255,255,.35),inset 1px 1px 1px rgba(255,255,255,.4),inset -1px -2px 2px rgba(0,0,0,.22);display:inline-block;vertical-align:middle;}
.pts{display:inline-block;min-width:34px;text-align:center;border-radius:999px;padding:6px 14px;font-weight:900;font-variant-numeric:tabular-nums;color:var(--ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.pts.lead{background:var(--grad-mint);color:var(--mint-ink);box-shadow:var(--sh-mint-sm);}
.avg{display:flex;align-items:center;} .avg .av{border:4px solid #F6F2EB;margin-left:-14px;} .avg .av:first-child{margin-left:0;}
.avg .more{margin-left:-14px;border:4px solid #F6F2EB;border-radius:999px;display:grid;place-items:center;font-weight:900;font-size:13px;color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* состояния — универсальные модификаторы (работают на любом элементе) */
.h{transform:translateY(-2px);filter:drop-shadow(0 14px 18px rgba(120,108,78,.3));}
.p{transform:translateY(3px);filter:brightness(.93) saturate(1.05);}
.f{outline:3px solid rgba(18,190,178,.55);outline-offset:3px;}
.strow{display:flex;gap:26px;align-items:center;flex-wrap:wrap;margin-bottom:14px;}
.scell{text-align:center;} .scap{font-size:10px;font-weight:800;text-transform:uppercase;color:var(--sub);margin-top:9px;letter-spacing:.5px;}
.fam{font-size:14px;font-weight:900;width:120px;color:var(--ink);flex:none;}
/* alerts — компактные (обжимают контент) */
.alert{display:inline-flex;align-items:center;gap:10px;border-radius:16px;padding:11px 15px;font-size:13px;font-weight:800;max-width:100%;
  box-shadow:0 0 0 1px rgba(255,255,255,.35),inset 2px 3px 4px -1px rgba(255,255,255,.7),inset -2px -3px 6px -1px rgba(90,70,40,.16),0 4px 7px rgba(120,108,78,.14),0 12px 22px -8px rgba(120,108,78,.22);}
.alert .aic{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.72);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 1px 1px 2px #fff,inset -1px -2px 3px rgba(0,0,0,.08),0 3px 5px -1px rgba(0,0,0,.16);flex:none;}
.alert.mini{gap:8px;padding:6px 12px 6px 8px;border-radius:999px;font-size:12px;}
.alert.mini .aic{width:22px;height:22px;}
.alertcol{display:flex;flex-direction:column;align-items:flex-start;gap:10px;}
.alert.ok{color:#184636;background:linear-gradient(135deg,#D6F0E1,#9CD3B6);}
.alert.warn{color:#7A5A16;background:linear-gradient(135deg,#F7E3AA,#E8C56E);}
.alert.err{color:#7C2F2F;background:linear-gradient(135deg,#F5C8C8,#E39191);}
.alert.info{color:#1E4A66;background:linear-gradient(135deg,#C4E2F3,#98C5E4);}
/* empty/skeleton/toast */
.empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:32px;text-align:center;border-radius:28px;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.sk{border-radius:16px;background:linear-gradient(90deg,#E9E4DB 25%,#DAD4C8 50%,#E9E4DB 75%);box-shadow:var(--sh-carve);}
.toast{display:flex;align-items:center;gap:12px;border-radius:22px;padding:15px 17px;font-size:14px;font-weight:800;width:330px;
  box-shadow:0 0 0 1px rgba(255,255,255,.35),inset 2px 3px 4px -1px rgba(255,255,255,.75),inset -2px -3px 6px -1px rgba(90,70,40,.16),0 6px 10px rgba(120,108,78,.16),0 20px 34px -8px rgba(120,108,78,.28);}
.toast .tic{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.72);display:grid;place-items:center;box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 1px 1px 2px #fff,inset -1px -2px 3px rgba(0,0,0,.08),0 3px 5px -1px rgba(0,0,0,.16);flex:none;}
/* overlays */
.scrim{border-radius:32px;padding:30px;background:radial-gradient(120% 120% at 50% 0%,rgba(120,108,78,.3),rgba(90,80,55,.46));display:flex;justify-content:center;}
.dialog{width:390px;border-radius:34px;padding:26px;background:var(--grad-surface);box-shadow:0 0 0 1px rgba(255,255,255,.55),inset 2px 3px 4px -1px rgba(255,255,255,.95),inset -3px -4px 7px -2px rgba(150,135,105,.28),0 36px 72px -8px rgba(60,50,30,.5);}
.dhead{display:flex;justify-content:space-between;align-items:flex-start;}
.dtitle{font-size:21px;font-weight:900;} .ddesc{font-size:13px;font-weight:700;color:var(--mut);margin-top:6px;line-height:1.5;}
.xbtn{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:var(--mut);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);flex:none;}
.sheet{width:310px;border-radius:30px 0 0 30px;padding:24px;background:var(--grad-surface);box-shadow:0 0 0 1px rgba(255,255,255,.55),inset 2px 3px 4px -1px rgba(255,255,255,.95),-22px 0 50px -10px rgba(60,50,30,.34);}
.navlink{display:flex;align-items:center;gap:12px;padding:13px 15px;border-radius:18px;font-size:15px;font-weight:800;color:var(--ink);}
.navlink.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.menu{border-radius:24px;padding:9px;background:var(--grad-surface);box-shadow:0 0 0 1px rgba(255,255,255,.55),inset 2px 3px 4px -1px rgba(255,255,255,.95),0 24px 46px -10px rgba(120,108,78,.36);width:240px;}
.mi{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:15px;font-size:14px;font-weight:800;color:var(--ink);}
.mi.hl{background:var(--carve-bg);box-shadow:var(--sh-carve);}
.mi.down{color:#B4595A;} .msep{height:1px;background:var(--line);margin:7px 9px;}
.tip{background:#33322E;color:#F5F2EC;border-radius:14px;padding:10px 14px;font-size:12px;font-weight:800;box-shadow:0 0 0 1px rgba(255,255,255,.06),inset 0 1px 0 rgba(255,255,255,.12),0 14px 26px -6px rgba(60,55,45,.44);display:inline-block;position:relative;}
.tip:after{content:"";position:absolute;left:24px;bottom:-6px;width:12px;height:12px;background:#33322E;transform:rotate(45deg);}
/* structure */
.eyebrow{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:2.5px;color:#5FA383;}
.sh1{font-size:34px;font-weight:900;letter-spacing:-.8px;margin-top:6px;}
.crumbs{font-size:13px;font-weight:800;color:var(--sub);display:flex;gap:9px;align-items:center;} .crumbs .c{color:var(--mut);}
.tcard{border-radius:30px;padding:20px;width:300px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.prow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line);}
.prole{margin-left:auto;font-size:10px;font-weight:800;text-transform:uppercase;color:var(--sub);}
.rowcard{display:flex;align-items:center;gap:12px;border-radius:20px;padding:13px 15px;}
.rowcard.sel{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.rowcard.idle{background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
/* accordion */
.acc{display:flex;flex-direction:column;gap:16px;max-width:600px;}
.accitem{border-radius:28px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.acchead{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;font-weight:900;font-size:16px;}
.accbody{padding:0 24px 22px;font-size:14px;font-weight:700;color:var(--mut);line-height:1.55;}
.chev{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);}
/* hero */
.hero{position:relative;border-radius:38px;overflow:hidden;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.herowash{position:absolute;inset:0;background:radial-gradient(70% 120% at 8% 0%,rgba(140,203,173,.5),transparent 55%);pointer-events:none;}
.bigav{width:150px;height:150px;border-radius:34px;flex:none;display:grid;place-items:center;font-size:52px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint);}
.herochip{border-radius:999px;padding:8px 15px;font-size:13px;font-weight:800;color:var(--mut);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);display:inline-flex;align-items:center;gap:7px;}
.herochip.tp{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.linkchip{border-radius:16px;padding:8px 14px;font-size:12px;font-weight:800;color:var(--mut);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
/* bracket */
.match{border-radius:22px;overflow:hidden;background:var(--grad-surface);box-shadow:var(--sh-raise);width:220px;}
.mteam{display:flex;align-items:center;gap:10px;padding:11px 14px;font-size:14px;font-weight:800;}
.mteam+.mteam{border-top:1px solid var(--line);}
.mteam.win{color:var(--mint-ink);} .mteam .sc{margin-left:auto;font-weight:900;font-variant-numeric:tabular-nums;}
.mteam.win .sc{color:var(--mint-ink);} .mteam.lose .sc{color:var(--sub);}
/* calendar — атом даты: нав/месяц/год блоками, выбранный день вдавлен и кругл */
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
`;

// дни календаря для показа (нейтральный пример: выбран 12)
const calDays = () => {
  let c = "";
  [26, 27, 28].forEach((d) => (c += `<div class="calday mut">${d}</div>`));
  for (let d = 1; d <= 31; d++) c += `<div class="calday${d === 12 ? " sel" : ""}">${d}</div>`;
  for (let d = 1; d <= 8; d++) c += `<div class="calday mut">${d}</div>`;
  return c;
};
const csvg = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const boards = {
"Main": `<div class="board">
  <h1 class="title">Кит · Управление и формы</h1>
  <p class="subt">Light Clay, зафиксированный рецепт: направленный свет ↖, оконтовка, растушёванные тени, вложенные элементы (idisc/iwell).</p>
  <div class="h2">Кнопки · solid</div>
  <div class="row">
    <span class="btn sm solid">Small</span><span class="btn solid">Medium</span><span class="btn lg solid">Large</span>
    <span class="btn solid ib"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></span>
    <span class="btn solid" style="padding-left:13px;gap:11px"><span class="idisc"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>С иконкой</span>
  </div>
  <div class="row" style="margin-top:20px">
    <div><div class="lbl">Default</div><span class="btn solid">Открыть турнир</span></div>
    <div><div class="lbl">Hover</div><span class="btn solid hover">Открыть турнир</span></div>
    <div><div class="lbl">Active</div><span class="btn solid press">Открыть турнир</span></div>
    <div><div class="lbl">Loading</div><span class="btn solid"><span class="spin"></span>Отправка…</span></div>
    <div><div class="lbl">Disabled</div><span class="btn disabled">Недоступно</span></div>
  </div>
  <div class="lbl" style="margin-top:18px">Иконочные — квадрат / круг</div>
  <div class="row" style="gap:11px">
    <span class="btn solid ib"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></span>
    <span class="btn solid ib round"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg></span>
    <span class="btn quiet ib"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg></span>
    <span class="btn quiet ib round"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg></span>
  </div>
  <div class="h2">Кнопки · quiet</div>
  <div class="row"><span class="btn sm quiet">Small</span><span class="btn quiet">Подать заявку</span><span class="btn lg quiet">Large</span></div>
  <div class="cols">
    <div><div class="h2">Пилюли навигации</div>
      <div class="lbl">L1 · верхняя строка</div><div class="row" style="gap:9px"><span class="pill on">Турниры</span><span class="pill">Ростер</span><span class="pill">Админ</span></div>
      <div class="lbl" style="margin-top:16px">L2 · контекст турнира</div><div class="row" style="gap:9px"><span class="pill field">LOST S2 ▾</span><span class="pill on">D1</span><span class="pill">D2</span></div>
      <div class="lbl" style="margin-top:16px">L3 · вкладки этапа</div><div class="row" style="gap:9px"><span class="pill on">Таблица</span><span class="pill">Плей-офф</span><span class="pill">Статистика</span></div>
    </div>
    <div><div class="h2">Сегменты и вкладки</div>
      <div class="lbl">Segmented</div><div class="segset"><span class="seg on">Команды</span><span class="seg">Игроки</span></div>
      <div class="lbl" style="margin-top:18px">Tabs</div><div class="segset"><span class="seg on">Обзор</span><span class="seg">Ростер</span><span class="seg">TP</span></div>
    </div>
  </div>
  <div class="h2">Поля ввода</div>
  <div class="cols">
    <div><label class="flabel">Текстовое поле</label><div class="field">Nirvana</div>
      <label class="flabel" style="margin-top:16px">Поиск</label><div class="field">Поиск по командам…<span class="fico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg></span></div>
      <label class="flabel" style="margin-top:16px">Фокус</label><div class="field focus">Empire</div>
    </div>
    <div><label class="flabel">Многострочное</label><div class="field area">Описание команды…</div>
      <div class="lbl" style="margin-top:16px">Чекбоксы</div>
      <div class="chkrow"><span class="chk on"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 6"/></svg></span>Капитан команды</div>
      <div class="chkrow" style="margin-top:12px"><span class="chk off"></span>Показать выбывшие</div>
    </div>
  </div>
  <div class="h2">Select</div>
  <div class="row" style="align-items:flex-start;gap:28px">
    <div><label class="flabel">Закрыт</label><div class="field" style="width:260px">Division 1 <span class="fico"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 9 6 6 6-6"/></svg></span></div></div>
    <div><label class="flabel">Открыт</label>
      <div style="width:260px;border-radius:24px;padding:9px;background:var(--grad-surface);box-shadow:var(--sh-raise)">
        <div style="padding:11px 13px;border-radius:15px;background:var(--grad-mint);color:#184636;font-weight:800;font-size:14px;box-shadow:var(--sh-mint-sm)">Division 1</div>
        <div style="padding:11px 13px;font-weight:800;font-size:14px">Division 2</div>
        <div style="padding:11px 13px;font-weight:800;font-size:14px">Все дивизионы</div>
      </div>
    </div>
  </div>
</div>`,

"DataFeedback": `<div class="board">
  <h1 class="title">Кит · Данные и обратная связь</h1>
  <p class="subt">Чипы, статусы, показатели, элементы таблицы, алерты и тосты.</p>
  <div class="cols">
    <div><div class="h2">Чипы</div>
      <div class="row"><span class="chip plain">carry</span><span class="chip plain">mid</span><span class="chip sel"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 6"/></svg>Выбрано</span><span class="chip dis">Недоступно</span></div>
      <div class="lbl" style="margin-top:18px">Зоны таблицы</div>
      <div class="row"><span class="chip plain"><span class="dot" style="background:#7FC9AC"></span>Верхняя сетка</span><span class="chip plain"><span class="dot" style="background:#63C7BE"></span>Нижняя</span><span class="chip plain"><span class="dot" style="background:#E79B9B"></span>Вылет</span></div>
    </div>
    <div><div class="h2">Статусы турнира</div>
      <div class="row">
        <span class="badge" style="background:linear-gradient(135deg,#EFEBE2,#DFD9CD);color:#8A867D">Черновик</span>
        <span class="badge" style="background:linear-gradient(135deg,#C4E2F3,#98C5E4);color:#1E4A66">Приём заявок</span>
        <span class="badge" style="background:linear-gradient(135deg,#D6F0E1,#9CD3B6);color:#184636">Идёт</span>
        <span class="badge" style="background:linear-gradient(135deg,#F7E3AA,#E8C56E);color:#7A5A16">Завершён</span>
      </div>
    </div>
  </div>
  <div class="h2">Показатели · StatTile</div>
  <div class="row" style="gap:14px">
    <div class="tile acc"><div class="tl">Место</div><div class="tv">1</div><div class="th" style="color:rgba(24,70,54,.72)">из 8</div></div>
    <div class="tile"><div class="tl">Очки</div><div class="tv">18</div><div class="th">6 побед</div></div>
    <div class="tile"><div class="tl">Разница</div><div class="tv" style="color:#3FA981">+11</div></div>
    <div class="tile"><div class="tl">Винрейт</div><div class="tv">74%</div></div>
    <div class="tile" style="min-width:230px"><div class="tl">Сила состава · MMR</div><div class="tv">11 240</div><div class="meter" style="margin-top:11px"><i style="width:78%"></i></div></div>
  </div>
  <div class="h2">Элементы таблицы</div>
  <div class="row" style="gap:24px">
    <div><div class="lbl">Место + зона</div><span class="zbar" style="background:#7FC9AC"></span> <span style="font-weight:900;font-size:16px;margin-left:6px">1</span></div>
    <div><div class="lbl">Лого команды</div><span class="tmark" style="width:40px;height:40px">NV</span></div>
    <div><div class="lbl">Аватар</div><span class="av" style="width:40px;height:40px;display:inline-block"></span></div>
    <div><div class="lbl">Очки · лидер / обычные</div><span class="pts lead">9</span> <span class="pts" style="margin-left:8px">6</span></div>
    <div><div class="lbl">Счёт W–L</div><span style="font-weight:800;font-size:15px"><span style="color:#3FA981">3</span><span style="color:var(--sub)">–0</span></span></div>
  </div>
  <div class="cols">
    <div><div class="h2">Алерты — компактные</div>
      <div class="alertcol">
        <div class="alert ok"><span class="aic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#184636" stroke-width="2.6"><path d="m5 12 5 5L20 6"/></svg></span>Заявка принята</div>
        <div class="alert warn"><span class="aic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A5A16" stroke-width="2.4"><path d="M12 4 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg></span>3 игрока без account_id</div>
        <div class="alert err"><span class="aic"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7C2F2F" stroke-width="2.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/></svg></span>Матч не найден</div>
      </div>
      <div class="lbl" style="margin-top:16px">Мини — статус-пилюли</div>
      <div class="row" style="gap:9px">
        <span class="alert ok mini"><span class="aic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#184636" stroke-width="3"><path d="m5 12 5 5L20 6"/></svg></span>Принята</span>
        <span class="alert warn mini"><span class="aic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7A5A16" stroke-width="2.6"><path d="M12 4 2 20h20z"/></svg></span>Проверьте id</span>
        <span class="alert err mini"><span class="aic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7C2F2F" stroke-width="2.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/></svg></span>Ошибка</span>
      </div>
    </div>
    <div><div class="h2">Тосты</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="toast" style="color:#184636;background:linear-gradient(135deg,#D6F0E1,#9CD3B6)"><span class="tic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#184636" stroke-width="2.6"><path d="m5 12 5 5L20 6"/></svg></span>Результат сохранён</div>
        <div class="toast" style="color:#7C2F2F;background:linear-gradient(135deg,#F5C8C8,#E39191)"><span class="tic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C2F2F" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg></span>Не удалось сохранить</div>
      </div>
    </div>
  </div>
  <div class="cols">
    <div><div class="h2">Пустое состояние</div>
      <div class="empty">
        <span class="tmark" style="width:52px;height:52px"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#807C73" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16"/></svg></span>
        <div style="font-size:17px;font-weight:900;margin-top:4px">Групп ещё нет</div>
        <div style="font-size:13px;font-weight:700;color:var(--mut);max-width:280px;line-height:1.5">Жеребьёвка не проведена. Как только команды разложат по группам — появятся таблицы и сетка.</div>
      </div>
    </div>
    <div><div class="h2">Скелет загрузки</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="sk" style="height:18px;width:60%"></div><div class="sk" style="height:18px;width:85%"></div><div class="sk" style="height:66px;border-radius:22px"></div>
      </div>
    </div>
  </div>
</div>`,

"OverlaysStructure": `<div class="board">
  <h1 class="title">Кит · Оверлеи и структура</h1>
  <p class="subt">Модалки, меню, шапка секции, крошки и карточки-сущности.</p>
  <div class="h2">Шапка секции · SectionHeader</div>
  <div class="raise" style="padding:24px 26px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px">
    <div><p class="eyebrow">LOST Season 2</p><h1 class="sh1">Division 1</h1></div>
    <div style="display:flex;gap:12px;align-items:center;padding-bottom:6px"><span style="font-size:14px;font-weight:800;color:#B98A2E">сыграно 24 из 28</span><span class="btn solid">Действие</span></div>
  </div>
  <div class="h2" style="margin-top:22px">Крошки</div>
  <div class="crumbs"><span class="c">Турниры</span><span>/</span><span class="c">LOST Season 2</span><span>/</span><span class="c">Игроки</span><span>/</span><span>Nirvana</span></div>
  <div class="cols">
    <div><div class="h2">Диалог</div>
      <div class="scrim"><div class="dialog">
        <div class="dhead"><div><div class="dtitle">Удалить серию?</div><div class="ddesc">Карты серии и её результат уйдут из архива. Таблица и сетка пересчитаются.</div></div><span class="xbtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg></span></div>
        <div class="row" style="margin-top:20px;gap:12px"><span class="btn quiet">Отмена</span><span class="btn solid" style="background:linear-gradient(135deg,#F5C8C8,#E08B8B);color:#7C2F2F;box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 2px 3px 4px -1px rgba(255,255,255,.85),inset -3px -4px 6px -2px rgba(150,60,60,.4),0 4px 7px rgba(170,80,80,.28),0 16px 28px -6px rgba(170,80,80,.4)">Удалить</span></div>
      </div></div>
    </div>
    <div><div class="h2">Боковой лист · Sheet</div>
      <div class="scrim" style="justify-content:flex-end;padding:0;overflow:hidden"><div class="sheet">
        <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--sub);margin-bottom:14px">Меню</div>
        <div class="navlink on">Турниры</div><div class="navlink">Ростер</div><div class="navlink">Правила</div><div class="navlink">Кабинет</div>
      </div></div>
    </div>
  </div>
  <div class="cols">
    <div><div class="h2">Выпадающее меню</div>
      <div class="menu">
        <div class="mi hl"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16 4l4 4L8 20H4v-4z"/></svg>Редактировать</div>
        <div class="mi"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>Дублировать</div>
        <div class="msep"></div>
        <div class="mi down"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>Удалить</div>
      </div>
    </div>
    <div><div class="h2">Тултип</div>
      <div style="padding-top:8px"><span class="tip">Счёт из привязанных карт архива</span></div>
      <div class="lbl" style="margin-top:28px">RowCard — выбор из списка</div>
      <div style="display:flex;flex-direction:column;gap:10px;width:280px">
        <div class="rowcard sel"><span class="av" style="width:38px;height:38px"></span><div><div style="font-weight:900;font-size:14px;color:#184636">Yatoro</div><div style="font-size:12px;font-weight:700;color:rgba(24,70,54,.72)">carry · капитан</div></div></div>
        <div class="rowcard idle"><span class="av" style="width:38px;height:38px"></span><div><div style="font-weight:900;font-size:14px">Larl</div><div style="font-size:12px;font-weight:700;color:var(--mut)">mid</div></div></div>
      </div>
    </div>
  </div>
  <div class="h2">Карточка команды</div>
  <div class="row" style="align-items:flex-start">
    <div class="tcard">
      <div style="display:flex;align-items:center;gap:12px"><span class="tmark" style="width:48px;height:48px;font-size:13px">NV</span><div><div style="font-size:18px;font-weight:900">Nirvana</div><div style="font-size:12px;font-weight:700;color:var(--sub)">5 игроков</div></div><span class="chip sel" style="margin-left:auto;font-size:11px;padding:6px 12px">D1</span></div>
      <div style="margin-top:12px">
        <div class="prow" style="border-top:none"><span class="av" style="width:28px;height:28px"></span><span style="font-weight:800;font-size:14px">Yatoro</span><span class="prole">carry</span></div>
        <div class="prow"><span class="av" style="width:28px;height:28px"></span><span style="font-weight:800;font-size:14px">Larl</span><span class="prole">mid</span></div>
        <div class="prow"><span class="av" style="width:28px;height:28px"></span><span style="font-weight:800;font-size:14px">Collapse</span><span class="prole">offlane</span></div>
      </div>
    </div>
    <div class="tcard" style="width:220px">
      <div class="lbl">Мини-карточка игрока</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:9px;padding:8px 0">
        <span class="av" style="width:68px;height:68px"></span><div style="font-weight:900;font-size:16px">Larl</div><span class="chip plain" style="font-size:11px;padding:6px 12px">mid · 10 800</span>
      </div>
    </div>
  </div>
</div>`,

"MoreElements": `<div class="board">
  <h1 class="title">Кит · Ещё элементы</h1>
  <p class="subt">Аккордеон, тумблер, radio, пагинация, аватар-группа, календарь.</p>
  <div class="h2">Аккордеон</div>
  <div class="acc">
    <div class="accitem">
      <div class="acchead">Как считаются очки?<span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m6 15 6-6 6 6"/></svg></span></div>
      <div class="accbody">Очки начисляются по сыгранным сериям групповой стадии: победа — 3, поражение — 0. Счёт берётся из привязанных карт архива серий, автоматически.</div>
    </div>
    <div class="accitem"><div class="acchead">Когда встаёт посев плей-офф?<span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m6 9 6 6 6-6"/></svg></span></div></div>
    <div class="accitem"><div class="acchead">Что такое TP?<span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="m6 9 6 6 6-6"/></svg></span></div></div>
  </div>
  <div class="cols">
    <div><div class="h2">Тумблер</div>
      <div class="row" style="gap:26px">
        <div><div class="lbl">Вкл</div><div class="switch on"><span class="knob"></span></div></div>
        <div><div class="lbl">Выкл</div><div class="switch off"><span class="knob"></span></div></div>
      </div>
    </div>
    <div><div class="h2">Radio</div>
      <div class="chkrow"><span class="radio on"><span class="in"></span></span>Single Elimination</div>
      <div class="chkrow" style="margin-top:14px"><span class="radio off"></span>Double Elimination</div>
      <div class="chkrow" style="margin-top:14px"><span class="radio off"></span>Round Robin</div>
    </div>
  </div>
  <div class="cols">
    <div><div class="h2">Пагинация</div>
      <div class="pager">
        <span class="pg"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m15 6-6 6 6 6"/></svg></span>
        <span class="pg on">1</span><span class="pg">2</span><span class="pg">3</span><span class="pg gap">…</span><span class="pg">8</span>
        <span class="pg"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m9 6 6 6-6 6"/></svg></span>
      </div>
    </div>
    <div><div class="h2">Аватар-группа</div>
      <div class="avg">
        <span class="av" style="width:46px;height:46px"></span><span class="av" style="width:46px;height:46px"></span><span class="av" style="width:46px;height:46px"></span><span class="av" style="width:46px;height:46px"></span>
        <span class="more" style="width:46px;height:46px">+5</span>
      </div>
      <div class="lbl" style="margin-top:14px">Состав команды · 9 игроков</div>
    </div>
  </div>
  <div class="h2">Календарь</div>
  <div class="cal">
    <div class="calhead">
      <div class="calnav"><span class="calbtn">${csvg('<path d="M15 6l-6 6 6 6"/>')}</span><span class="calbtn">${csvg('<path d="M9 6l6 6-6 6"/>')}</span></div>
      <div class="caldrop">Март${csvg('<path d="M6 9l6 6 6-6"/>')}</div>
      <div class="caldrop yr">2001${csvg('<path d="M6 9l6 6 6-6"/>')}</div>
    </div>
    <div class="calgrid">
      <div class="calwk"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
      <div class="caldays">${calDays()}</div>
    </div>
  </div>
</div>`,

"PlayerHero": `<div class="board">
  <h1 class="title">Кит · Hero-шапка игрока</h1>
  <p class="subt">Профиль игрока: аватар, имя, роль в лиге, факты и ссылки — в фиксированном рецепте.</p>
  <div class="h2">Шапка</div>
  <div class="hero">
    <div class="herowash"></div>
    <div style="position:relative;display:flex;gap:28px;padding:30px">
      <div class="bigav">Y</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:34px;font-weight:900;letter-spacing:-.8px"><span style="color:var(--sub);font-size:22px;margin-right:8px">#12</span>Yatoro<span style="color:#3FA981;font-size:15px;font-weight:900;margin-left:14px">капитан</span></div>
        <div style="font-weight:700;color:var(--mut);margin-top:2px">Илья Мулярчук</div>
        <div class="row" style="gap:9px;margin-top:12px"><span class="herochip tp">Игрок</span></div>
        <div class="row" style="gap:9px;margin-top:12px">
          <span class="herochip"><span class="tmark" style="width:20px;height:20px;font-size:9px">NV</span>Nirvana · carry</span>
          <span class="herochip">12 400 MMR</span><span class="herochip">Immortal</span><span class="herochip tp">45 TP</span><span class="herochip">22 года</span><span class="herochip">Минск</span>
        </div>
        <div class="row" style="gap:9px;margin-top:12px"><span class="linkchip">@yatoro</span><span class="linkchip">Dotabuff</span><span class="linkchip">Stratz</span><span class="linkchip">Steam</span></div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px"><span class="btn solid sm">Редактировать</span><span style="font-size:12px;font-weight:700;color:var(--sub)">slug: yatoro</span></div>
    </div>
    <div style="position:relative;border-top:1px solid var(--line);padding:12px 30px;font-size:12px;font-weight:800;color:#B98A2E">Не заполнено: дата рождения</div>
  </div>
</div>`,

"Playoff": `<div class="board">
  <h1 class="title">Кит · Сетка плей-офф</h1>
  <p class="subt">Верхняя сетка: матч-карточки с двумя командами и счётом, соединители. В проекте — во всю ширину (full-bleed).</p>
  <div class="h2">Верхняя сетка · 8 команд</div>
  <div style="position:relative;width:900px;height:520px;margin-top:8px">
    <svg width="900" height="520" style="position:absolute;inset:0;pointer-events:none" fill="none" stroke="#CFC7B8" stroke-width="3">
      <path d="M220,63 H290 V193 H220 M290,128 H340"/>
      <path d="M220,323 H290 V453 H220 M290,388 H340"/>
      <path d="M560,128 H620 V388 H560 M620,258 H680"/>
    </svg>
    <div class="match" style="position:absolute;left:0;top:20px"><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">NV</span>Nirvana<span class="sc">2</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">SP</span>Spirit B<span class="sc">0</span></div></div>
    <div class="match" style="position:absolute;left:0;top:150px"><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">EM</span>Empire<span class="sc">2</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">VP</span>Virtus<span class="sc">1</span></div></div>
    <div class="match" style="position:absolute;left:0;top:280px"><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">HR</span>Hydra<span class="sc">2</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">OG</span>Outlaws<span class="sc">1</span></div></div>
    <div class="match" style="position:absolute;left:0;top:410px"><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">AX</span>Axiom<span class="sc">2</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">RS</span>Rush<span class="sc">0</span></div></div>
    <div class="match" style="position:absolute;left:340px;top:85px"><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">NV</span>Nirvana<span class="sc">2</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">EM</span>Empire<span class="sc">1</span></div></div>
    <div class="match" style="position:absolute;left:340px;top:345px"><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">HR</span>Hydra<span class="sc">2</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">AX</span>Axiom<span class="sc">0</span></div></div>
    <div class="match" style="position:absolute;left:680px;top:215px;box-shadow:var(--sh-mint)"><div style="text-align:center;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#5FA383;padding:8px 0 4px">Гранд-финал</div><div class="mteam win"><span class="tmark" style="width:24px;height:24px;font-size:9px">NV</span>Nirvana<span class="sc">3</span></div><div class="mteam lose"><span class="tmark" style="width:24px;height:24px;font-size:9px">HR</span>Hydra<span class="sc">1</span></div></div>
  </div>
</div>`,

"States": `<div class="board">
  <h1 class="title">Кит · Состояния</h1>
  <p class="subt">Default → Hover → Press → Focus на всех интерактивных. Наведение приподнимает и усиливает тень, нажатие вдавливает и притемняет, фокус — бирюзовое кольцо. Модификаторы .h / .p / .f работают на любом элементе.</p>

  <div class="h2">Интерактивные семейства</div>

  <div class="strow"><div class="fam">Кнопка</div>
    <div class="scell"><span class="btn solid">Кнопка</span><div class="scap">Default</div></div>
    <div class="scell"><span class="btn solid h">Кнопка</span><div class="scap">Hover</div></div>
    <div class="scell"><span class="btn solid p">Кнопка</span><div class="scap">Press</div></div>
    <div class="scell"><span class="btn solid f">Кнопка</span><div class="scap">Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Кнопка quiet</div>
    <div class="scell"><span class="btn quiet">Вторичная</span><div class="scap">Default</div></div>
    <div class="scell"><span class="btn quiet h">Вторичная</span><div class="scap">Hover</div></div>
    <div class="scell"><span class="btn quiet p">Вторичная</span><div class="scap">Press</div></div>
    <div class="scell"><span class="btn quiet f">Вторичная</span><div class="scap">Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Пилюля</div>
    <div class="scell"><span class="pill on">Таблица</span><div class="scap">Default</div></div>
    <div class="scell"><span class="pill on h">Таблица</span><div class="scap">Hover</div></div>
    <div class="scell"><span class="pill on p">Таблица</span><div class="scap">Press</div></div>
    <div class="scell"><span class="pill on f">Таблица</span><div class="scap">Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Чип</div>
    <div class="scell"><span class="chip sel">Выбрано</span><div class="scap">Default</div></div>
    <div class="scell"><span class="chip sel h">Выбрано</span><div class="scap">Hover</div></div>
    <div class="scell"><span class="chip sel p">Выбрано</span><div class="scap">Press</div></div>
    <div class="scell"><span class="chip sel f">Выбрано</span><div class="scap">Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Поле</div>
    <div class="scell"><div class="field" style="width:150px">Nirvana</div><div class="scap">Default</div></div>
    <div class="scell"><div class="field h" style="width:150px">Nirvana</div><div class="scap">Hover</div></div>
    <div class="scell"><div class="field focus" style="width:150px;color:var(--ink)">Nirvana</div><div class="scap">Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Чекбокс</div>
    <div class="scell"><span class="chk off"></span><div class="scap">Off</div></div>
    <div class="scell"><span class="chk off h"></span><div class="scap">Hover</div></div>
    <div class="scell"><span class="chk on"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 6"/></svg></span><div class="scap">On</div></div>
    <div class="scell"><span class="chk on f"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 5 5L20 6"/></svg></span><div class="scap">On · Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Тумблер</div>
    <div class="scell"><div class="switch off"><span class="knob"></span></div><div class="scap">Off</div></div>
    <div class="scell"><div class="switch on"><span class="knob"></span></div><div class="scap">On</div></div>
    <div class="scell"><div class="switch on f"><span class="knob"></span></div><div class="scap">On · Focus</div></div>
  </div>

  <div class="strow"><div class="fam">Пагинация</div>
    <div class="scell"><span class="pg">2</span><div class="scap">Default</div></div>
    <div class="scell"><span class="pg h">2</span><div class="scap">Hover</div></div>
    <div class="scell"><span class="pg p">2</span><div class="scap">Press</div></div>
    <div class="scell"><span class="pg on">1</span><div class="scap">Current</div></div>
  </div>

  <div class="strow"><div class="fam">Пункт меню</div>
    <div class="scell"><div class="menu" style="width:180px"><div class="mi">Редактировать</div></div><div class="scap">Default</div></div>
    <div class="scell"><div class="menu" style="width:180px"><div class="mi hl">Редактировать</div></div><div class="scap">Hover</div></div>
  </div>

  <div class="strow" style="margin-bottom:0"><div class="fam">RowCard</div>
    <div class="scell"><div class="rowcard idle" style="width:200px"><span class="av" style="width:32px;height:32px"></span><span style="font-weight:900;font-size:14px">Larl</span></div><div class="scap">Default</div></div>
    <div class="scell"><div class="rowcard idle h" style="width:200px"><span class="av" style="width:32px;height:32px"></span><span style="font-weight:900;font-size:14px">Larl</span></div><div class="scap">Hover</div></div>
    <div class="scell"><div class="rowcard sel" style="width:200px"><span class="av" style="width:32px;height:32px"></span><span style="font-weight:900;font-size:14px;color:#184636">Larl</span></div><div class="scap">Selected</div></div>
  </div>
</div>`
,

// ——— Профиль · атомы ———
ProfileAtoms: `<div class="board">
  <h1 class="title">Профиль игрока · атомы</h1>
  <p class="subt">Новые компоненты профиля — для переиспользования и детальной правки. Стиль наследует Кит.</p>

  <div class="h2">Hero-шапка · подложка + личность</div>
  <div class="hero">
    <div class="herobanner">
      <svg class="heromono" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4">
        <path d="M50 6 L88 27 V63 L50 94 L12 63 V27 Z"></path>
        <path d="M50 32 L69 42 V60 L50 71 L31 60 V42 Z" stroke-width="3"></path>
      </svg>
    </div>
    <div class="idcoin"><small>№</small>12</div>
    <div class="herobody">
      <div class="bigav ring">Y</div>
      <div style="flex:1;min-width:0;padding-bottom:4px">
        <div class="pname">Yatoro</div>
        <div class="preal">Илья Мулярчук</div>
        <div class="proles">
          <span class="chip sel"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 7l4 3 5-6 5 6 4-3-2 12H5L3 7z"></path></svg>Капитан</span>
          <span class="chip warn">Организатор</span>
          <span class="chip plain">carry</span>
        </div>
      </div>
    </div>
  </div>

  <div class="h2">Карьера · бублик, показатели, сегменты</div>
  <div class="pcard" style="max-width:600px">
    <div class="segfull" style="max-width:300px;margin-top:0">
      <span class="s on">Лига</span><span class="s">По турнирам</span>
    </div>
    <div class="donutwrap">
      <div class="donut"><div class="donuthole"><div class="big">62%</div><div class="cap">винрейт</div></div></div>
      <div class="coins">
        <div class="coin"><div class="coindisc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 6l4-2-2 4M14 6l-8 8-3 4 4-3 8-8M14 6l4 4-8 8"/></svg></div><div class="coinv">6.4/4.1/9.8</div><div class="coinl">Ср. KDA</div></div>
        <div class="coin"><div class="coindisc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg></div><div class="coinv">612 / 658</div><div class="coinl">GPM / XPM</div></div>
        <div class="coin"><div class="coindisc"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="6" width="16" height="13" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/></svg></div><div class="coinv">34:12</div><div class="coinl">Ср. время</div></div>
      </div>
    </div>
  </div>

  <div class="h2">Строка · игра / герой (единый компонент)</div>
  <div class="rowgrid" style="max-width:620px">
    <div class="grow">
      <span class="gthumb sq" style="background:linear-gradient(140deg,#8a5a3a,#3a251a)"></span>
      <span class="gmid"><span class="gtop"><span class="wl w">W</span>Aurora</span><span class="gsub">D1 · плей-офф</span></span>
      <span class="gkda"><span class="m"><span class="kk">11</span><span class="kx">/</span><span class="kd">3</span><span class="kx">/</span><span class="ka">14</span></span></span>
    </div>
    <div class="grow">
      <span class="gthumb sq" style="background:linear-gradient(140deg,#3a557f,#1a2536)"></span>
      <span class="gmid"><span class="gtop">Juggernaut</span><span class="gsub">31 карта · <span style="color:var(--mint-ink)">21</span>–<span style="color:#B4595A">10</span></span></span>
      <span class="hwr">68%</span>
    </div>
  </div>

  <div class="h2">Команда · карточка + мини-карточки игроков (внахлёст, раскрытие)</div>
  <div class="pcard" style="max-width:420px">
    <div class="teamcardbig">
      <span class="tmark" style="width:56px;height:56px;font-size:16px;border-radius:16px">NV</span>
      <div style="flex:1;min-width:0"><div style="font-size:21px;font-weight:900">Nirvana</div></div>
      <span class="chip sel" style="padding:7px 15px;font-size:12px">D1</span>
    </div>
    <div class="playstack">
      <span class="pcardm me"><span class="pav" style="background:linear-gradient(145deg,#A9DCC3,#5b9b74)">Y</span><span class="pinfo"><div class="pnm">Yatoro</div><div class="prl">carry · кэп</div></span></span>
      <span class="pcardm"><span class="pav" style="background:linear-gradient(145deg,#8fb0dd,#3a557f)">L</span><span class="pinfo"><div class="pnm">Larl</div><div class="prl">mid</div></span></span>
      <span class="pcardm"><span class="pav" style="background:linear-gradient(145deg,#b79ad6,#5a3a7f)">C</span><span class="pinfo"><div class="pnm">Collapse</div><div class="prl">offlane</div></span></span>
      <span class="pcardm"><span class="pav" style="background:linear-gradient(145deg,#d6a0b6,#7f3a5f)">M</span><span class="pinfo"><div class="pnm">Mira</div><div class="prl">soft sup</div></span></span>
      <span class="pcardm"><span class="pav" style="background:linear-gradient(145deg,#d6c48a,#7f6a3a)">M</span><span class="pinfo"><div class="pnm">Miposhka</div><div class="prl">hard sup</div></span></span>
    </div>
  </div>

  <div class="h2">Данные · мини-блоки</div>
  <div class="factgrid" style="max-width:420px">
    <div class="factbox"><div class="fk">MMR</div><div class="fv">12&nbsp;400</div></div>
    <div class="factbox"><div class="fk">Ранг</div><div class="fv" style="font-size:16px">Immortal</div></div>
    <div class="factbox"><div class="fk">TP</div><div class="fv acc">45</div></div>
    <div class="factbox"><div class="fk">Возраст</div><div class="fv">22 <small>года</small></div></div>
  </div>

  <div class="h2">Ссылки · иконки внахлёст (раскрытие по тексту)</div>
  <div class="linkstack">
    <span class="lk"><svg class="lki" viewBox="0 0 24 24" fill="currentColor"><path d="M22 3 2 11l6 2 2 6 3-4 5 4 4-16z"/></svg><span class="lkt">@yatoro</span></span>
    <span class="lk"><svg class="lki" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 20V10M12 20V4M19 20v-7"/></svg><span class="lkt">Dotabuff</span></span>
    <span class="lk"><svg class="lki" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 12h4l3 7 4-14 3 7h4"/></svg><span class="lkt">Stratz</span></span>
    <span class="lk"><svg class="lki" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8"/><circle cx="15.5" cy="9" r="2.2" fill="currentColor" stroke="none"/></svg><span class="lkt">Steam</span></span>
  </div>

  <div class="h2">Достижения</div>
  <div style="max-width:420px">
    <div class="achv"><span class="adot"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 13l4 4L19 7l-2-2-8 8-2-2z"/></svg></span>Чемпион LOST Season 1</div>
    <div class="achv"><span class="adot"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 13l4 4L19 7l-2-2-8 8-2-2z"/></svg></span>MVP группового этапа</div>
    <div class="achv"><span class="adot"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M5 13l4 4L19 7l-2-2-8 8-2-2z"/></svg></span>Клуб 10 000 MMR</div>
  </div>
</div>`
,

// ——— Турнирная таблица ———
Standings: `<div class="board">
  <h1 class="title">Кит · Турнирная таблица</h1>
  <p class="subt">Шапка колонок с сортировкой, строка команды, зоны выхода, состояния строки и мобильный вид 390px.</p>

  <div class="h2">Таблица дивизиона · 1220px</div>
  <div class="tbl">
    <div class="tgrid thead">
      <div class="num">#</div>
      <div>Команда</div>
      <div class="num"><span class="sortable">И</span></div>
      <div class="num"><span class="sortable">В</span></div>
      <div class="num"><span class="sortable">П</span></div>
      <div class="num"><span class="sortable">Карты</span></div>
      <div class="num">Форма</div>
      <div class="num"><span class="sortable on">Очки <span class="sortcap"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4"><path d="M6 15l6-6 6 6"/></svg></span></span></div>
    </div>

    <div class="tgrid trow">
      <div class="tplace"><span class="zbar" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span><span class="tpn">1</span></div>
      <div class="tteam"><span class="tmark" style="width:34px;height:34px">NC</span><div><div class="tname">Nova Cats</div><div class="tsub">Дивизион A</div></div></div>
      <div class="tnum">14</div><div class="tnum win">12</div><div class="tnum">2</div>
      <div class="tdiff pos">+17</div>
      <div class="form"><span class="fdot w">В</span><span class="fdot w">В</span><span class="fdot l">П</span><span class="fdot w">В</span><span class="fdot w">В</span></div>
      <div class="tpts"><span class="pts lead">36</span></div>
    </div>

    <div class="tgrid trow hov">
      <div class="tplace"><span class="zbar" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span><span class="tpn">2</span></div>
      <div class="tteam"><span class="tmark" style="width:34px;height:34px">IL</span><div><div class="tname">Iron Lotus</div><div class="tsub">Дивизион A</div></div></div>
      <div class="tnum">14</div><div class="tnum win">11</div><div class="tnum">3</div>
      <div class="tdiff pos">+12</div>
      <div class="form"><span class="fdot w">В</span><span class="fdot w">В</span><span class="fdot w">В</span><span class="fdot l">П</span><span class="fdot w">В</span></div>
      <div class="tpts"><span class="pts">33</span></div>
    </div>

    <div class="tgrid trow me">
      <div class="tplace"><span class="zbar" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span><span class="tpn">3</span></div>
      <div class="tteam"><span class="tmark" style="width:34px;height:34px">DH</span><div><div class="tname">Deep Harbor</div><div class="tsub" style="color:rgba(24,70,54,.6)">ваша команда</div></div></div>
      <div class="tnum" style="color:rgba(24,70,54,.75)">14</div><div class="tnum" style="color:var(--mint-ink)">9</div><div class="tnum" style="color:rgba(24,70,54,.75)">5</div>
      <div class="tdiff" style="color:var(--mint-ink)">+6</div>
      <div class="form"><span class="fdot w">В</span><span class="fdot l">П</span><span class="fdot w">В</span><span class="fdot w">В</span><span class="fdot n">—</span></div>
      <div class="tpts"><span class="pts">27</span></div>
    </div>

    <div class="tgrid trow">
      <div class="tplace"><span class="zbar" style="background:linear-gradient(135deg,#F3DEA6,#E2BC63)"></span><span class="tpn">4</span></div>
      <div class="tteam"><span class="tmark" style="width:34px;height:34px">RM</span><div><div class="tname">Red Meridian</div><div class="tsub">Дивизион A</div></div></div>
      <div class="tnum">14</div><div class="tnum win">7</div><div class="tnum">7</div>
      <div class="tdiff pos">+1</div>
      <div class="form"><span class="fdot l">П</span><span class="fdot w">В</span><span class="fdot l">П</span><span class="fdot w">В</span><span class="fdot l">П</span></div>
      <div class="tpts"><span class="pts">21</span></div>
    </div>

    <div class="tgrid trow">
      <div class="tplace"><span class="zbar" style="background:linear-gradient(135deg,#F3DEA6,#E2BC63)"></span><span class="tpn">5</span></div>
      <div class="tteam"><span class="tmark" style="width:34px;height:34px">BH</span><div><div class="tname">Blue Harvest</div><div class="tsub">Дивизион A</div></div></div>
      <div class="tnum">14</div><div class="tnum win">6</div><div class="tnum">8</div>
      <div class="tdiff neg">−4</div>
      <div class="form"><span class="fdot l">П</span><span class="fdot l">П</span><span class="fdot w">В</span><span class="fdot l">П</span><span class="fdot w">В</span></div>
      <div class="tpts"><span class="pts">18</span></div>
    </div>

    <div class="tgrid trow out zsplit">
      <div class="tplace"><span class="zbar" style="background:linear-gradient(135deg,#F0C4C4,#DE9494)"></span><span class="tpn">6</span></div>
      <div class="tteam"><span class="tmark" style="width:34px;height:34px">SO</span><div><div class="tname">Stone Owls</div><div class="tsub">Дивизион A</div></div></div>
      <div class="tnum">14</div><div class="tnum win">2</div><div class="tnum">12</div>
      <div class="tdiff neg">−22</div>
      <div class="form"><span class="fdot l">П</span><span class="fdot l">П</span><span class="fdot l">П</span><span class="fdot w">В</span><span class="fdot l">П</span></div>
      <div class="tpts"><span class="pts">6</span></div>
    </div>
  </div>

  <div class="h2">Зоны и легенда</div>
  <div class="zlegend">
    <span class="zi"><span class="zbar" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span>Плей-офф · места 1–3</span>
    <span class="zi"><span class="zbar" style="background:linear-gradient(135deg,#F3DEA6,#E2BC63)"></span>Плей-ин · места 4–5</span>
    <span class="zi"><span class="zbar" style="background:linear-gradient(135deg,#F0C4C4,#DE9494)"></span>Вылет · место 6</span>
  </div>

  <div class="h2">Состояния строки</div>
  <div style="display:flex;flex-direction:column;gap:12px;max-width:640px">
    <div class="lbl" style="margin:0">Default · hover · своя команда · вне зоны</div>
    <div class="tbl" style="padding:6px">
      <div class="mrow"><span class="tmark" style="width:32px;height:32px">NC</span><div style="flex:1"><div class="tname">Nova Cats</div><div class="mmeta">12–2 · +17</div></div><span class="pts">36</span></div>
      <div class="mrow" style="background:var(--grad-surface);box-shadow:var(--sh-raise-sm);transform:translateY(-2px)"><span class="tmark" style="width:32px;height:32px">IL</span><div style="flex:1"><div class="tname">Iron Lotus</div><div class="mmeta">11–3 · +12</div></div><span class="pts">33</span></div>
      <div class="mrow me"><span class="tmark" style="width:32px;height:32px">DH</span><div style="flex:1"><div class="tname">Deep Harbor</div><div class="mmeta" style="color:rgba(24,70,54,.6)">9–5 · +6</div></div><span class="pts">27</span></div>
      <div class="mrow" style="opacity:.72"><span class="tmark" style="width:32px;height:32px">SO</span><div style="flex:1"><div class="tname">Stone Owls</div><div class="mmeta">2–12 · −22</div></div><span class="pts">6</span></div>
    </div>
  </div>

  <div class="h2">Мобильный вид · 390px</div>
  <div class="mob">
    <div class="mrow"><span class="tpn">1</span><span class="zbar" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span><span class="tmark" style="width:32px;height:32px">NC</span><div style="flex:1;min-width:0"><div class="tname">Nova Cats</div><div class="mmeta">12–2 · карты +17</div></div><span class="pts lead">36</span></div>
    <div class="mrow"><span class="tpn">2</span><span class="zbar" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span><span class="tmark" style="width:32px;height:32px">IL</span><div style="flex:1;min-width:0"><div class="tname">Iron Lotus</div><div class="mmeta">11–3 · карты +12</div></div><span class="pts">33</span></div>
    <div class="mrow me"><span class="tpn">3</span><span class="zbar" style="background:linear-gradient(135deg,#DFF3E8,#B7E4CD)"></span><span class="tmark" style="width:32px;height:32px">DH</span><div style="flex:1;min-width:0"><div class="tname">Deep Harbor</div><div class="mmeta" style="color:rgba(24,70,54,.6)">9–5 · карты +6</div></div><span class="pts">27</span></div>
    <div class="mrow"><span class="tpn">4</span><span class="zbar" style="background:linear-gradient(135deg,#F3DEA6,#E2BC63)"></span><span class="tmark" style="width:32px;height:32px">RM</span><div style="flex:1;min-width:0"><div class="tname">Red Meridian</div><div class="mmeta">7–7 · карты +1</div></div><span class="pts">21</span></div>
  </div>
</div>`
,

// ——— Карточка встречи ———
SeriesCard: `<div class="board">
  <h1 class="title">Кит · Карточка встречи</h1>
  <p class="subt">Самый повторяемый элемент продукта: расписание, страница дивизиона, профиль команды. Четыре состояния + строка расписания + мобильный вид.</p>

  <div class="h2">Состояния карточки</div>
  <div class="row" style="align-items:flex-start;gap:20px">
    <div>
      <div class="lbl">Предстоящая</div>
      <div class="scard">
        <div class="stop"><span class="chip plain">BO3</span><span>Дивизион A · тур 7</span><span class="right">12 сентября</span></div>
        <div class="sbody">
          <div class="steam"><span class="tmark" style="width:44px;height:44px;font-size:14px">NC</span><div><div class="sname">Nova Cats</div><div class="stag">NOVA</div></div></div>
          <div class="sscore soon">19:00</div>
          <div class="steam rev"><span class="tmark" style="width:44px;height:44px;font-size:14px">IL</span><div><div class="sname">Iron Lotus</div><div class="stag">LOTUS</div></div></div>
        </div>
        <div class="sfoot"><span>Время согласовано</span><span class="right"><span class="btn sm quiet">Подробнее</span></span></div>
      </div>
    </div>

    <div>
      <div class="lbl">Идёт сейчас</div>
      <div class="scard">
        <div class="stop"><span class="chip sel"><span class="livedot"></span>LIVE</span><span>Дивизион A · тур 7</span><span class="right">карта 2</span></div>
        <div class="sbody">
          <div class="steam"><span class="tmark" style="width:44px;height:44px;font-size:14px">DH</span><div><div class="sname">Deep Harbor</div><div class="stag">HARBOR</div></div></div>
          <div class="sscore"><b>1</b><span class="dash">:</span><b class="lose">0</b></div>
          <div class="steam rev"><span class="tmark" style="width:44px;height:44px;font-size:14px">RM</span><div><div class="sname">Red Meridian</div><div class="stag">MERID</div></div></div>
        </div>
        <div class="sfoot"><span class="maps"><span class="map w">1</span><span class="map">2</span><span class="map">3</span></span><span class="right"><span class="btn sm solid">Смотреть</span></span></div>
      </div>
    </div>

    <div>
      <div class="lbl">Сыграна</div>
      <div class="scard">
        <div class="stop"><span class="chip plain">BO3</span><span>Дивизион A · тур 6</span><span class="right">5 сентября</span></div>
        <div class="sbody">
          <div class="steam"><span class="tmark" style="width:44px;height:44px;font-size:14px">BH</span><div><div class="sname">Blue Harvest</div><div class="stag">HARV</div></div></div>
          <div class="sscore"><b>2</b><span class="dash">:</span><b class="lose">1</b></div>
          <div class="steam rev"><span class="tmark" style="width:44px;height:44px;font-size:14px">SO</span><div><div class="sname">Stone Owls</div><div class="stag">OWLS</div></div></div>
        </div>
        <div class="sfoot"><span class="maps"><span class="map w">1</span><span class="map">2</span><span class="map w">3</span></span><span class="right"><span class="btn sm quiet">Отчёт матча</span></span></div>
      </div>
    </div>

    <div>
      <div class="lbl">Время предложено · ждёт ответа</div>
      <div class="scard">
        <div class="stop"><span class="chip plain">BO3</span><span>Дивизион B · тур 7</span><span class="right">перенос</span></div>
        <div class="sbody">
          <div class="steam"><span class="tmark" style="width:44px;height:44px;font-size:14px">GC</span><div><div class="sname">Green Circuit</div><div class="stag">CIRC</div></div></div>
          <div class="sscore soon">—:—</div>
          <div class="steam rev"><span class="tmark" style="width:44px;height:44px;font-size:14px">PR</span><div><div class="sname">Pale Riders</div><div class="stag">RIDE</div></div></div>
        </div>
        <div class="sfoot"><span class="alert mini warn"><span class="aic"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M12 8v5M12 17h.01"/></svg></span>Предложено 14.09, 20:00</span><span class="right"><span class="btn sm solid">Принять</span></span></div>
      </div>
    </div>
  </div>

  <div class="h2">Строка расписания · игровой день</div>
  <div style="display:flex;flex-direction:column;gap:10px">
    <div class="srow">
      <div class="stime">19:00<i>12 сен</i></div>
      <div class="steam rev" style="justify-content:flex-start;flex-direction:row-reverse"><span class="tmark" style="width:34px;height:34px">NC</span><div class="sname" style="font-size:15px">Nova Cats</div></div>
      <div class="sscore soon" style="padding:8px 0;font-size:13px">BO3</div>
      <div class="steam"><span class="tmark" style="width:34px;height:34px">IL</span><div class="sname" style="font-size:15px">Iron Lotus</div></div>
      <div style="text-align:right"><span class="chip plain">Дивизион A</span></div>
    </div>
    <div class="srow">
      <div class="stime">20:30<i>12 сен</i></div>
      <div class="steam rev" style="justify-content:flex-start;flex-direction:row-reverse"><span class="tmark" style="width:34px;height:34px">DH</span><div class="sname" style="font-size:15px">Deep Harbor</div></div>
      <div class="sscore" style="padding:6px 0"><b style="font-size:19px">2</b><span class="dash">:</span><b class="lose" style="font-size:19px">0</b></div>
      <div class="steam"><span class="tmark" style="width:34px;height:34px">SO</span><div class="sname" style="font-size:15px">Stone Owls</div></div>
      <div style="text-align:right"><span class="btn sm quiet">Отчёт</span></div>
    </div>
  </div>

  <div class="h2">Мобильный вид · 390px</div>
  <div class="scard smob">
    <div class="stop"><span class="chip plain">BO3</span><span class="right">12 сен · 19:00</span></div>
    <div class="sbody">
      <div class="steam"><span class="tmark" style="width:38px;height:38px;font-size:12px">NC</span><div><div class="sname">Nova Cats</div></div></div>
      <div class="sscore"><b>1</b><span class="dash">:</span><b class="lose">0</b></div>
      <div class="steam rev"><span class="tmark" style="width:38px;height:38px;font-size:12px">IL</span><div><div class="sname">Iron Lotus</div></div></div>
    </div>
    <div class="sfoot"><span class="maps"><span class="map w">1</span><span class="map">2</span><span class="map">3</span></span><span class="right"><span class="btn sm quiet">Отчёт</span></span></div>
  </div>
</div>`
,

// ——— Групповой этап ———
Groups: `<div class="board">
  <h1 class="title">Кит · Групповой этап</h1>
  <p class="subt">Блок группы (мини-таблица с зоной выхода) и кросс-таблица «все со всеми».</p>

  <div class="h2">Блоки групп</div>
  <div class="gwrap">
    <div class="gcard">
      <div class="ghead"><span class="tile acc" style="min-width:0;padding:8px 14px"><span class="tv" style="font-size:20px;margin:0">A</span></span><span class="gtitle">Группа A</span><span class="gmeta">выходят двое</span></div>
      <div class="ggrid ghd"><div>#</div><div class="l">Команда</div><div>И</div><div>Р</div><div>Очки</div></div>
      <div class="ggrid grow up"><div class="gnum">1</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">NC</span><span class="gname">Nova Cats</span></div><div class="gnum">3</div><div class="gnum">+5</div><div style="text-align:center"><span class="pts lead">9</span></div></div>
      <div class="ggrid grow up"><div class="gnum">2</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">IL</span><span class="gname">Iron Lotus</span></div><div class="gnum">3</div><div class="gnum">+2</div><div style="text-align:center"><span class="pts">6</span></div></div>
      <div class="ggrid grow"><div class="gnum">3</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">SO</span><span class="gname">Stone Owls</span></div><div class="gnum">3</div><div class="gnum">−3</div><div style="text-align:center"><span class="pts">3</span></div></div>
      <div class="ggrid grow"><div class="gnum">4</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">PR</span><span class="gname">Pale Riders</span></div><div class="gnum">3</div><div class="gnum">−4</div><div style="text-align:center"><span class="pts">0</span></div></div>
    </div>

    <div class="gcard">
      <div class="ghead"><span class="tile acc" style="min-width:0;padding:8px 14px"><span class="tv" style="font-size:20px;margin:0">B</span></span><span class="gtitle">Группа B</span><span class="gmeta">идёт тур 3</span></div>
      <div class="ggrid ghd"><div>#</div><div class="l">Команда</div><div>И</div><div>Р</div><div>Очки</div></div>
      <div class="ggrid grow up"><div class="gnum">1</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">DH</span><span class="gname">Deep Harbor</span></div><div class="gnum">2</div><div class="gnum">+4</div><div style="text-align:center"><span class="pts lead">6</span></div></div>
      <div class="ggrid grow up"><div class="gnum">2</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">RM</span><span class="gname">Red Meridian</span></div><div class="gnum">2</div><div class="gnum">+1</div><div style="text-align:center"><span class="pts">3</span></div></div>
      <div class="ggrid grow"><div class="gnum">3</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">BH</span><span class="gname">Blue Harvest</span></div><div class="gnum">2</div><div class="gnum">−1</div><div style="text-align:center"><span class="pts">3</span></div></div>
      <div class="ggrid grow"><div class="gnum">4</div><div class="gteam"><span class="tmark" style="width:30px;height:30px;font-size:11px">GC</span><span class="gname">Green Circuit</span></div><div class="gnum">2</div><div class="gnum">−4</div><div style="text-align:center"><span class="pts">0</span></div></div>
    </div>
  </div>

  <div class="h2">Кросс-таблица группы</div>
  <div class="cross">
    <table class="ctab">
      <tr><th class="side">Группа A</th><th>NC</th><th>IL</th><th>SO</th><th>PR</th></tr>
      <tr>
        <th class="side"><span class="cside"><span class="tmark" style="width:30px;height:30px;font-size:11px">NC</span>Nova Cats</span></th>
        <td><div class="cell self">—</div></td><td><div class="cell w">2:1</div></td><td><div class="cell w">2:0</div></td><td><div class="cell w">2:0</div></td>
      </tr>
      <tr>
        <th class="side"><span class="cside"><span class="tmark" style="width:30px;height:30px;font-size:11px">IL</span>Iron Lotus</span></th>
        <td><div class="cell l">1:2</div></td><td><div class="cell self">—</div></td><td><div class="cell w">2:1</div></td><td><div class="cell w">2:0</div></td>
      </tr>
      <tr>
        <th class="side"><span class="cside"><span class="tmark" style="width:30px;height:30px;font-size:11px">SO</span>Stone Owls</span></th>
        <td><div class="cell l">0:2</div></td><td><div class="cell l">1:2</div></td><td><div class="cell self">—</div></td><td><div class="cell w">2:1</div></td>
      </tr>
      <tr>
        <th class="side"><span class="cside"><span class="tmark" style="width:30px;height:30px;font-size:11px">PR</span>Pale Riders</span></th>
        <td><div class="cell l">0:2</div></td><td><div class="cell l">0:2</div></td><td><div class="cell l">1:2</div></td><td><div class="cell self">—</div></td>
      </tr>
    </table>
  </div>

  <div class="h2">Ячейка кросс-таблицы · состояния</div>
  <div class="row">
    <div class="scell"><div class="cell w">2:0</div><div class="scap">Победа</div></div>
    <div class="scell"><div class="cell l">1:2</div><div class="scap">Поражение</div></div>
    <div class="scell"><div class="cell soon">19:00</div><div class="scap">Предстоит</div></div>
    <div class="scell"><div class="cell self">—</div><div class="scap">Своя клетка</div></div>
    <div class="scell"><div class="cell w h">2:1</div><div class="scap">Hover</div></div>
  </div>
</div>`
,

// ——— Hero-шапка команды ———
TeamHero: `<div class="board">
  <h1 class="title">Кит · Hero-шапка команды</h1>
  <p class="subt">Парная к шапке игрока: лого, название и тег, дивизион, состав, ключевые числа. Тот же рецепт — подложка с мятным светом, вложенные чипы.</p>

  <div class="h2">Шапка · 1220px</div>
  <div class="hero">
    <div class="herowash"></div>
    <div style="position:relative;display:flex;gap:28px;padding:30px">
      <div class="biglogo">NC</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:34px;font-weight:900;letter-spacing:-.8px">Nova Cats<span style="color:var(--sub);font-size:20px;margin-left:12px">NOVA</span></div>
        <div style="font-weight:700;color:var(--mut);margin-top:2px">Основан в 2024 · капитан: Placeholder</div>
        <div class="row" style="gap:9px;margin-top:12px">
          <span class="herochip tp">Дивизион A</span>
          <span class="herochip">Сезон 3</span>
          <span class="herochip"><span class="dot" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span>1-е место</span>
          <span class="herochip">12–2</span>
          <span class="herochip">карты +17</span>
        </div>
        <div class="row" style="gap:9px;margin-top:12px">
          <span class="linkchip">Dotabuff</span><span class="linkchip">Telegram</span><span class="linkchip">Состав</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
        <span class="btn solid sm">Редактировать</span>
        <div class="avg" style="margin-top:4px">
          <span class="av" style="width:38px;height:38px"></span><span class="av" style="width:38px;height:38px"></span><span class="av" style="width:38px;height:38px"></span><span class="av" style="width:38px;height:38px"></span><span class="more" style="width:38px;height:38px">+1</span>
        </div>
        <span style="font-size:12px;font-weight:700;color:var(--sub)">slug: nova-cats</span>
      </div>
    </div>
    <div style="position:relative;border-top:1px solid var(--line);padding:16px 30px;display:flex;gap:12px;flex-wrap:wrap">
      <div class="tile" style="min-width:120px;padding:12px 16px"><div class="tl">Очки</div><div class="tv">36</div></div>
      <div class="tile" style="min-width:120px;padding:12px 16px"><div class="tl">Серии</div><div class="tv">14</div></div>
      <div class="tile" style="min-width:120px;padding:12px 16px"><div class="tl">Карты</div><div class="tv">26–9</div></div>
      <div class="tile acc" style="min-width:120px;padding:12px 16px"><div class="tl">Серия побед</div><div class="tv">4</div></div>
      <div class="tile" style="min-width:120px;padding:12px 16px"><div class="tl">Ср. MMR</div><div class="tv">6 400</div></div>
    </div>
  </div>

  <div class="h2">Состав в шапке · строка игрока</div>
  <div class="cols" style="gap:16px">
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="rostline"><span class="av" style="width:34px;height:34px"></span><div><div class="nm">Player One <span class="capmark">капитан</span></div><div class="tsub" style="font-size:11px;font-weight:800;color:var(--sub)">carry · Immortal</div></div><span class="rl">Основа</span></div>
      <div class="rostline"><span class="av" style="width:34px;height:34px"></span><div><div class="nm">Player Two</div><div class="tsub" style="font-size:11px;font-weight:800;color:var(--sub)">mid · Divine</div></div><span class="rl">Основа</span></div>
      <div class="rostline"><span class="av" style="width:34px;height:34px"></span><div><div class="nm">Player Three</div><div class="tsub" style="font-size:11px;font-weight:800;color:var(--sub)">offlane · Divine</div></div><span class="rl">Основа</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div class="rostline"><span class="av" style="width:34px;height:34px"></span><div><div class="nm">Player Four</div><div class="tsub" style="font-size:11px;font-weight:800;color:var(--sub)">soft support · Ancient</div></div><span class="rl">Основа</span></div>
      <div class="rostline"><span class="av" style="width:34px;height:34px"></span><div><div class="nm">Player Five</div><div class="tsub" style="font-size:11px;font-weight:800;color:var(--sub)">hard support · Ancient</div></div><span class="rl">Основа</span></div>
      <div class="rostline" style="opacity:.75"><span class="av" style="width:34px;height:34px"></span><div><div class="nm">Player Six</div><div class="tsub" style="font-size:11px;font-weight:800;color:var(--sub)">mid · Legend</div></div><span class="rl">Запас</span></div>
    </div>
  </div>

  <div class="h2">Мобильный вид · 390px</div>
  <div class="hmob">
    <div class="herowash"></div>
    <div style="position:relative;padding:22px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px">
      <div class="biglogo" style="width:96px;height:96px;border-radius:28px;font-size:26px">NC</div>
      <div style="font-size:24px;font-weight:900;letter-spacing:-.6px">Nova Cats <span style="color:var(--sub);font-size:15px">NOVA</span></div>
      <div class="row" style="gap:8px;justify-content:center"><span class="herochip tp">Дивизион A</span><span class="herochip">1-е место</span><span class="herochip">12–2</span></div>
    </div>
    <div style="position:relative;border-top:1px solid var(--line);padding:14px 18px;display:flex;gap:10px;justify-content:center">
      <div class="tile" style="min-width:0;flex:1;padding:10px 12px"><div class="tl">Очки</div><div class="tv" style="font-size:22px">36</div></div>
      <div class="tile" style="min-width:0;flex:1;padding:10px 12px"><div class="tl">Серии</div><div class="tv" style="font-size:22px">14</div></div>
      <div class="tile" style="min-width:0;flex:1;padding:10px 12px"><div class="tl">Карты</div><div class="tv" style="font-size:22px">26–9</div></div>
    </div>
  </div>
</div>`
,

// ——— Шапка сайта и меню ———
SiteNav: `<div class="board">
  <h1 class="title">Кит · Шапка сайта и мобильное меню</h1>
  <p class="subt">Четыре уровня навигации из UI-GUIDELINES: L1 глобальный, L2 контекст турнира, L3 вкладки раздела, L4 — в теле страницы. Тач-цель на мобильном — 44px.</p>

  <div class="h2">L1 · верхняя строка · гость</div>
  <div class="bar">
    <div class="brand"><span class="blogo">L</span>LEAGUE OF SPIRITS</div>
    <div class="navset" style="margin-left:18px"><span class="pill on">Турниры</span><span class="pill">Команды</span><span class="pill">Игроки</span><span class="pill">Правила</span></div>
    <div class="spacer"></div>
    <span class="btn sm quiet"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>Поиск</span>
    <span class="btn sm solid">Войти</span>
  </div>

  <div class="lbl" style="margin-top:22px">Вошедший · виден ник, а не «Кабинет». Пункт «Админ» — только у админа</div>
  <div class="bar">
    <div class="brand"><span class="blogo">L</span>LEAGUE OF SPIRITS</div>
    <div class="navset" style="margin-left:18px"><span class="pill on">Турниры</span><span class="pill">Команды</span><span class="pill">Игроки</span><span class="pill">Правила</span><span class="sep"></span><span class="pill">Админ</span></div>
    <div class="spacer"></div>
    <span class="btn sm quiet ib round"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg></span>
    <span class="userchip"><span class="av" style="width:30px;height:30px"></span>Ник игрока<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg></span>
  </div>

  <div class="h2">L2 · контекст турнира</div>
  <div class="l2bar">
    <span class="tsel">LOST Season 3<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg></span>
    <span class="segset"><span class="seg on">D1</span><span class="seg">D2</span></span>
    <div class="spacer"></div>
    <span class="chip sel"><span class="dot" style="background:linear-gradient(135deg,#B7E4CD,#7FC3A4)"></span>Идёт</span>
    <span class="chip plain">28 команд</span>
  </div>

  <div class="h2">L3 · вкладки раздела (не больше семи)</div>
  <div class="l3bar">
    <span class="tab on">Таблица</span><span class="tab">Группы</span><span class="tab">Плей-офф</span><span class="tab">Статистика</span><span class="tab">Ростер</span><span class="tab">TP</span>
  </div>

  <div class="h2">Сборка · L1 + L2 + L3 (sticky-стопка)</div>
  <div style="display:flex;flex-direction:column;gap:10px;padding:16px;border-radius:32px;background:var(--carve-bg);box-shadow:var(--sh-carve)">
    <div class="bar" style="padding:10px 14px">
      <div class="brand"><span class="blogo">L</span>LEAGUE OF SPIRITS</div>
      <div class="navset" style="margin-left:18px"><span class="pill on">Турниры</span><span class="pill">Команды</span><span class="pill">Игроки</span></div>
      <div class="spacer"></div>
      <span class="userchip"><span class="av" style="width:28px;height:28px"></span>Ник игрока</span>
    </div>
    <div class="l2bar"><span class="tsel">LOST Season 3<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg></span><span class="segset"><span class="seg on">D1</span><span class="seg">D2</span></span><div class="spacer"></div><span class="chip plain">тур 7 из 14</span></div>
    <div class="l3bar"><span class="tab on">Таблица</span><span class="tab">Группы</span><span class="tab">Плей-офф</span><span class="tab">Статистика</span><span class="tab">Ростер</span><span class="tab">TP</span></div>
  </div>

  <div class="h2">Мобильный · 390px</div>
  <div class="row" style="align-items:flex-start;gap:32px">
    <div class="mwrap">
      <div class="lbl">Свёрнутая шапка: лого + бургер, L2 остаётся на виду</div>
      <div class="mbar">
        <span class="burger"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span>
        <div class="brand" style="font-size:14px"><span class="blogo" style="width:34px;height:34px;border-radius:12px;font-size:13px">L</span>LOST</div>
        <div class="spacer"></div>
        <span class="av" style="width:38px;height:38px"></span>
      </div>
      <div class="l2bar" style="padding:9px 12px"><span class="tsel" style="padding:8px 12px;font-size:13px">Season 3<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg></span><span class="segset" style="padding:7px;gap:7px"><span class="seg on" style="padding:10px 16px;font-size:13px">D1</span><span class="seg" style="padding:10px 16px;font-size:13px">D2</span></span></div>
      <div class="lbl" style="margin-top:6px">L3 — горизонтальный скролл, активная промотана в вид</div>
      <div class="mtabs"><span class="tab on">Таблица</span><span class="tab">Группы</span><span class="tab">Плей-офф</span><span class="tab">Стат…</span></div>
    </div>

    <div>
      <div class="lbl">Меню в Sheet — разделы L1, тач-цель 44px</div>
      <div class="msheet">
        <div style="display:flex;align-items:center;gap:12px;padding:4px 6px 14px">
          <div class="brand" style="font-size:14px"><span class="blogo" style="width:34px;height:34px;border-radius:12px;font-size:13px">L</span>LEAGUE OF SPIRITS</div>
          <div class="spacer"></div><span class="xbtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 6l12 12M18 6L6 18"/></svg></span>
        </div>
        <div class="mlink on"><span class="idisc"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 6h16M4 12h16M4 18h10"/></svg></span>Турниры<span class="cnt">3</span></div>
        <div class="mlink"><span class="idisc neu"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M4 20v-2a5 5 0 015-5h6a5 5 0 015 5v2"/><circle cx="12" cy="7" r="4"/></svg></span>Команды<span class="cnt">28</span></div>
        <div class="mlink"><span class="idisc neu"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0114 0"/></svg></span>Игроки<span class="cnt">140</span></div>
        <div class="mlink"><span class="idisc neu"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M6 4h12v16H6z"/><path d="M9 9h6M9 13h6"/></svg></span>Правила</div>
        <div class="msep"></div>
        <div class="mlink"><span class="av" style="width:26px;height:26px"></span>Кабинет</div>
        <div class="mlink down" style="color:#B4595A">Выйти</div>
      </div>
    </div>
  </div>
</div>`
,

// ——— Футер ———
Footer: `<div class="board">
  <h1 class="title">Кит · Футер</h1>
  <p class="subt">Нижняя часть каждой страницы продукта: колонки ссылок, о лиге, соцсети, правовая строка. Мобильный вариант — колонки в стопку.</p>

  <div class="h2">Футер · 1220px</div>
  <div class="footer">
    <div class="fcols">
      <div>
        <div class="brand"><span class="blogo" style="width:38px;height:38px;border-radius:14px;display:grid;place-items:center;font-size:15px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm)">L</span><span style="font-size:15px;font-weight:900">LEAGUE OF SPIRITS</span></div>
        <p class="fabout">Любительская лига по Dota 2: сезонные турниры, дивизионы, разбор матчей и рейтинг игроков.</p>
        <div class="fsoc">
          <span class="btn sm quiet ib round"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 5L3 11l6 2 2 6 4-5 5 4z"/></svg></span>
          <span class="btn sm quiet ib round"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg></span>
          <span class="btn sm quiet ib round"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M8 20v-4M8 16c-4 0-4-3-5-4M16 20v-3.5c0-1 .2-1.7-.5-2.4 2.3-.3 4.5-1.2 4.5-5a3.9 3.9 0 00-1-2.7 3.6 3.6 0 00-.1-2.7s-.9-.3-2.9 1.1a10 10 0 00-5 0C9 3.4 8.1 3.7 8.1 3.7a3.6 3.6 0 00-.1 2.7A3.9 3.9 0 007 9.1c0 3.8 2.2 4.7 4.5 5-.7.7-.7 1.4-.5 2.4V20"/></svg></span>
        </div>
      </div>
      <div>
        <div class="fhead">Турниры</div>
        <span class="flink on">Текущий сезон</span>
        <span class="flink">Архив сезонов</span>
        <span class="flink">Расписание</span>
        <span class="flink">Плей-офф</span>
      </div>
      <div>
        <div class="fhead">Участникам</div>
        <span class="flink">Правила лиги</span>
        <span class="flink">Заявка на турнир</span>
        <span class="flink">Команды</span>
        <span class="flink">Игроки</span>
      </div>
      <div>
        <div class="fhead">Лига</div>
        <span class="flink">О проекте</span>
        <span class="flink">Партнёрам</span>
        <span class="flink">Связаться</span>
        <span class="flink">Медиакит</span>
      </div>
    </div>
    <div class="fbot">
      <span>© 2026 League of Spirits</span>
      <span class="right"><span>Правила</span><span>Конфиденциальность</span><span>Контакты</span></span>
    </div>
  </div>

  <div class="h2">Мобильный вид · 390px</div>
  <div class="fmob">
    <div class="brand"><span class="blogo" style="width:34px;height:34px;border-radius:12px;display:grid;place-items:center;font-size:13px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm)">L</span><span style="font-size:14px;font-weight:900">LEAGUE OF SPIRITS</span></div>
    <p class="fabout">Любительская лига по Dota 2: сезонные турниры и рейтинг игроков.</p>
    <div class="accitem" style="margin-top:18px;border-radius:22px">
      <div class="acchead" style="padding:15px 18px;font-size:15px">Турниры<span class="chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M6 9l6 6 6-6"/></svg></span></div>
    </div>
    <div class="accitem" style="margin-top:10px;border-radius:22px">
      <div class="acchead" style="padding:15px 18px;font-size:15px">Участникам<span class="chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M6 9l6 6 6-6"/></svg></span></div>
    </div>
    <div class="accitem" style="margin-top:10px;border-radius:22px">
      <div class="acchead" style="padding:15px 18px;font-size:15px">Лига<span class="chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M6 9l6 6 6-6"/></svg></span></div>
    </div>
    <div class="fsoc" style="justify-content:center;margin-top:20px">
      <span class="btn sm quiet ib round"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 5L3 11l6 2 2 6 4-5 5 4z"/></svg></span>
      <span class="btn sm quiet ib round"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10 9.5l5 2.5-5 2.5z"/></svg></span>
    </div>
    <div class="fbot" style="justify-content:center;margin-top:18px"><span>© 2026 League of Spirits</span></div>
  </div>
</div>`
};

// Хвосты CSS листов, добавленных после первой редакции Кита. Базовый STYLE общий для всех
// артбордов; сюда попадают только рецепты, которые нужны одному листу и больше нигде.
// Проверено: ни один селектор отсюда не переопределяет базовый — порядок склейки роли не играет.
const EXTRA = {
  // Профиль · атомы
  ProfileAtoms: `
/* hero — переработка: подложка-баннер + чистая личность (фото · №id · ник · ФИО · роль) */
.herobanner{position:absolute;top:0;left:0;right:0;height:150px;overflow:hidden;pointer-events:none;background:linear-gradient(135deg,#DCEFE6,#BFE1CF 55%,#A6D3BC);}
.herobanner:before{content:"";position:absolute;inset:0;background:radial-gradient(80% 140% at 10% 0%,rgba(255,255,255,.6),transparent 55%);}
.herobanner:after{content:"";position:absolute;left:0;right:0;bottom:0;height:64px;background:linear-gradient(180deg,transparent,rgba(248,244,236,.94));}
.heromono{position:absolute;right:-6px;top:-28px;width:190px;height:190px;color:#184636;opacity:.10;}
.herobody{position:relative;display:flex;align-items:flex-end;gap:26px;padding:0 32px 30px;margin-top:76px;}
.bigav.ring{box-shadow:var(--sh-mint),0 0 0 6px #F6F2EB;}
.idcoin{position:absolute;left:32px;top:28px;min-width:52px;height:52px;padding:0 16px;border-radius:999px;display:inline-flex;align-items:center;gap:7px;font-weight:900;font-variant-numeric:tabular-nums;font-size:19px;color:var(--mint-ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.idcoin small{font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.5px;}
.pname{font-size:40px;font-weight:900;letter-spacing:-1px;line-height:1;}
.preal{font-weight:700;color:var(--mut);margin-top:8px;font-size:16px;}
.proles{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px;}
.chip.warn{color:#7A5A16;background:linear-gradient(135deg,#F7E3AA,#E8C56E);box-shadow:0 0 0 1px rgba(255,255,255,.4),inset 2px 2px 3px -1px rgba(255,255,255,.85),inset -2px -3px 4px -1px rgba(150,110,30,.35),0 3px 5px rgba(150,120,50,.22),0 12px 22px -5px rgba(150,120,50,.34);}
/* ── страница профиля игрока ── */
.ppgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,400px);gap:26px;margin-top:26px;align-items:start;}
.ppcol{display:flex;flex-direction:column;gap:26px;min-width:0;}
.pcard{border-radius:30px;background:var(--grad-surface);box-shadow:var(--sh-raise);padding:24px 26px;min-width:0;}
/* сегмент-контрол во всю ширину блока (Официальные/Рейтинговые, Турнирные/Рейтинг) */
.segfull{display:flex;gap:6px;padding:6px;border-radius:16px;background:var(--carve-bg);box-shadow:var(--sh-carve);margin:2px 0 14px;}
.segfull .s{flex:1;min-width:0;text-align:center;border-radius:11px;padding:8px 4px;font-size:11px;font-weight:800;letter-spacing:-.1px;color:var(--mut);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.segfull .s.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* блок ссылок: ширина = самая широкая раскрытая ссылка (не растягиваем на всю колонку) */
.linksbox{align-self:flex-start;}
.phead{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.plink{font-size:12px;font-weight:800;color:#3FA981;}
/* бублик карьеры */
.donutwrap{display:flex;align-items:center;gap:28px;flex-wrap:wrap;}
.donut{position:relative;width:206px;height:206px;border-radius:999px;flex:none;background:conic-gradient(#8CC9AA 0 62%,#DCD6C9 62% 100%);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 0 0 0 1px rgba(120,108,78,.14),0 12px 26px -6px rgba(120,108,78,.28);}
.donuthole{position:absolute;inset:24px;border-radius:999px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}
.donuthole .big{font-size:44px;font-weight:900;letter-spacing:-1px;color:var(--mint-ink);font-variant-numeric:tabular-nums;line-height:1;}
.donuthole .cap{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);}
.coins{flex:1;min-width:220px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
.coin{display:flex;flex-direction:column;align-items:center;gap:9px;}
.coindisc{width:60px;height:60px;border-radius:999px;display:grid;place-items:center;color:var(--mint-ink);background:linear-gradient(135deg,#FFFFFF,#E6F4EE);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 1px 1px 2px rgba(255,255,255,.95),inset -1px -3px 5px rgba(70,140,105,.34),0 5px 9px -1px rgba(40,100,76,.3);}
.coinv{font-size:16px;font-weight:900;letter-spacing:-.4px;font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap;}
.coinl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--sub);text-align:center;}
/* строка игры / героя */
.grow{display:flex;align-items:center;gap:10px;border-radius:18px;padding:11px 12px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.gbar{width:6px;height:38px;border-radius:999px;flex:none;box-shadow:0 0 0 1px rgba(255,255,255,.35),inset 1px 1px 1px rgba(255,255,255,.4),inset -1px -2px 2px rgba(0,0,0,.18);}
.gbar.win{background:linear-gradient(180deg,#A9DCC3,#8CC9AA);} .gbar.lose{background:linear-gradient(180deg,#E7A9A9,#D48B8B);}
.gthumb{width:58px;height:40px;border-radius:11px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset -1px -2px 3px rgba(0,0,0,.18),0 2px 4px rgba(120,108,78,.2);}
.gmid{flex:1;min-width:0;display:flex;flex-direction:column;} .gtop{display:block;font-size:14px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;} .gtop .wl{margin-right:6px;} .gsub{display:block;font-size:12px;font-weight:700;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wl{font-weight:900;} .wl.w{color:var(--mint-ink);} .wl.l{color:#B4595A;}
.gkda{text-align:right;flex:none;font-variant-numeric:tabular-nums;} .gkda .m{font-size:16px;font-weight:900;} .gkda .s{font-size:11px;font-weight:800;color:var(--sub);margin-top:2px;}
.kk{color:var(--mint-ink);} .kd{color:#B4595A;} .ka{color:#5B7596;} .kx{color:var(--sub);}
.heroesgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;}
/* единая сетка одинаковых строк (игры и герои) в 2 колонки */
.rowgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}
.hwr{margin-left:auto;flex:none;font-size:15px;font-weight:900;color:var(--mint-ink);font-variant-numeric:tabular-nums;}
.hwr{margin-left:auto;font-size:14px;font-weight:900;color:var(--mint-ink);font-variant-numeric:tabular-nums;}
/* правый рельс — данные */
.facts{display:grid;grid-template-columns:1fr 1fr;gap:18px 16px;}
.fk{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--sub);margin-bottom:3px;}
.fv{font-size:19px;font-weight:900;letter-spacing:-.3px;} .fv small{font-size:13px;font-weight:800;color:var(--mut);} .fv.acc{color:var(--mint-ink);}
.achv{display:flex;align-items:flex-start;gap:10px;font-size:14px;font-weight:700;color:var(--ink);} .achv+.achv{margin-top:12px;}
.achv .adot{width:22px;height:22px;border-radius:999px;flex:none;margin-top:1px;display:grid;place-items:center;color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* основную колонну делим: узкие «Последние игры» + «Герои» */
.mainsplit{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:stretch;}
.mainsplit .pcard{padding:20px 18px;}
/* данные — россыпь маленьких блоков */
.factgrid{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
.factbox{border-radius:16px;padding:12px 14px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.trole{margin-left:auto;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--sub);}
.you{color:var(--mint-ink);}
/* Герои — квадратные плитки, инфа стопкой (без наслаивания) */
.htiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.htile{border-radius:18px;padding:12px;min-width:0;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.htile .th{display:block;width:100%;height:58px;border-radius:12px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset -1px -2px 3px rgba(0,0,0,.18);}
.htile .nm{font-size:13.5px;font-weight:900;margin-top:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hbot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;}
.hbot .rec{font-size:11.5px;font-weight:700;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wrpill{flex:none;font-size:12px;font-weight:900;color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);border-radius:999px;padding:3px 10px;}
/* строка игры — квадратная миниатюра, K/D/A жёстко справа */
.gthumb.sq{width:36px;height:36px;border-radius:10px;}
.gkda{min-width:52px;}
/* ссылки — крупные иконки внахлёст, раскрываются при наведении */
.linkstack{display:flex;padding-top:4px;height:54px;align-items:center;}
.lk{position:relative;display:inline-flex;align-items:center;height:48px;max-width:48px;flex:none;padding:0;border-radius:999px;overflow:hidden;color:var(--mint-ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);border:3px solid #F6F2EB;margin-left:-16px;cursor:pointer;transition:max-width .22s ease,transform .16s ease,box-shadow .16s ease;}
.lk:first-child{margin-left:0;}
.lk .lki{width:22px;height:22px;flex:none;margin:0 13px;}
.lk .lkt{white-space:nowrap;font-size:14px;font-weight:800;color:var(--ink);padding-right:20px;opacity:0;transition:opacity .16s ease;}
.lk:hover{max-width:220px;z-index:5;transform:translateY(-5px);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 2px 3px 4px -1px rgba(255,255,255,.95),inset -3px -4px 6px -2px rgba(70,140,105,.34),0 12px 22px -4px rgba(80,150,115,.4);}
.lk:hover .lkt{opacity:1;}
@media (prefers-reduced-motion:reduce){.lk{transition:none;}}
/* Команда — крупная карточка + интерактивные мини-карточки игроков (как ссылки) */
.teamcardbig{display:flex;align-items:center;gap:14px;border-radius:22px;padding:15px 18px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
/* мини-карточки игроков внахлёст: наведённая всплывает поверх и раскрывается в имя+роль */
.playstack{display:flex;align-items:center;padding:14px 0 6px;}
.pcardm{position:relative;display:flex;align-items:center;height:66px;width:auto;max-width:66px;flex:none;min-width:0;overflow:hidden;border-radius:999px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);border:3px solid #F6F2EB;margin-left:-26px;cursor:pointer;transition:max-width .26s ease,transform .16s ease,box-shadow .16s ease;}
.pcardm:first-child{margin-left:0;}
.pcardm .pav{width:60px;height:60px;flex:none;border-radius:999px;display:grid;place-items:center;color:#fff;font-weight:900;font-size:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35),inset -1px -3px 5px rgba(0,0,0,.2);}
.pcardm .pinfo{padding:0 15px 0 11px;min-width:0;}
.pcardm .pnm{font-size:15px;font-weight:900;white-space:nowrap;}
.pcardm .prl{font-size:11px;font-weight:800;letter-spacing:.4px;color:var(--sub);text-transform:uppercase;white-space:nowrap;margin-top:2px;}
/* раскрытие по ширине текста (max-content), с потолком чтобы не выйти за правый край блока */
.pcardm:hover{max-width:200px;z-index:6;transform:translateY(-6px);box-shadow:0 0 0 1px rgba(255,255,255,.5),inset 2px 3px 4px -1px rgba(255,255,255,.95),inset -3px -4px 6px -2px rgba(150,135,105,.28),0 14px 24px -4px rgba(120,108,78,.4);}
.pcardm.me{border-color:#CDEBD9;} .pcardm.me .pnm{color:var(--mint-ink);}
@media (prefers-reduced-motion:reduce){.pcardm{transition:none;}}
`,
  // Турнирная таблица
  Standings: `
/* ——— турнирная таблица ——— */
.tbl{border-radius:34px;padding:8px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.tgrid{display:grid;grid-template-columns:64px 1fr 56px 56px 56px 74px 104px 88px;align-items:center;}
.thead{padding:14px 18px 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);}
.thead .num,.trow .num{text-align:center;}
.sortable{display:inline-flex;align-items:center;gap:5px;justify-content:center;}
.sortable.on{color:var(--mint-ink);}
.sortcap{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:var(--carve-bg);box-shadow:var(--sh-carve);}
.sortable.on .sortcap{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);color:var(--mint-ink);}
.trow{padding:11px 18px;border-radius:24px;font-size:14px;font-weight:800;}
.trow+.trow{margin-top:2px;}
.trow.zsplit{margin-top:12px;padding-top:16px;border-top:1px dashed var(--line2);}
.trow.me{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);color:var(--mint-ink);}
.trow.me .tname{color:var(--mint-ink);}
.trow.hov{background:var(--grad-surface);box-shadow:var(--sh-raise-sm);transform:translateY(-2px);}
.trow.out{opacity:.72;}
.tplace{display:flex;align-items:center;gap:9px;}
.tpn{font-size:15px;font-weight:900;font-variant-numeric:tabular-nums;width:22px;text-align:right;}
.tteam{display:flex;align-items:center;gap:12px;min-width:0;}
.tname{font-size:15px;font-weight:900;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tsub{font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;}
.tnum{text-align:center;font-variant-numeric:tabular-nums;color:var(--mut);}
.tnum.win{color:var(--ink);} .tdiff{text-align:center;font-variant-numeric:tabular-nums;font-weight:900;}
.tdiff.pos{color:#2E7D5E;} .tdiff.neg{color:#B4595A;}
.form{display:flex;gap:5px;justify-content:center;}
.fdot{width:17px;height:17px;border-radius:7px;display:grid;place-items:center;font-size:10px;font-weight:900;}
.fdot.w{color:#184636;background:linear-gradient(135deg,#D5F2E2,#9CD3B6);box-shadow:var(--sh-mint-sm);}
.fdot.l{color:#7C2F2F;background:linear-gradient(135deg,#F5D3D3,#E3A3A3);box-shadow:var(--sh-raise-sm);}
.fdot.n{color:var(--sub);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.tpts{display:flex;justify-content:flex-end;}
.zlegend{display:flex;gap:22px;flex-wrap:wrap;align-items:center;font-size:12px;font-weight:800;color:var(--mut);}
.zlegend .zi{display:inline-flex;align-items:center;gap:9px;}
/* мобильная строка 390 */
.mob{width:390px;border-radius:34px;padding:10px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.mrow{display:flex;align-items:center;gap:11px;padding:11px 12px;border-radius:22px;font-weight:800;}
.mrow+.mrow{margin-top:2px;}
.mrow.me{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);color:var(--mint-ink);}
.mmeta{font-size:11px;font-weight:800;color:var(--sub);margin-top:1px;}
`,
  // Карточка встречи
  SeriesCard: `
/* ——— карточка встречи (серии) ——— */
.scard{border-radius:30px;padding:20px 22px;background:var(--grad-surface);box-shadow:var(--sh-raise);width:498px;}
.scard.wide{width:100%;}
.stop{display:flex;align-items:center;gap:10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);}
.stop .right{margin-left:auto;}
.sbody{display:grid;grid-template-columns:1fr 118px 1fr;align-items:center;gap:12px;margin-top:16px;}
.steam{display:flex;align-items:center;gap:12px;min-width:0;}
.steam.rev{flex-direction:row-reverse;text-align:right;}
.sname{font-size:17px;font-weight:900;letter-spacing:-.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.stag{font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;}
.sscore{display:flex;align-items:center;justify-content:center;gap:8px;border-radius:22px;padding:10px 0;background:var(--carve-bg);box-shadow:var(--sh-carve);font-variant-numeric:tabular-nums;}
.sscore b{font-size:26px;font-weight:900;letter-spacing:-1px;}
.sscore .dash{color:var(--sub);font-weight:900;}
.sscore b.lose{color:var(--sub);}
.sscore.soon{font-size:15px;font-weight:900;color:var(--mut);letter-spacing:-.2px;}
.sfoot{display:flex;align-items:center;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line);font-size:12px;font-weight:800;color:var(--mut);}
.sfoot .right{margin-left:auto;}
.livedot{width:9px;height:9px;border-radius:999px;background:linear-gradient(135deg,#F0A0A0,#D06B6B);box-shadow:0 0 0 3px rgba(208,107,107,.18);}
.maps{display:flex;gap:6px;}
.map{min-width:34px;height:26px;border-radius:10px;display:grid;place-items:center;font-size:11px;font-weight:900;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.map.w{color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* строка расписания */
.srow{display:grid;grid-template-columns:96px 1fr 92px 1fr 130px;align-items:center;gap:12px;padding:13px 18px;border-radius:24px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.stime{font-size:13px;font-weight:900;color:var(--mut);font-variant-numeric:tabular-nums;}
.stime i{display:block;font-style:normal;font-size:11px;color:var(--sub);font-weight:800;}
/* мобильная карточка */
.smob{width:358px;}
.smob .sbody{grid-template-columns:1fr 70px 1fr;gap:8px;}
.smob .sname{font-size:14px;}
.smob .tmark{width:32px;height:32px;font-size:11px;}
.smob .sname{font-size:15px;}
`,
  // Групповой этап
  Groups: `
/* ——— групповой этап ——— */
.gwrap{display:grid;grid-template-columns:1fr 1fr;gap:26px;}
.gcard{border-radius:32px;padding:20px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.ghead{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
.gtitle{font-size:20px;font-weight:900;letter-spacing:-.4px;}
.gmeta{margin-left:auto;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);}
.ggrid{display:grid;grid-template-columns:30px 1fr 46px 46px 62px;align-items:center;font-size:14px;font-weight:800;}
.ghd{padding:8px 12px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--sub);text-align:center;}
.ghd.l{text-align:left;}
.grow{padding:9px 12px;border-radius:18px;}
.grow+.grow{margin-top:2px;}
.grow.up{background:var(--grad-mint);box-shadow:var(--sh-mint-sm);color:var(--mint-ink);}
.gnum{text-align:center;font-variant-numeric:tabular-nums;color:var(--mut);}
.grow.up .gnum{color:rgba(24,70,54,.8);}
.gteam{display:flex;align-items:center;gap:10px;min-width:0;}
.gname{font-size:14px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
/* кросс-таблица */
.cross{border-radius:32px;padding:18px 20px 20px;background:var(--grad-surface);box-shadow:var(--sh-raise);display:inline-block;}
.ctab{border-collapse:separate;border-spacing:4px;}
.ctab th{font-size:11px;font-weight:800;color:var(--sub);text-transform:uppercase;letter-spacing:.6px;padding:4px 6px;}
.ctab th.side{text-align:left;width:180px;text-transform:none;letter-spacing:0;color:var(--ink);}
.cell{width:56px;height:44px;border-radius:14px;display:grid;place-items:center;font-size:14px;font-weight:900;font-variant-numeric:tabular-nums;color:var(--mut);background:var(--carve-bg);box-shadow:var(--sh-carve);}
.cell.w{color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.cell.l{color:#7C2F2F;background:linear-gradient(135deg,#F7DCDC,#EDC0C0);box-shadow:var(--sh-raise-sm);}
.cell.self{background:linear-gradient(135deg,#E4DFD4,#D6D0C3);box-shadow:var(--sh-carve);color:var(--sub);}
.cell.soon{color:var(--sub);font-size:12px;font-weight:800;}
.cside{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:900;}
`,
  // Hero-шапка команды
  TeamHero: `
/* ——— hero-шапка команды ——— */
.biglogo{width:150px;height:150px;border-radius:38px;flex:none;display:grid;place-items:center;font-size:38px;font-weight:900;letter-spacing:-1px;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint);}
.tstat{display:flex;gap:12px;flex-wrap:wrap;}
.rostline{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:20px;background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.rostline .nm{font-size:14px;font-weight:900;}
.rostline .rl{margin-left:auto;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--sub);}
.capmark{font-size:10px;font-weight:900;color:#2E7D5E;text-transform:uppercase;letter-spacing:.8px;}
.hmob{width:390px;border-radius:34px;overflow:hidden;position:relative;background:var(--grad-surface);box-shadow:var(--sh-raise);}
`,
  // Шапка сайта и меню
  SiteNav: `
/* ——— шапка сайта L1/L2/L3 ——— */
.bar{display:flex;align-items:center;gap:14px;border-radius:26px;padding:12px 16px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.brand{display:flex;align-items:center;gap:11px;font-size:15px;font-weight:900;letter-spacing:-.2px;}
.blogo{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;font-size:15px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);flex:none;}
.navset{display:flex;align-items:center;gap:8px;}
.spacer{margin-left:auto;}
.userchip{display:flex;align-items:center;gap:10px;border-radius:20px;padding:7px 14px 7px 8px;font-size:13px;font-weight:800;color:var(--ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.l2bar{display:flex;align-items:center;gap:14px;border-radius:24px;padding:11px 16px;background:var(--grad-board);box-shadow:var(--sh-raise-sm);}
.tsel{display:flex;align-items:center;gap:9px;border-radius:18px;padding:9px 14px;font-size:14px;font-weight:900;color:var(--ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);}
.l3bar{display:flex;align-items:center;gap:6px;padding:8px;border-radius:22px;background:var(--carve-bg);box-shadow:var(--sh-carve);overflow:hidden;}
.tab{border-radius:16px;padding:11px 18px;font-size:14px;font-weight:800;color:var(--mut);white-space:nowrap;}
.tab.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
/* мобильная шапка и меню */
.mwrap{width:390px;display:flex;flex-direction:column;gap:12px;}
.mbar{display:flex;align-items:center;gap:12px;border-radius:24px;padding:10px 12px;background:var(--grad-surface);box-shadow:var(--sh-raise);}
.burger{width:44px;height:44px;border-radius:16px;display:grid;place-items:center;color:var(--ink);background:var(--grad-surface);box-shadow:var(--sh-raise-sm);flex:none;}
.mtabs{display:flex;gap:6px;padding:7px;border-radius:22px;background:var(--carve-bg);box-shadow:var(--sh-carve);overflow:hidden;}
.mtabs .tab{padding:12px 16px;min-height:44px;display:flex;align-items:center;}
.msheet{width:390px;border-radius:34px;padding:18px;background:var(--grad-surface);box-shadow:0 0 0 1px rgba(255,255,255,.55),inset 2px 3px 4px -1px rgba(255,255,255,.95),0 36px 72px -12px rgba(60,50,30,.42);}
.mlink{display:flex;align-items:center;gap:12px;padding:14px 15px;border-radius:20px;font-size:16px;font-weight:800;color:var(--ink);min-height:44px;}
.mlink.on{color:var(--mint-ink);background:var(--grad-mint);box-shadow:var(--sh-mint-sm);}
.mlink .cnt{margin-left:auto;font-size:12px;font-weight:800;color:var(--sub);}
.mlink.on .cnt{color:rgba(24,70,54,.7);}
.bar .btn.ib.round{width:44px;height:44px;padding:0;}
`,
  // Футер
  Footer: `
/* ——— футер ——— */
.footer{border-radius:38px;padding:34px 38px 26px;background:var(--grad-board);box-shadow:var(--sh-raise);}
.fcols{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr;gap:34px;}
.fhead{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px;color:var(--sub);margin-bottom:14px;}
.flink{display:block;font-size:14px;font-weight:800;color:var(--mut);padding:7px 0;}
.flink.on{color:var(--ink);}
.fabout{font-size:13px;font-weight:700;color:var(--mut);line-height:1.6;max-width:280px;margin-top:12px;}
.fsoc{display:flex;gap:10px;margin-top:16px;}
.fbot{display:flex;align-items:center;gap:14px;margin-top:28px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;font-weight:800;color:var(--sub);}
.fbot .right{margin-left:auto;display:flex;gap:16px;}
.fmob{width:390px;border-radius:34px;padding:24px 22px 18px;background:var(--grad-board);box-shadow:var(--sh-raise);}
.brand{display:flex;align-items:center;gap:11px;font-size:15px;font-weight:900;letter-spacing:-.2px;white-space:nowrap;}
.blogo{width:38px;height:38px;border-radius:14px;display:grid;place-items:center;font-size:15px;font-weight:900;color:#184636;background:var(--grad-mint);box-shadow:var(--sh-mint-sm);flex:none;}
.fsoc .btn{width:46px;height:46px;border-radius:999px;padding:0;justify-content:center;}
`,
};

const wrap = (content, extra = "") =>
`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet><style>${STYLE}${extra}</style></helmet>
${content}
</x-dc>
</body>
</html>
`;

for (const [name, content] of Object.entries(boards)) {
  writeFileSync(new URL(`./${name}.dc.html`, import.meta.url), wrap(content, EXTRA[name] ?? ""));
  console.log("wrote", name + ".dc.html");
}
