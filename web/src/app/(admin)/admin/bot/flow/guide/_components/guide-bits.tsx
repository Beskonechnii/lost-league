import type { ReactNode } from "react";
import { Panel } from "@/app/(admin)/_components/panel";

/* Кирпичики гайда оператора (`/admin/bot/flow/guide`, Э8).
 *
 * Гайд — длинный текст с якорями, таблицами и списками, и верстать каждый абзац классами значило бы
 * получить пятнадцать разных абзацев к концу страницы. Здесь ровно те элементы, из которых он
 * собран: раздел с якорем, абзац, список, таблица, определение поля, пример.
 *
 * Своих цветов и рамок тут нет — всё из токенов Кита, как и в остальной админке (UI-GUIDELINES §7).
 */

/** Раздел гайда: панель с заголовком и якорем, на который ссылается оглавление сверху. */
export function GuideSection({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  /** Одна строка о том, про что раздел, — она же подпись под заголовком. */
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    // `scroll-mt` — чтобы после перехода по якорю заголовок не прилипал к верхнему краю окна.
    <section id={id} className="scroll-mt-6">
      <Panel title={title} hint={lead}>
        <div className="space-y-3">{children}</div>
      </Panel>
    </section>
  );
}

/** Абзац гайда. Мера строки ограничена: сплошной текст во всю витрину не читается. */
export const P = ({ children }: { children: ReactNode }) => (
  <p className="max-w-[86ch] text-sm font-bold leading-[1.65] text-ink">{children}</p>
);

/** Приглушённая приписка — оговорка, которую читают после абзаца, а не вместо него. */
export const Note = ({ children }: { children: ReactNode }) => (
  <p className="max-w-[86ch] text-xs font-bold leading-[1.6] text-muted">{children}</p>
);

/** Имя поля, ключ, подпись кнопки — всё, что в интерфейсе набрано буквально. */
export const C = ({ children }: { children: ReactNode }) => (
  <code className="rounded-control bg-surface-2 px-1 py-0.5 font-mono text-[12px] font-bold text-ink">{children}</code>
);

/** Маркированный список. */
export const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="max-w-[86ch] list-disc space-y-1.5 pl-5 text-sm font-bold leading-[1.6] text-ink marker:text-muted">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/** Нумерованный список — им написаны рецепты «сделай по шагам». */
export const Steps = ({ items }: { items: ReactNode[] }) => (
  <ol className="max-w-[86ch] list-decimal space-y-1.5 pl-5 text-sm font-bold leading-[1.6] text-ink marker:font-black marker:text-muted">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ol>
);

/**
 * Определение поля инспектора: имя слева, объяснение справа. Список, а не таблица: у объяснения
 * длина абзаца, и в ячейке таблицы оно рвалось бы по слогам.
 */
export function Fields({ items }: { items: { name: ReactNode; children: ReactNode }[] }) {
  return (
    <dl className="max-w-[86ch] space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="rounded-control bg-surface-2 p-2.5 cushion-field">
          <dt className="text-[13px] font-black text-ink">{item.name}</dt>
          <dd className="mt-1 text-xs font-bold leading-[1.6] text-muted">{item.children}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Таблица гайда. Скроллится внутри себя, а не тянет страницу вбок (UI-GUIDELINES §4): в таблице
 * валидатора три колонки текста, и на узком экране она шире витрины.
 */
export function GuideTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left">
        <thead>
          <tr>
            {head.map((cell) => (
              <th
                key={cell}
                className="border-b border-hairline pb-1.5 pr-3 text-[11px] font-black uppercase tracking-[0.4px] text-muted"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="align-top">
              {row.map((cell, j) => (
                <td key={j} className="border-b border-hairline py-2 pr-3 text-xs font-bold leading-[1.55] text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Пример из живого графа: где посмотреть глазами. Ссылка ведёт в редактор нужного флоу — id ноды
 * приходится искать в нём самому, адресовать ноду ссылкой редактор пока не умеет.
 */
export function Example({ flow = "main", node, children }: { flow?: string; node?: string; children: ReactNode }) {
  return (
    <div className="max-w-[86ch] rounded-control bg-surface-2 p-2.5 cushion-field">
      <p className="text-[11px] font-black uppercase tracking-[0.4px] text-muted">
        Как сейчас{node ? " · нода " : ""}
        {node && <code className="font-mono normal-case tracking-normal text-ink">{node}</code>}
        {" · флоу "}
        <code className="font-mono normal-case tracking-normal text-ink">{flow}</code>
      </p>
      <p className="mt-1 text-xs font-bold leading-[1.6] text-ink">{children}</p>
    </div>
  );
}
