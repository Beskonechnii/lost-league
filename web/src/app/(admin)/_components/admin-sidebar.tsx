"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import type { ToolGroup } from "./tools";
import { QUEUE_TOOL } from "./tools";
import { Icon } from "@/components/pouf/Icon";
import { TOUCH_TARGET, useScrollActiveIntoView } from "@/app/_components/nav-scroll";

// Постоянный список инструментов операторской. Пришёл на смену связке «плитки + кнопка Назад»:
// у оператора не просмотр, а работа с полутора десятками инструментов, и переход между двумя из них
// шёл через хаб — то есть через экран, на котором нет работы (UI-GUIDELINES §5).
//
// Вид — по канону «Сайдбар» из скилла `kit`: колонка не приклеена к краю экрана, а лежит
// отдельной подушкой; секции подписаны, активный пункт залит акцентом, у очереди свой счётчик.
// Свёрнутое состояние из того же макета: рельс в одну иконку, подпись всплывает по наведению.
//
// Ниже lg колонка не влезает и превращается в один горизонтально прокручиваемый ряд пилюль —
// тот же список, та же подсветка, без отдельного меню и без состояния, которое пришлось бы
// синхронизировать. Мобильного вида в макете нет, поэтому ряд собран из пилюль Кита.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/* Ширина колонки — привычка работы, а не свойство адреса, поэтому она живёт у человека
 * в localStorage. Читаем её через `useSyncExternalStore`: localStorage — внешнее хранилище,
 * и подписка на него отдаёт серверу заведомо развёрнутый вид, а клиенту — сохранённый,
 * без расхождения при гидрации и без setState в эффекте. */
const COLLAPSED_KEY = "lost:admin-sidebar-collapsed";

const listeners = new Set<() => void>();

const collapsedStore = {
  subscribe(onChange: () => void) {
    listeners.add(onChange);
    // Вторая вкладка операторской не должна расходиться с первой.
    window.addEventListener("storage", onChange);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onChange);
    };
  },
  get: () => window.localStorage.getItem(COLLAPSED_KEY) === "1",
  /** На сервере ширины не знаем — рисуем развёрнутую: она полнее и не прячет пункты. */
  getServer: () => false,
  set(next: boolean) {
    window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    listeners.forEach((l) => l());
  },
};

