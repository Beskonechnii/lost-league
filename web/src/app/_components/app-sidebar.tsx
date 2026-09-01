"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/pouf/Icon";
import { Sheet } from "@/components/pouf/sheet";
import { logout } from "@/app/(public)/me/actions";
import { LeagueSearch } from "./league-search";
import type { NavAccount, NavItem, NavSection } from "./nav-model";

// Единственная навигация продукта — одна колонка на все страницы, публичные и служебные
// (DECISIONS, 02.09). До неё хром был двухэтажным: верхняя строка сайта на всех маршрутах плюс
// сайдбар инструментов в операторской. Сойтись они не могли: у макета Кита «Сайдбар» бренд,
// профиль и поиск живут в колонке, и вместе с верхней строкой на экране оказывались два бренда
// и два входа в кабинет.
//
// Вид — по канону «Сайдбар» из скилла `kit`: колонка лежит отдельной подушкой, секции подписаны,
// активный пункт залит акцентом, у очереди свой счётчик. Три состояния:
//   lg+          полная колонка (300px) либо рельс, если человек её свернул;
//   до lg        рельс постоянно, а подписи открываются в Sheet по кнопке-бренду.
// «Шапки с кнопкой меню» на мобильном нет намеренно: горизонтальная строка — тот самый хром,
// который этим этапом и убирается.

const focus = "outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]";

/* Ширина колонки — привычка работы, а не свойство адреса, поэтому она живёт у человека
 * в localStorage. Читаем её через `useSyncExternalStore`: localStorage — внешнее хранилище,
 * и подписка на него отдаёт серверу заведомо развёрнутый вид, а клиенту — сохранённый,
 * без расхождения при гидрации и без setState в эффекте. */
const COLLAPSED_KEY = "lost:sidebar-collapsed";

const listeners = new Set<() => void>();

