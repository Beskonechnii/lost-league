"use client";

import { useMemo } from "react";
import { Separator } from "@/components/pouf/separator";
import { Eyebrow } from "@/components/pouf/text";
import { POOL_PER_ATTR, isSelectable, type FearlessState } from "@/lib/fearless";
import { Panel } from "../../../_components/panel";
import { ATTR_LABEL, ATTR_ORDER, type HeroRef } from "./types";

/**
 * Пул карты: только те герои, что выпали в рандом-пул, разложенные по атрибуту.
 *
 * Плитками, а не строками Кита (`PlayerLine`): героя узнают по портрету, а не по имени, и
 * тридцать шесть строк с подписями не влезли бы в колонку рядом с расписанием. Перетаскивания
 * здесь нет вовсе — герой выбирается нажатием, поэтому и `pouf/board.tsx` этому экрану не
 * нужен (разбор §C5).
 */
export function HeroPool({
  state,
  heroById,
  locked,
  onPick,
  disabled,
  readOnly = false,
}: {
  state: FearlessState;
  heroById: Map<number, HeroRef>;
  /** Взятые в прошлых картах серии — суть fearless: до конца серии они недоступны. */
  locked: Set<number>;
  onPick: (id: number) => void;
  disabled: boolean;
  /** Пул только для чтения (лобби, ТЗ 22а): нажать нельзя, но и гасить нечего — в просмотре
   *  доступный герой обязан выглядеть доступным, иначе весь пул читается как «всё занято». */
  readOnly?: boolean;
}) {
  const groups = useMemo(() => {
    const byAttr = new Map<HeroRef["attr"], HeroRef[]>();
    for (const id of state.pool) {
      const h = heroById.get(id);
      if (!h) continue;
      const arr = byAttr.get(h.attr) ?? [];
      arr.push(h);
      byAttr.set(h.attr, arr);
    }
    return ATTR_ORDER.map((attr) => ({
      attr,
      heroes: (byAttr.get(attr) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    }));
  }, [state.pool, heroById]);

  // Выбывшие из серии. Отвечают на вопрос каждого хода — «этого героя ещё можно взять?»:
  // пул новой карты собирается уже БЕЗ взятых, поэтому в самой сетке их не видно вовсе, и
  // подпись «в серии» на плитке между картами не появляется никогда.
  // Состав берём из готового `locked` (второй раз не считаем), ходы сыгранных карт перебираем
  // только за цветом команды, которая героя взяла. Сверяем ИМЕННО пики: героя могли забанить на
  // одной карте и взять на другой — по одному `locked.has()` он попал бы в ряд дважды.
  const gone = useMemo(() => {
    const out: { hero: HeroRef; color: string }[] = [];
    for (const g of state.games)
      for (const m of g.moves) {
        const hero = m.action === "pick" && locked.has(m.heroId) ? heroById.get(m.heroId) : undefined;
        if (hero) out.push({ hero, color: state.teams[m.team].color });
      }
    return out;
  }, [state.games, state.teams, locked, heroById]);

  return (
    <Panel title="Пул карты" hint={`${state.pool.length} героев · по 9 случайных на атрибут, на каждой карте новый`}>
      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.attr}>
            <Eyebrow className="mb-1.5">{ATTR_LABEL[g.attr]}</Eyebrow>
            {/* Плитка 50px — минимум, на котором портрет ещё узнаётся; на 375px в ряд встают пять.
                От xl треков ровно столько, сколько героев в группе: auto-fill нарезал их по всей
                ширине и оставлял в каждом ряду пять пустых. */}
            <div
              className="grid grid-cols-[repeat(auto-fill,minmax(50px,1fr))] gap-1.5 xl:grid-cols-[repeat(var(--pool-cols),minmax(0,1fr))]"
              style={{ "--pool-cols": POOL_PER_ATTR } as React.CSSProperties}
            >
              {g.heroes.map((h) => {
                const available = isSelectable(state, h.id);
                const selectable = !readOnly && !disabled && available;
                // Цветным остаётся то, что В ПРИНЦИПЕ можно взять: «нажать нельзя» и «герой выбыл» —
                // разные факты, и в просмотре их нельзя рисовать одинаково.
                const bright = readOnly ? available : selectable;
                const isLocked = locked.has(h.id);
                return (
                  <button
                    key={h.id}
                    type="button"
                    disabled={!selectable}
                    onClick={() => onPick(h.id)}
                    title={isLocked ? `${h.name} — уже взят в серии` : h.name}
                    aria-label={h.name}
                    // 16:9 — родная пропорция портрета (256×144). В `h-8` при треке 85px на 1440
                    // кадр резался больше чем наполовину: места стало больше, а герой перестал
                    // узнаваться. На 390 трек ~55px, и 16:9 даёт те же 31px, что были.
                    className={`relative aspect-[16/9] overflow-hidden rounded-[10px] outline-none transition-[box-shadow,transform] ${
                      selectable
                        ? "cushion-row hover:-translate-y-0.5 hover:cushion-row-hover focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                        : readOnly
                          ? "cursor-default"
                          : "cursor-not-allowed"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={h.img}
                      alt=""
                      className={`h-full w-full object-cover transition ${bright ? "" : "opacity-30 grayscale"}`}
                    />
                    {isLocked && (
                      <span className="absolute inset-0 grid place-items-center bg-surface-2/70 text-[8px] font-black uppercase text-err-ink">
                        в серии
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Подвалом пула, а не отдельной панелью: это негатив самого пула — «чего здесь нет и
          больше не будет», и вопрос возникает ровно тогда, когда смотрят на пул. Без разбивки
          по картам: разбивку даёт клик по пилюле сыгранной карты, дважды на экране не нужна.
          На карте 1 выбывших нет — блока нет вовсе, ни счётчика «0», ни пустой лунки. */}
      {gone.length > 0 && (
        <>
          <Separator />
          <Eyebrow>Выбыло из серии · {gone.length}</Eyebrow>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {gone.map(({ hero, color }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={hero.id}
                src={hero.img}
                alt={hero.name}
                title={`${hero.name} — выбыл из серии`}
                className="h-6 w-[38px] rounded-[6px] object-cover"
                // Рамка цветом команды, которая героя взяла — сырой hex команды (§C5).
                style={{ boxShadow: `inset 0 0 0 2px ${color}` }}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