/** Активен инструмент, если путь совпал или лежит внутри него (у студии и архива есть вложенные страницы). */
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function AdminSidebar({ groups, pending }: { groups: ToolGroup[]; pending: number }) {
  const pathname = usePathname();
  // В мобильном ряду активный инструмент так же легко оказывается за краем, как вкладка турнира.
  const activeRef = useScrollActiveIntoView<HTMLAnchorElement>();

  const collapsed = useSyncExternalStore(collapsedStore.subscribe, collapsedStore.get, collapsedStore.getServer);
  const toggle = () => collapsedStore.set(!collapsed);

  const badgeOf = (href: string) => (href === QUEUE_TOOL && pending > 0 ? pending : 0);

  return (
    // Прокручивается сама подушка (ниже), а не эта обёртка: список инструментов длиннее экрана,
    // но прокручиваемый контейнер срезает внешнюю тень, и колонка упиралась бы в контент
    // страницы обрезанным краем. Отступ вокруг — место, куда эта тень ложится.
    <aside
      className={`font-pouf lg:sticky lg:top-[57px] lg:h-[calc(100dvh-57px)] lg:shrink-0 lg:p-4 ${
        collapsed ? "lg:w-[108px]" : "lg:w-[332px]"
      }`}
    >
      {/* ── Мобильный ряд пилюль: до lg колонка не помещается ───────────────────────────── */}
      <nav className="flex gap-2 overflow-x-auto border-b border-hairline px-4 py-2 lg:hidden">
        {groups.flatMap((g) =>
          g.tools.map((t) => {
            const active = isActive(pathname, t.href);
            return (
              <Link
                key={t.href}
                ref={active ? activeRef : undefined}
                href={t.href}
                title={t.desc}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-control-sm px-3 py-[9px] text-[13px] font-black ${TOUCH_TARGET} ${focus} ${
                  active ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "bg-surface text-ink-muted cushion-row"
                }`}
              >
                <Icon name={t.icon} size="sm" />
                <span className="truncate">{t.label}</span>
                {!!badgeOf(t.href) && <Badge count={badgeOf(t.href)} active={active} />}
              </Link>
            );
          }),
        )}
      </nav>

      {/* ── Колонка. Полоса прокрутки спрятана намеренно: она съедает 15 из 76 пикселей
              свёрнутого рельса, и иконки перестают в него влезать. Колонка прокручивается
              колесом и клавишами. ──────────────────────────────────────────────────────── */}
      <nav
        className={`hidden flex-col bg-surface cushion-card lg:flex lg:h-full lg:overflow-y-auto lg:[scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          collapsed ? "items-center gap-[5px] rounded-[30px] px-[11px] py-3" : "rounded-[34px] px-[13px] pb-3.5 pt-2.5"
        }`}
      >
        {/* Шапка колонки. Бренда здесь нет — он в верхней строке сайта; в шапке живёт только
            переключатель ширины, ради которого макет её и рисует. */}
        <div className={collapsed ? "" : "flex items-center justify-between gap-2 px-2 pb-1 pt-2"}>
          {!collapsed && (
            <span className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-ink-subtle">Операторская</span>
          )}
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? "Развернуть" : "Свернуть"}
            aria-label={collapsed ? "Развернуть список инструментов" : "Свернуть список инструментов"}
            className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px] bg-surface text-ink-subtle cushion-row transition hover:text-ink ${focus}`}
          >
            <Icon name={collapsed ? "next" : "prev"} size="sm" />
          </button>
        </div>

        {groups.map((g, gi) => (
          <div key={g.title} className={collapsed ? "flex flex-col items-center gap-[5px]" : "flex flex-col"}>
            {collapsed ? (
              // Подпись секции в рельс не влезает — её роль берёт разделитель между группами.
              gi > 0 && <span className="my-[7px] h-px w-[38px] bg-hairline" aria-hidden />
            ) : (
              <h2 className="px-3 pb-2 pt-[15px] text-[11px] font-extrabold uppercase tracking-[1.6px] text-ink-subtle">
                {g.title}
              </h2>
            )}

            {g.tools.map((t) => {
              const active = isActive(pathname, t.href);
              const count = badgeOf(t.href);

              if (collapsed) {
                return (
                  <span key={t.href} className="group relative flex items-center justify-center">
                    <Link
                      href={t.href}
                      aria-current={active ? "page" : undefined}
                      aria-label={t.label}
                      className={`grid h-[52px] w-[52px] place-items-center rounded-control-sm transition-[box-shadow,background,color] ${focus} ${
                        active ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "text-muted hover:bg-surface hover:text-ink hover:cushion-row"
                      }`}
                    >
                      <Icon name={t.icon} size="md" />
                    </Link>
                    {/* Счётчик поверх иконки: подписи нет, и иначе очередь в рельсе не видна. */}
                    {!!count && (
                      <span className="pointer-events-none absolute right-1 top-1 grid h-[19px] min-w-[19px] place-items-center rounded-pill bg-[var(--down)] px-[5px] text-[10px] font-black text-[var(--color-err-ink)] [box-shadow:0_0_0_2px_var(--surface)]">
                        {count}
                      </span>
                    )}
                    {/* Подпись всплывает вправо — единственный способ прочитать пункт в рельсе.
                        `fixed` без смещений, а не `absolute`: колонка прокручивается, а
                        прокручиваемый предок срезал бы всё, что вылезает за его край. Позиция
                        у такого блока остаётся статической — там же, где была бы в потоке,
                        — но обрезка к нему уже не применяется. */}
                    <span className="pointer-events-none fixed z-30 ml-[60px] mt-[1px] hidden items-center gap-2 whitespace-nowrap rounded-[13px] bg-[var(--inverse-surface)] px-3.5 py-2.5 text-[13px] font-extrabold text-[var(--inverse-ink)] shadow-lg group-hover:flex">
                      {t.label}
                      {!!count && (
                        <b className="rounded-pill bg-[var(--down)] px-2 py-px text-[11px] font-black text-[var(--color-err-ink)]">
                          {count}
                        </b>
                      )}
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  key={t.href}
                  href={t.href}
                  title={t.desc}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-chip px-3.5 py-[11px] text-[14.5px] font-extrabold transition-[box-shadow,background,color] ${focus} ${
                    active
                      ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
                      : "text-ink hover:bg-surface hover:cushion-row"
                  }`}
                >
                  <span className={active ? "" : "text-muted"}>
                    <Icon name={t.icon} size="sm" />
                  </span>
                  <span className="truncate">{t.label}</span>
                  {t.soon && <span className="ml-auto text-[10px] font-bold text-ink-subtle">скоро</span>}
                  {/* Очередь модерации: её легко пропустить, если о ней ничего не напоминает */}
                  {!!count && <Badge count={count} active={active} />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Счётчик у пункта. Тёплая подушка, а не заливка тоном: пункт под ней бывает и бумажный,
 * и залитый акцентом, и на акценте красная плашка читалась бы как ошибка самого пункта.
 */
function Badge({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={`ml-auto grid h-[23px] min-w-[23px] place-items-center rounded-pill px-[7px] text-[11px] font-black tabular-nums ${
        active
          ? "bg-white/70 text-[var(--on-accent)]"
          : "bg-surface text-[var(--color-err-ink)] cushion-row"
      }`}
    >
      {count}
    </span>
  );
}
