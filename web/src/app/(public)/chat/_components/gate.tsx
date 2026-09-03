import Link from "next/link";
import { buttonClasses } from "@/components/pouf/Button";
import { SectionHeader } from "@/components/pouf/blocks";

// Один ответ на все случаи «чат вам не открыт»: не вошёл, вошёл но заявка не одобрена, одобрен но
// профиль не привязан. Разделять их отдельными экранами незачем — дверь во всех случаях одна.
export function ChatGate() {
  return (
    <div className="space-y-6 font-pouf">
      <SectionHeader eyebrow="Лига · переписка" title="Сообщения" aside={<>Личные диалоги игроков лиги</>} />
      <div className="rounded-control bg-surface p-6 cushion-row">
        <p className="max-w-prose text-sm font-bold text-muted">
          Переписка открыта игрокам лиги: нужно войти и получить одобрение заявки — тогда у вас
          появится карточка в ростере, а вместе с ней и возможность писать другим.
        </p>
        <Link href="/me" className={`mt-4 inline-flex ${buttonClasses()}`}>
          В кабинет
        </Link>
      </div>
    </div>
  );
}