const collapsedStore = {
  subscribe(onChange: () => void) {
    listeners.add(onChange);
    // Вторая вкладка не должна расходиться с первой.
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

/** Активен пункт, если путь совпал, лежит внутри него или подошёл под один из его префиксов. */
function isActive(pathname: string, item: NavItem) {
  const hrefs = [item.href, ...(item.match ?? [])];
  return hrefs.some((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`)));
}

/**
 * Активен ровно один пункт — самый конкретный из подошедших. Без этого на `/roster/teams/7`
 * загорались бы и «Ростер», и всё, что объявило `/roster` своим префиксом.
 */
function useActiveHref(sections: NavSection[]) {
  const pathname = usePathname();
  let best = "";
  let bestLen = 0;
  for (const s of sections)
    for (const item of s.items) {
      if (!isActive(pathname, item)) continue;
      const len = Math.max(...[item.href, ...(item.match ?? [])].map((h) => (pathname.startsWith(h) ? h.length : 0)));
      if (len > bestLen) {
        bestLen = len;
        best = item.href;
      }
    }
  return best;
}

export type SidebarProps = {
  sections: NavSection[];
  /** Низ колонки: правила лиги и выход. Прижат к дну, отделён линией — как в макете. */
  footer: NavItem[];
  account: NavAccount | null;
};

export function AppSidebar(props: SidebarProps) {
  const collapsed = useSyncExternalStore(collapsedStore.subscribe, collapsedStore.get, collapsedStore.getServer);

  return (
    <>
      {/* ── Десктоп: колонка или рельс, по выбору человека ─────────────────────────── */}
      <aside
        className={`hidden font-pouf lg:sticky lg:top-0 lg:block lg:h-dvh lg:shrink-0 lg:p-4 ${
          collapsed ? "lg:w-[108px]" : "lg:w-[332px]"
        }`}
      >
        {collapsed ? (
          <Rail {...props} onToggle={() => collapsedStore.set(false)} />
        ) : (
          <Column {...props} onToggle={() => collapsedStore.set(true)} />
        )}
      </aside>

      {/* ── До lg: рельс всегда, подписи — в Sheet по кнопке-бренду ────────────────── */}
      {/* Отступ вокруг рельса на телефоне минимальный: каждый пиксель колонки — пиксель,
          отнятый у таблицы. Тач-цель при этом остаётся 44px, как требует §6 стандарта. */}
      <aside className="sticky top-0 h-dvh shrink-0 p-1 font-pouf lg:hidden">
        <MobileRail {...props} />
      </aside>
    </>
  );
}

/** Обёртка прокручиваемой подушки: тень колонки рисует она, а прокрутку — её же контейнер. */
const shell = (extra: string) =>
  `flex h-full flex-col bg-surface cushion-card overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${extra}`;

/* ─────────────────────────── полная колонка ─────────────────────────── */

function Column({
  sections,
  footer,
  account,
  onToggle,
  onNavigate,
  inSheet = false,
}: SidebarProps & { onToggle?: () => void; onNavigate?: () => void; inSheet?: boolean }) {
  const active = useActiveHref(sections);

  return (
    <nav className={inSheet ? "flex flex-col" : shell("rounded-[34px] px-[13px] pb-3.5 pt-2.5")}>
      {!inSheet && (
        <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-2">
          <Brand />
          <button
            type="button"
            onClick={onToggle}
            title="Свернуть"
            aria-label="Свернуть колонку до значков"
            className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[12px] bg-surface text-ink-subtle cushion-row transition hover:text-ink ${focus}`}
          >
            <Icon name="prev" size="sm" />
          </button>
        </div>
      )}

      <ProfileBlock account={account} onNavigate={onNavigate} />
      <LeagueSearch onNavigate={onNavigate} />

      {sections.map((s) => (
        <div key={s.title} className="flex flex-col">
          <h2 className="px-3 pb-2 pt-[15px] text-[11px] font-extrabold uppercase tracking-[1.6px] text-ink-subtle">
            {s.title}
          </h2>
          {s.items.map((item) => (
            <Row key={item.href} item={item} active={item.href === active} onNavigate={onNavigate} />
          ))}
        </div>
      ))}

      <div className="mt-2.5 flex flex-col border-t border-hairline pt-2">
        {footer.map((item) => (
          <Row key={item.href} item={item} active={item.href === active} onNavigate={onNavigate} />
        ))}
        {account && <LogoutRow />}
      </div>
    </nav>
  );
}

