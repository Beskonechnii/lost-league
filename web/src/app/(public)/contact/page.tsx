import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/pouf/breadcrumbs";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { Eyebrow } from "@/components/pouf/text";
import { Alert } from "@/components/pouf/feedback";

export const metadata: Metadata = {
  title: "Связаться",
  description: "Куда писать в SPIRIT/CTRL: заявка команды на турнир, вопрос по профилю игрока, спорный результат встречи.",
  alternates: { canonical: "/contact" },
};

// Единственная страница из пяти заглушек, которая осталась (решение Стаса 16.09.2026, ТЗ 03):
// «О проекте», «Партнёрам», «Медиакит» и «Конфиденциальность» удалены вместе с адресами.
//
// Общего адреса — почты или канала — у лиги пока нет: заводить его решает не эта задача, и
// выдуманный контакт хуже отсутствующего. Поэтому страница не «пишите нам сюда», а разводка по
// делу: у каждого повода обратиться в лигу уже есть свой рабочий путь внутри сайта, и он же
// быстрее — заявка в очереди модерации видна оператору, письмо в общий ящик нет.
//
// Текст описывает то, как система работает сегодня. Появится публичный контакт — он встанет
// строкой сюда, а не отдельной страницей.

const WAYS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Заявить команду на турнир",
    body: (
      <>
        Заявки принимает сам турнир, пока открыт приём: страница{" "}
        <Link href="/tournaments" className="font-black text-ink underline underline-offset-2">
          турнира
        </Link>{" "}
        → «Заявка». Капитан заполняет состав, заявка уходит в очередь к организатору, ответ приходит
        в кабинет. Вне приёма заявок форма закрыта — ждите следующий сезон.
      </>
    ),
  },
  {
    title: "Вступить как игрок",
    body: (
      <>
        Регистрация и анкета — в{" "}
        <Link href="/me" className="font-black text-ink underline underline-offset-2">
          кабинете
        </Link>
        . Анкету смотрит организатор; отказ не окончателен — он приходит с причиной, анкету можно
        поправить и отправить снова. Условия — в{" "}
        <Link href="/rules" className="font-black text-ink underline underline-offset-2">
          правилах лиги
        </Link>
        .
      </>
    ),
  },
  {
    title: "Ошибка в профиле или в результате встречи",
    body: (
      <>
        Ник, команду и позицию правит организатор — напишите ему в{" "}
        <Link href="/chat" className="font-black text-ink underline underline-offset-2">
          сообщениях
        </Link>{" "}
        (нужен вход) и приложите ссылку на страницу, где видно ошибку. Счёт встречи считается по
        картам из OpenDota: если карта привязана не к той встрече, это тоже сюда.
      </>
    ),
  },
  {
    title: "Партнёрство и права на трансляцию",
    body: (
      <>
        Лига сама кастует свои турниры и работает из Минска. Предложение о сотрудничестве —
        организатору лично: публичного адреса для таких писем у лиги пока нет.
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <main className="flex-1 px-4 py-10 font-pouf md:py-16">
      <div className={`mx-auto w-full ${FORM_MAX_W}`}>
        <Breadcrumbs items={[{ href: "/", label: "Главная" }]} />

        <Eyebrow className="mt-5">Лига</Eyebrow>
        <h1 className="mt-2 text-[28px] font-black leading-[1.2] tracking-[-0.5px] text-ink md:text-4xl">
          Связаться
        </h1>
        <p className="mt-3 text-[15px] font-semibold leading-[1.6] text-muted">
          Общего ящика у SPIRIT/CTRL нет — и это не забывчивость: у каждого повода написать в лигу
          есть свой путь, и он короче письма. Найдите свой ниже.
        </p>

        <div className="mt-8 space-y-4">
          {WAYS.map((way) => (
            <section key={way.title} className="rounded-card bg-surface p-5 cushion-card sm:p-6">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[2px] text-[var(--accent-ink)]">
                {way.title}
              </h2>
              <p className="mt-3 text-[15px] font-semibold leading-[1.6] text-muted">{way.body}</p>
            </section>
          ))}
        </div>

        <Alert tone="info" block className="mt-8">
          Писем лига не шлёт — ни подтверждений, ни рассылок. Письмо «от SPIRIT/CTRL» со ссылкой
          «подтвердите адрес» пришло не от нас.
        </Alert>
      </div>
    </main>
  );
}
