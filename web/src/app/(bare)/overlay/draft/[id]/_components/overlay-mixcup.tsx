"use client";

import { currentTurn, memberIds, segmentPool, takenIds, type DraftState, type PoolPlayer } from "@/lib/draft";
import { StatusPill } from "@/components/pouf/feedback";
import { Icon } from "@/components/pouf/Icon";
import { Eyebrow } from "@/components/pouf/text";
import { OVERLAY_MARKS, OVERLAY_PLATFORM, type OverlayMark } from "@/lib/partners";
import { roleShort } from "@/lib/roles";
import { useLiveDraft } from "./use-live-draft";
import { OVERLAY_DARK_SKIN } from "./skin";

/* Эфирная сцена Mix Cup (ТЗ 44) — одно окно 1920×1080 на весь драфт: слева восемь команд
 * сеткой 4×2, справа общий пул свободных игроков, внизу полоса знаков.
 *
 * Отдельный файл, а не ветка в `overlay-live.tsx`: от вида UNDERBEER здесь не остаётся ничего,
 * кроме опроса сессии (он вынесен в `useLiveDraft`) — общая была бы одна строка на две ветки
 * в каждом узле разметки.
 *
 * ПОЧЕМУ БЕЗ СКРОЛЛА И БЕЗ АДАПТИВА. Это сцена OBS, а не страница: единственный размер —
 * 1920×1080, и всё обязано влезть целиком. Поэтому пять слотов делят высоту карточки поровну
 * (`SLOT_H`), а не растут от содержимого: состав не должен прыгать, когда капитан берёт игрока.
 *
 * ПОЧЕМУ БЕЗ ФОТО. На восьми командах по пять человек аватарка съедает ширину, которая нужна
 * нику, ролям и MMR (решение Стаса 26.09.2026).
 *
 * Кожа и фон — те же, что были у оверлея с партнёром (`OVERLAY_DARK_SKIN`, 23.09.2026): тёмное
 * стекло поверх картинки события. У UNDERBEER ни того, ни другого нет и не появляется.
 */

/** Слот игрока: занятый и пустой делят высоту карточки поровну — состав не прыгает при пике. */
const SLOT_H = "min-h-[52px] flex-1";

/** Роли словами через слеш — у зрителя стрима нет словаря позиций (решение 24.09.2026, ТЗ 38). */
const rolesWords = (roles: string[]) => roles.map((r) => roleShort(r) ?? r).join(" / ");

const fmtMmr = (n: number) => n.toLocaleString("ru-RU");

