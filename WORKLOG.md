# WORKLOG — журнал работ

Одна запись на этап. Новейшее сверху, формат **≤5 строк**: дата · что · файлы · дальше.
Новый чат читает только верхнюю запись — `sed -n '1,30p' WORKLOG.md`.
Здесь держим **последние 10 записей**; когда набирается больше, нижние уезжают в
`docs/archive/WORKLOG-2026-09.md` (там же полные, неурезанные версии всех записей ниже)
и `docs/archive/WORKLOG-2026.md` (лето–август).
Отчёт о выполнении ТЗ пишется сюда, а не в файл ТЗ.

---

## 2026-09-24 — ТЗ 39: лимит записи на индивидуальный турнир + роли словами в эфире

`Tournament.registrationLimit Int?` (миграция `20260924160000_tournament_registration_limit`, снимок v19): `registerForTournament()` перед созданием записи считает строки `TournamentRegistration` и при достижении лимита отдаёт новую причину `JoinResult.reason: "full"` — отмена освобождает место сама, листа ожидания нет, статус турнира лимит не трогает. `/join/<slug>` печатает «X из N» тем же `Capacity`, что дивизионы (`unit="players"`), а при нуле мест показывает «Мест не осталось» вместо формы — и гостю, и вошедшему. Оператор задаёт число в «Правилах» консоли турнира тем же `PATCH /api/tournaments/[id]`, что тумблеры; меньше уже записанных поставить нельзя (тост с текстом отказа, поле откатывается). Отдельной правкой по замечанию `qa` к ТЗ 38: в оверлее OBS роли пишутся словами через слеш («Керри / Мид») — флажок `roleWords` у общего `DraftPlayerLine`, на борде и в пуле остались номера («поз. 1 · 2»).
Файлы: `prisma/schema.prisma` + миграция, `lib/mixcup.ts`, `api/tournaments/[id]/route.ts`, `(public)/join/[slug]/{page.tsx,actions.ts}`, `admin/tournaments/_components/{rules-panel,draft-console,participants-panel}.tsx`, `underbeer/[id]/_components/player-line.tsx`, `(bare)/overlay/draft/[id]/_components/overlay-live.tsx`, `scripts/{export,import}-db.ts`, `data/snapshot.json`, `docs/ARCHITECTURE.md`.
Проверено: `tsc`/`lint`/`build` чисто (прежний warning `pouf/media.tsx`). В браузере на 1440 и 375, временный турнир `test39` (underbeer, приём открыт, лимит 2, две записи): «2 из 2 · Мест нет» и «Мест не осталось» без формы; попытка поставить лимит 1 — тост «Уже записано 2 — лимит меньше поставить нельзя», поле вернулось к 2; снял одну запись — «1 из 2» и форма вернулась, записался сам и снова стало «2 из 2»; отмена вернула «1 из 2»; пустой лимит — «1 участник» и запись без отказа. Оверлей: на живом `#27` под ником «Керри»/«Мид», на временной сессии с двумя желаемыми ролями — «Керри / Мид», борд того же турнира — «поз. 1 · 2». Турнир, две учётки, два профиля и временная сессия удалены, записей на турниры в базе снова 0; `db:export` пересобран (v19).
Принято `qa` 24.09 (и оверлей), статус `done`; не проверен админ без `tournaments.edit` — нет второй учётки. ТЗ 41 (основные роли, до двух) заведено `pm`, развилки и DESIGN закрыты Стасом — `ready`.
Дальше: `stage` 41 (он же чинит «прошлый сезон → Несколько ролей» из 38). Открыто: `canRegister()` дублирует поиск профиля; 35 ждёт `qa`, 33 закрыть как поглощённое 37; состояние «лимит» в артборд «Чипы выбора» Кита.

---

## 2026-09-24 — ТЗ 38: запись на индивидуальный турнир спрашивает роли