/** Строка пункта: значок, подпись, при необходимости счётчик или пометка «скоро». */
function Row({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      title={item.hint}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-chip px-3.5 py-[11px] text-[14.5px] font-extrabold transition-[box-shadow,background,color] ${focus} ${
        active ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "text-ink hover:bg-surface hover:cushion-row"
      }`}
    >
      <span className={active ? "" : "text-muted"}>
        <Icon name={item.icon} size="sm" />
      </span>
      <span className="truncate">{item.label}</span>
      {item.soon && <span className="ml-auto text-[10px] font-bold text-ink-subtle">скоро</span>}
      {/* Очередь модерации: её легко пропустить, если о ней ничего не напоминает */}
      {!!item.badge && <Badge count={item.badge} active={active} />}
    </Link>
  );
}

/** Выход — не ссылка, а действие: куку рвёт сервер, поэтому это форма с server action. */
function LogoutRow() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className={`flex w-full items-center gap-3 rounded-chip px-3.5 py-[11px] text-left text-[14.5px] font-extrabold text-[var(--color-err-ink)] transition-[box-shadow,background] hover:bg-surface hover:cushion-row ${focus}`}
      >
        <Icon name="logout" size="sm" />
        <span>Выйти</span>
      </button>
    </form>
  );
}

/* ─────────────────────────── рельс ─────────────────────────── */

function Rail({ sections, footer, account, onToggle }: SidebarProps & { onToggle: () => void }) {
  const active = useActiveHref(sections);
  const groups = [...sections.map((s) => s.items), footer];

  return (
    <nav className={shell("items-center gap-[5px] rounded-[30px] px-[11px] py-3")}>
      <div className="flex flex-col items-center gap-2 pt-1">
        <Link href="/" aria-label="LOST — на главную" className={`rounded-control-sm ${focus}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-9 w-auto" />
        </Link>
        <button
          type="button"
          onClick={onToggle}
          title="Развернуть"
          aria-label="Развернуть колонку"
          className={`grid h-[34px] w-[34px] place-items-center rounded-[12px] bg-surface text-ink-subtle cushion-row transition hover:text-ink ${focus}`}
        >
          <Icon name="next" size="sm" />
        </button>
      </div>

      {account && (
        <Link href="/me" aria-label="Личный кабинет" className={`my-1.5 rounded-pill ${focus}`}>
          <Avatar account={account} size={48} />
        </Link>
      )}

      {groups.map((items, gi) => (
        <div key={gi} className="flex flex-col items-center gap-[5px]">
          {/* Подпись секции в рельс не влезает — её роль берёт разделитель между группами. */}
          {gi > 0 && <span className="my-[7px] h-px w-[38px] bg-hairline" aria-hidden />}
          {items.map((item) => (
            <RailButton key={item.href} item={item} active={item.href === active} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function RailButton({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <span className="group relative flex items-center justify-center">
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={`grid h-[52px] w-[52px] place-items-center rounded-control-sm transition-[box-shadow,background,color] ${focus} ${
          active
            ? "bg-accent-fill text-[var(--on-accent)] cushion-blob"
            : "text-muted hover:bg-surface hover:text-ink hover:cushion-row"
        }`}
      >
        <Icon name={item.icon} size="md" />
      </Link>
      {/* Счётчик поверх значка: подписи нет, и иначе очередь в рельсе не видна. */}
      {!!item.badge && (
        <span className="pointer-events-none absolute right-1 top-1 grid h-[19px] min-w-[19px] place-items-center rounded-pill bg-[var(--down)] px-[5px] text-[10px] font-black text-[var(--color-err-ink)] [box-shadow:0_0_0_2px_var(--surface)]">
          {item.badge}
        </span>
      )}
      {/* Подпись всплывает вправо — единственный способ прочитать пункт в рельсе.
          `fixed` без смещений, а не `absolute`: колонка прокручивается, а прокручиваемый
          предок срезал бы всё, что вылезает за его край. Позиция у такого блока остаётся
          статической — там же, где была бы в потоке, — но обрезка к нему уже не применяется. */}
      <span className="pointer-events-none fixed z-30 ml-[60px] mt-[1px] hidden items-center gap-2 whitespace-nowrap rounded-[13px] bg-[var(--inverse-surface)] px-3.5 py-2.5 text-[13px] font-extrabold text-[var(--inverse-ink)] shadow-lg group-hover:flex">
        {item.label}
        {!!item.badge && (
          <b className="rounded-pill bg-[var(--down)] px-2 py-px text-[11px] font-black text-[var(--color-err-ink)]">
            {item.badge}
          </b>
        )}
      </span>
    </span>
  );
}

/* ─────────────────────────── мобильный рельс + Sheet ─────────────────────────── */

function MobileRail(props: SidebarProps) {
  // Панель закрывают сами пункты (`onNavigate` ниже): Sheet живёт вне маршрута и о навигации
  // не узнаёт, а следить за путём эффектом ради этого — лишний каскад рендеров.
  const [open, setOpen] = useState(false);
  const active = useActiveHref(props.sections);
  const groups = [...props.sections.map((s) => s.items), props.footer];

  return (
    <nav className={shell("items-center gap-1 rounded-[26px] px-1 py-2")}>
      {/* Бренд на мобильном — кнопка: пальцем по значку без подписи не угадать, а всплывающих
          подсказок на тач-экране нет. Отсюда и Sheet: тот же список, но с подписями. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Открыть навигацию"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-control-sm bg-surface cushion-row ${focus}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-7 w-auto" />
      </button>

      {props.account && (
        <Link href="/me" aria-label="Личный кабинет" className={`my-1 rounded-pill ${focus}`}>
          <Avatar account={props.account} size={40} />
        </Link>
      )}

      {groups.map((items, gi) => (
        <div key={gi} className="flex flex-col items-center gap-1">
          {gi > 0 && <span className="my-1.5 h-px w-7 bg-hairline" aria-hidden />}
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={item.href === active ? "page" : undefined}
              className={`relative grid h-11 w-11 place-items-center rounded-control-sm ${focus} ${
                item.href === active ? "bg-accent-fill text-[var(--on-accent)] cushion-blob" : "text-muted"
              }`}
            >
              <Icon name={item.icon} size="sm" />
              {!!item.badge && (
                <span className="absolute right-0.5 top-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-pill bg-[var(--down)] px-1 text-[10px] font-black text-[var(--color-err-ink)]">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      ))}

      <Sheet open={open} onOpenChange={setOpen} title="Навигация" description="Разделы лиги, инструменты и кабинет">
        <Column {...props} inSheet onNavigate={() => setOpen(false)} />
      </Sheet>
    </nav>
  );
}

/* ─────────────────────────── шапка колонки ─────────────────────────── */

/**
 * Бренд-блок. Картинками, а не текстом и блобом: у знака свой градиент, а у вордмарка — своя
 * гарнитура, и ни то, ни другое интерфейсными токенами не собрать. Вордмарк рисуется маской:
 * в svg зашит светлый #E3E7FF, на бумаге Кита его просто не видно, а через mask цвет берётся
 * из --ink. Ширина задана явно: у маски нет собственных размеров (viewBox 1467×180).
 */
function Brand() {
  return (
    <Link href="/" className={`flex min-w-0 shrink items-center gap-2.5 rounded-control ${focus}`} title="LOST — на главную">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/brand/mark.svg" alt="" aria-hidden className="h-8 w-auto" />
      <span
        role="img"
        aria-label="SPIRIT/CTRL"
        className="h-[15px] w-[122px] shrink-0 bg-ink [mask:url(/assets/brand/wordmark.svg)_center/contain_no-repeat]"
      />
    </Link>
  );
}

/** Профиль-блок — вход в кабинет. Гостю на его месте приглашение войти: дверь одна и та же. */
function ProfileBlock({ account, onNavigate }: { account: NavAccount | null; onNavigate?: () => void }) {
  return (
    <Link
      href="/me"
      onClick={onNavigate}
      className={`mx-0.5 my-2 flex items-center gap-3 rounded-blob bg-surface px-3 py-[11px] cushion-row transition hover:cushion-row-hover ${focus}`}
    >
      {account ? (
        <Avatar account={account} size={44} />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-accent-fill text-[var(--on-accent)]">
          <Icon name="user" size="sm" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-black leading-tight">{account?.name ?? "Войти"}</span>
        <span className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] font-extrabold text-ink-muted">
          {account && <span className="h-2 w-2 shrink-0 rounded-pill" style={{ background: account.dot }} aria-hidden />}
          {account?.role ?? "Кабинет и заявка в лигу"}
        </span>
      </span>
      <span className="shrink-0 text-ink-subtle">
        <Icon name="next" size="sm" />
      </span>
    </Link>
  );
}

function Avatar({ account, size }: { account: NavAccount; size: number }) {
  const style = { width: size, height: size, fontSize: Math.round(size / 2.9) };
  return account.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={account.photo}
      alt=""
      aria-hidden
      style={style}
      className="shrink-0 rounded-pill object-cover cushion-row"
    />
  ) : (
    <span
      style={style}
      aria-hidden
      className="grid shrink-0 place-items-center rounded-pill bg-accent-fill font-black text-[var(--on-accent)] cushion-blob"
    >
      {account.initials}
    </span>
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
        active ? "bg-white/70 text-[var(--on-accent)]" : "bg-surface text-[var(--color-err-ink)] cushion-row"
      }`}
    >
      {count}
    </span>
  );
}