export function OverlayMixCup({
  sessionId,
  initialState,
  pool,
  showMmr,
  background,
}: {
  sessionId: number;
  initialState: DraftState;
  /** Пул турнира целиком: свободные считаются как `participants` (или весь пул) минус взятые. */
  pool: PoolPlayer[];
  /** MMR на сцене Mix Cup показывается всегда (DECISIONS 26.09.2026), но флаг остаётся входом:
   *  подпись «Σ MMR» обязана уходить вместе с числами, а не висеть над пустотой. */
  showMmr: boolean;
  /** Картинка события под карточки. Нет — сцена остаётся на тёмной коже без фона. */
  background?: string | null;
}) {
  const { state, lastPickId } = useLiveDraft(sessionId, initialState);

  const byId = new Map(pool.map((p) => [p.id, p]));
  const cur = currentTurn(state);
  const taken = takenIds(state);
  // Участники ещё не отобраны (сцена открыта до фазы «Участники») — показываем весь пул турнира,
  // иначе колонка стояла бы пустой всё предэфирное время.
  const chosen = state.participants ?? [];
  const entered = chosen.length ? pool.filter((p) => chosen.includes(p.id)) : pool;
  const free = entered.filter((p) => !taken.has(p.id));
  const segments = segmentPool(free);

  return (
    <div
      // Ровно окно OBS: скролла нет, лишнее обрезается, а не растягивает сцену. 48px поля —
      // вещательная safe area.
      className="flex h-screen w-screen flex-col gap-4 overflow-hidden bg-cover bg-center bg-no-repeat p-12 font-pouf"
      style={background ? { backgroundImage: `url(${background})`, ...OVERLAY_DARK_SKIN } : OVERLAY_DARK_SKIN}
    >
      {/* Платформа — отдельно от партнёров, в углу, где зритель начинает читать кадр. */}
      <header className="flex shrink-0 items-center">
        <Mark mark={OVERLAY_PLATFORM} className="h-12" />
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-4 gap-3">
          {state.teams.map((team) => {
            const members = memberIds(team)
              .map((pid) => byId.get(pid))
              .filter((p): p is PoolPlayer => !!p);
            const mmrSum = members.reduce((s, p) => s + (p.mmr ?? 0), 0);
            const isCurrent = cur?.teamId === team.id;
            // Пустые слоты до полного состава — видимыми лунками, а не отсутствием строк.
            const empties = Math.max(0, state.targetSize - members.length);
            return (
              // Не `Card`, а её же токены: карточке нужна раскладка по высоте — слоты делят
              // остаток ячейки поровну, иначе в сетке 4×2 под составом зияет пустая треть.
              <div
                key={team.id}
                className="flex min-h-0 flex-col overflow-hidden rounded-card bg-surface cushion-card"
              >
                <div
                  className="flex shrink-0 items-center justify-between gap-2 px-3 py-2"
                  style={{ background: `${team.color}22` }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-pill" style={{ background: team.color }} />
                    <span className="min-w-0 truncate text-[17px] font-black text-ink">{team.name}</span>
                    {/* Пилюля «Ходит» — текстом, а не только цветной обводкой: на стрим-захвате
                        низкого битрейта обводку зритель не различит. */}
                    {isCurrent && <StatusPill tone="warn">Ходит</StatusPill>}
                  </div>
                  {showMmr && (
                    <span className="shrink-0 text-[11px] font-bold text-muted">Σ MMR {fmtMmr(mmrSum)}</span>
                  )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
                  {members.map((p) => (
                    <div
                      key={p.id}
                      className={`flex ${SLOT_H} items-center gap-2 rounded-control bg-surface-2 px-2.5 cushion-field ${
                        // Рамка последнего взятого — тот же приём, что на борде (ТЗ 35 п.4).
                        lastPickId === p.id ? "outline outline-1 outline-offset-1 outline-[color:var(--accent-fill)]" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="min-w-0 truncate text-[15px] font-black leading-tight text-ink">
                            {p.nickname}
                          </span>
                          {team.captainId === p.id && (
                            <span className="shrink-0 rounded-pill bg-accent-fill px-1.5 text-[9px] font-black leading-[15px] text-[var(--on-accent)]">
                              КАП
                            </span>
                          )}
                          {team.locked.includes(p.id) && (
                            <span className="shrink-0 text-muted">
                              <Icon name="lock" size="sm" label="Закреплён" />
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] font-bold leading-tight text-muted">
                          {rolesWords(p.roles) || "без позиции"}
                        </div>
                      </div>
                      {showMmr && p.mmr != null && (
                        <span className="shrink-0 text-[12px] font-extrabold tabular-nums text-muted">
                          {fmtMmr(p.mmr)}
                        </span>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: empties }, (_, i) => (
                    <div
                      key={`e${i}`}
                      className={`flex ${SLOT_H} items-center justify-center rounded-control border border-dashed border-white/20`}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-[1px] text-muted opacity-70">
                        Слот {members.length + i + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Панель пула — той же бумагой и подушкой Кита, что кладёт `Card`, но своим узлом:
            ей нужна раскладка по высоте — шапка плюс список на остаток окна. */}
        <aside className="flex w-[480px] shrink-0 flex-col overflow-hidden rounded-card bg-surface cushion-card">
          <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2">
            <Eyebrow>Свободные игроки</Eyebrow>
            <span className="text-[13px] font-black tabular-nums text-ink">{free.length}</span>
          </div>
          <div className="min-h-0 flex-1 columns-2 gap-4 overflow-hidden px-4 pb-3">
            {segments.map((seg) => (
              <div key={seg.key} className="mb-2 break-inside-avoid">
                <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[1px] text-muted opacity-80">
                  {seg.label}
                </div>
                {seg.players.map((p) => (
                  <div key={p.id} className="flex items-baseline gap-1.5 py-[3px]">
                    <span className="shrink-0 truncate text-[14px] font-black leading-tight text-ink">
                      {p.nickname}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[10px] font-bold leading-tight text-muted">
                      {rolesWords(p.roles)}
                    </span>
                    {showMmr && p.mmr != null && (
                      <span className="shrink-0 text-[11px] font-extrabold tabular-nums leading-tight text-muted">
                        {fmtMmr(p.mmr)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Бегущая строка партнёров: список повторён дважды и уезжает ровно на половину своей
          ширины — стык копий совпадает с началом, и петля не дёргается. Скорость привязана к числу
          знаков, чтобы с новым партнёром строка не ускорялась. */}
      <footer className="relative shrink-0 overflow-hidden rounded-card bg-black/45 py-4 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]">
        <style>{`@keyframes overlay-marquee { to { transform: translateX(-50%); } }`}</style>
        <div
          className="flex w-max items-center"
          style={{ animation: `overlay-marquee ${OVERLAY_MARKS.length * 10}s linear infinite` }}
        >
          {[...OVERLAY_MARKS, ...OVERLAY_MARKS, ...OVERLAY_MARKS, ...OVERLAY_MARKS].map((m, i) => (
            <Mark key={i} mark={m} className="mx-12 h-16" />
          ))}
        </div>
      </footer>
    </div>
  );
}

// Знак на сцене — голый файл, без `PartnerMark`: тот скругляет углы под раскладку Кита, а на
// эфирной сцене чужой знак должен читаться целиком. Лёгкое свечение отрывает светлые знаки от
// пёстрого фона Eclipse.
function Mark({ mark, className }: { mark: OverlayMark; className: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mark.src}
      alt={mark.name}
      className={`w-auto shrink-0 object-contain brightness-125 drop-shadow-[0_0_14px_rgba(255,255,255,0.28)] ${className}`}
    />
  );
}