Форма `/join/<slug>` обязательно спрашивает несколько желаемых ролей новым атомом Кита `ChoiceChips` (серверный: нативные флажки `sr-only` + чип по `pillClasses`, класс `.pouf-choice-chip`); ни одной не отмечено — `?err=roles` и плашка под рядом. Роли ложатся в `TournamentRegistration.desiredRoles` (CSV, миграция `20260924120000_registration_desired_roles`, снимок v18), разбор — `parseRoleKeys`/`joinRoleKeys` в `roles.ts`. `PoolPlayer.role`/`.position` → `roles: string[]`; `segmentPool` завёл сегмент «Несколько ролей» первым слева, подпись в пуле — «поз. 1 · 5»; `draftPool(tournamentId)` подмешивает роли только тем, у кого нет `RosterSpot`. Кука-намерение больше не записывает сама (`canRegister`), а возвращает на страницу записи — иначе гость въезжал бы без ролей.
Файлы: `pouf/{choice-chips.tsx,pouf.css}`, `lib/{roles,draft,draft-data,mixcup}.ts`, `(public)/join/[slug]/{page,actions,loading}`, `(public)/me/{actions.ts,mixcup-intent.tsx}`, `admin/tournaments/_components/{draft-console,participants-panel,result-grid}.tsx`, `admin/tournaments/[slug]/draft/page.tsx`, `(bare)/overlay/draft/[id]/page.tsx`, `underbeer/[id]/_components/{player-line,pool-columns}.tsx`, `prisma/**`, `scripts/{export,import}-db.ts`, `docs/{MAP,ARCHITECTURE}.md`.
Проверено: `tsc`/`lint`/`build` чисто (прежний warning `pouf/media.tsx`). В браузере на 1440 и 390, временный турнир `test38` (underbeer, приём открыт): отправка без ролей — плашка «Отметьте хотя бы одну роль» под чипами; две отмеченные роли сохранились, записанному показаны `Chip` только чтением; консоль печатает «Керри · Хард-саппорт» второй строкой; на борде участник без ростерного места лежит одной строкой в «Несколько ролей» (`поз. 1 · 5`), а рострованный `sdd` с `desiredRoles=coach,standin` остался в «Керри (поз. 1)» — место в составе сильнее желания. На 390 семь чипов легли в три строки, переполнения нет. Временный турнир, три записи и его сессия драфта удалены, база как была; `db:export` пересобран (v18).
Принято `qa` 24.09, статус `done`; отмена «без второго клика» ТЗ 34 — блок в `DECISIONS.md`. Артборд «Чипы выбора» добавлен в Кит (страница «Атомы»).
Дальше: `stage` 39 (лимит записи). Открыто по замечаниям `qa` — оверлей OBS теперь пишет «поз. 1» вместо «Керри»; игрок с `RosterSpot` прошлого сезона попадает в «Несколько ролей»; `canRegister()` дублирует поиск профиля из `registerForTournament()`. 35 ждёт `qa`, 33 закрыть как поглощённое 37.

## 2026-09-23 — ТЗ 37: турнир получает формат (Mix Cup и UNDERBEER — `Tournament.kind`)

`MixCupEvent` удалена, `mixcup-6` (2 команды, 10 пиков, `DraftSession#27`) перенесён миграцией `20260923150000_tournament_kind`; спутники `TournamentDraftSettings`/`TournamentRegistration`, `Player.sourceTournamentId`, снимок v17. Консоль обоих форматов — карточка турнира `/admin/tournaments/<slug>` (+`/draft`), публичная запись — `/join/<slug>`; `/admin/mixcup/<id>`, `/mixcup/<slug>` и `/tournaments/<slug>` при kind≠season редиректят. Право `mixcup` → `tournaments.edit`, `mixcup-section.tsx` удалена, `pouf/capacity.tsx` получил `unit`.
Файлы: `prisma/**`, `lib/{tournaments,mixcup,account,permissions,auth}.ts`, `admin/{tournaments,mixcup}/**`, `(public)/{join,mixcup,me}/**`, `api/{tournaments,join,underbeer}/**`, `tournament-card.tsx`, `(home)/**`, `scripts/{export,import}-db.ts`, `sitemap.ts`, `docs/{MAP,ARCHITECTURE}.md`, `DECISIONS.md`, `BACKLOG.md`.
Проверено: `tsc`/`lint`/`build` чисто; в браузере на 1024 и 390 — мастер с полем «Формат» в два шага, консоль UNDERBEER-турнира, запись и отмена на `/join/<slug>`, обе карточки на `/tournaments` и главной, результат `mixcup-6`; `db:export` → `db:import` на чистой базе восстановил турнир с результатом. Тестовый турнир и запись удалены, база как была.
Правки после `qa` (той же датой): плита главной у индивидуального формата не рисует «Призовой —», `openForRegistrationAll()` отдаёт только `kind: season` (баннер, `/apply` и кабинет новичка больше не зовут «Заявить команду» на UNDERBEER-турнир), `TournamentRegistration` вошла в снимок отдельным списком (турнир и игрок слагами, аккаунт по почте/tgId — round-trip проверен на временной записи), `/admin/tournaments` печатает у таких турниров «записалось: N» вместо «дивизионов: 0». `/join/<несуществующий>` → 200 не чинил: причина унаследованная (`loading.tsx` + стриминг), строка в `BACKLOG.md`.
Принято `qa` со второго захода, статус `done`; не проверена только гостевая ветка AC №6 (нужна учётка). Решения Стаса по DESIGN: `/join/<slug>`, «Формат»/«Регламент строкой», право `tournaments.edit`.
Дальше: `design` на 38 (`ChoiceChips` в Ките), затем `stage` 38 и 39; 35 ждёт приёмки `qa`, 33 закрыть как поглощённое 37.

## 2026-09-23 — ТЗ 37-39: формат турнира, роли в заявке, лимит регистрации

Стас переиграл устройство событий: турнир заводится с выбором формата, регистрация — на команды
или на игроков. `pm` завёл три ТЗ (все `ready`, все later): 37 — `Tournament.kind`
(season|mixcup|underbeer), `MixCupEvent` удаляется, спутниковые модели обобщаются в
`TournamentDraftSettings`/`TournamentRegistration`; 38 — множественные желаемые роли одиночной
заявки (роль сейчас живёт только у `RosterSpot`, у одиночки её нет вовсе); 39 — лимит записи.
Отменены два вчерашних решения, оба зафиксированы с причиной: «Mix Cup не на плитке» (теперь он
обычный турнир в общих списках, `mixcup-section.tsx` удаляется) и «надстройка вместо модели» из
ТЗ 36. UNDERBEER по слову Стаса тоже получает регистрацию — объём вырос на новую публичную форму
и операторскую консоль, которых у него не было.
Файлы: `docs/tasks/37-39`, `BACKLOG.md`, `MVP.md`. Кода не писали.
Дальше: `design` на 37 (карточка индивидуального турнира, форма записи, консоль), затем `stage`;
37 блокирует 38 и 39. Не решено: URL публичной записи на UNDERBEER-турнир (`/underbeer/*` закрыт
правами, кандидат `/recruit/<slug>`) — не блокирует старт.

## 2026-09-23 — ТЗ 40: адрес оверлея драфта без «underbeer»

Новый маршрут `overlay/draft/[id]` (бывший `overlay/underbeer/[id]`, перенесён `git mv`), старый
адрес — редирект на новый с тем же `id`. Ссылка на борде (`draft-board.tsx:252`) генерирует
`/overlay/draft/${sessionId}` для обоих инструментов.
Файлы: `web/src/app/(bare)/overlay/draft/[id]/*`, `web/src/app/(bare)/overlay/underbeer/[id]/page.tsx`,
`web/src/app/(admin)/underbeer/[id]/_components/draft-board.tsx`.
Проверено: tsc/lint/build чисто; в браузере на реальной сессии #27 (mixcup-6) — новый адрес
рендерит оверлей с фоном Eclipse, старый редиректит на новый с тем же экраном. БД не трогал.
Дальше: `qa` принимает по acceptance criteria ТЗ 40.

## 2026-09-23 — процесс: state.sh, канон статуса ТЗ, порты 3000/3001

Разбор логов за 09–23.09 → `docs/PROCESS-REVIEW.md` (что перечитывалось по кругу, с цифрами).
Сделано по нему: `.claude/skills/pickup/state.sh` (состояние одной командой) и переписанный
`pickup`; канон статуса в 32 ТЗ (`draft|ready|wip|qa|done` + проза после «·») и в `_TEMPLATE`,
`pm`, `stage`, `qa`; контейнер `serve` → хостовый 3001, dev остаётся на 3000
(`docker-compose.yml`, `serve.sh`, `stop.sh`, `DEPLOY*.md`, `SMOKE.md`, `launch.json` без 4203);
порядок правок вёрстки в `design.md`; `docs/archive/` не читаем по умолчанию; скилл `handoff`
удалён — закрытие сессии одно, `ship` (WORKLOG → commit → push).
**Проверено.** `state.sh` прогнан (5 незакрытых ТЗ, 26 done), `docker compose config` чист,
статусы читаются одной командой. Кода приложения правки не касаются.
**Дальше:** первый `pickup` в новой сессии покажет, чего в `state.sh` не хватает; из незакрытого —
ТЗ 33 и 35 ждут приёмки `qa`, 12б ждёт референсов от Стаса.

## 2026-09-23 — ТЗ 36: плита «Турниры» — два состояния вместо трёх, признак однодневки

Группировка по `registrationOpen()` вместо трёх статусов: «Регистрация» / «Регистрация завершена»
(идёт+сыграно+просроченный приём — заодно чинит баг: `s4` пропадал с плиты вовсе). Пустая группа
не рендерится. Лента `flex-wrap` вместо `grid-cols-3`. Бейдж `Badge tone="mint"` «1 день» при
`endAt-startAt ≤ 1 сутки`. Файл: `web/src/app/(home)/tournaments-block.tsx`.
**Проверено.** tsc/lint (прежний warning `media.tsx`)/build чисты; 390/1024/1280/1440 в браузере —
`s4` виден в «Регистрация завершена», бейдж однодневки проверен временной записью (удалена).
`mixcup-section.tsx` и `schema.prisma` не тронуты.

## 2026-09-22 — ТЗ 35: Вид драфта — борд и оверлей смотрятся как эфир

Пилюля «Ходит» у команды хода (борд+оверлей). Рамка последнего пика — не поле payload, а
`lastMovedPlayer` (`lib/draft.ts`): разница срезов состояния, свой источник у борда и у оверлея.
Оверлей переехал на Light Clay (`overlay-live.tsx`): непрозрачные карточки, без пула, знак Eclipse
углом `bottom-12 right-12`. Файлы: `lib/draft.ts`, `team-column.tsx`, `draft-board.tsx`,
`player-line.tsx`, `overlay-live.tsx`. Проверено: tsc/lint/build чисто, браузер 390/1280/1440/1920.
Дальше: подставить реальный ассет Eclipse (§7 ТЗ), когда придёт.

## 2026-09-22 — ТЗ 34: Mix Cup — регистрация, страница события, секция на главной

Дверь в пул игроков: `/mixcup/<slug>` (правила + «Участвовать», без витрины участников), голый
`/mixcup` — редирект на текущее событие. Операторский Mix Cup **переехал `/mixcup` → `/admin/mixcup`**
(адрес освободился под публичную страницу). Новое: `MixCupRegistration`, `Player.verified`/
`mixCupSourceEventId` (исключение «в пул — до апрува», теневой профиль вместо раннего `playerId`),
кука-намерение `lost_mixcup_intent` (гость → `/me` → анкета → сам записывается и уводит на событие),
секция `(home)/mixcup-section.tsx`, панель «Участники»/«взять в драфт» в `/admin/mixcup/<id>`.
**Файлы.** `prisma/schema.prisma`+миграция, `lib/{mixcup,account,roster-data,search}.ts`, `lib/auth.ts`,
`app/(public)/mixcup/**`, `app/(public)/me/{page,actions,mixcup-intent}.tsx`, `app/(home)/{page,mixcup-section}.tsx`,
`app/(admin)/admin/mixcup/**` (перенос из `(admin)/mixcup`), `app/api/mixcup/**`, `app/sitemap.ts`,
`tournaments/[slug]/apply/pool.ts`, `scripts/{export-db,import-db}.ts` (снимок v16).
**Проверено.** tsc/lint/build чисто; браузером (DEV_LOGIN_EMAIL, временно) — создание события,
запись/отмена, разрез «новичок» в админке, закрытый приём блокирует кнопку, 390/1280/1440 без
переполнения; видимость `verified:false` скриптом (скрыт с /roster/players, карточки, поиска —
виден в draftPool). Тестовые событие/аккаунты убраны, `.env` возвращён как был.
**Дальше.** Ассетов Eclipse нет (баннер/OG не заводили — по SEO решению); qa — приёмка по критериям.

## 2026-09-22 — ТЗ 33: Mix Cup by Eclipse — тумблеры правил драфта и хранимый результат

Один движок, два входа: `/mixcup` заводит `MixCupEvent` (слаг, статус, тумблеры «Украсть»/
«Закрепить»), живой борд — тот же `draft-board.tsx`, та же `DraftSession`, тот же `PATCH
/api/underbeer/[id]` (гейт по праву динамический — `mixcup` или `underbeer`). `DraftState` получил
`stealEnabled?`/`lockEnabled?` (undefined = разрешено, старые сессии не ломаются), единственная
проверка — в `canLock`/`canSteal`. По `phase: "done"` результат уезжает durable-строками
(`MixCupTeam`/`MixCupPick`, FK на `Player` + снимок ника, `lib/mixcup.ts`) — только они в снимке
БД (версия 15), сама сессия остаётся эфемерной, как у UNDERBEER. Знак Eclipse — `PartnerMark`
(`pouf/media.tsx`) с запасной пилюлей: ассетов ещё нет (`MANUAL-TASKS.md` §7).
**Файлы.** `prisma/schema.prisma` (+миграции), `lib/{draft,mixcup,partners}.ts`, `lib/{permissions,auth}.ts`,
`app/(admin)/mixcup/**`, `app/api/mixcup/**`, `app/api/underbeer/[id]/route.ts`,
`app/(admin)/underbeer/[id]/_components/{draft-board,team-column,player-line}.tsx`,
`app/(bare)/overlay/underbeer/[id]/**`, `pouf/media.tsx`, `_components/{session-list,tools}`,
`scripts/{export-db,import-db}.ts`, `data/snapshot.json`.
**Проверено.** tsc/lint/build чисто. Бизнес-логика — временным скриптом (в БД не осталось следов):
тумблеры гейтят canSteal/canLock, драфт доходит до done, результат переживает отвязку игрока
(SetNull + снимок ника), export→import на копии базы поднимает то же событие по слагам. Браузером
экран не проверил — вход требует реального логина, `.env`/DEV_LOGIN_EMAIL не трогал.
**Дальше.** qa: приёмка по acceptance, включая прогон в браузере (390/1280/1440, права доступа).
Не входит в этот этап: числа краж/локов (33б), вид борда (35), регистрация (34).

---
