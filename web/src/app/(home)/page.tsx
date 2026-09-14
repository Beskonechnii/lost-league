import type { Metadata } from "next";
import { currentTournament, getDivisions } from "@/lib/tournaments";
import { listSeries } from "@/lib/series";
import { getPlayerRecord } from "@/lib/player-record";
import { tpLeaderboard } from "@/lib/tp";
import { SITE_MAX_W } from "@/components/pouf/blocks";
import { currentAccountNav } from "@/app/_components/account-nav";
import { MiniProfile } from "./mini-profile";
import { TournamentsBlock } from "./tournaments-block";
import { MatchesBlock, isMatchCut } from "./matches-block";
import { HomeBanner } from "./banner";
import { PointsBlock, isPointsCut } from "./points";

// Входная дверь продукта — витрина, а не список разделов (Э21 RELEASE-PLAN §E).
//
// Раскладка по макету `design/home/Main.dc.html`. Верхний ряд (аннотация `n-top`): слева герой
// лиги, справа карточка игрока фиксированной ширины 351px, нижние края вровень. Ряд отвечает на
// два вопроса первым экраном — «что здесь происходит» и «а я тут кто». Ниже три смысловых блока,
// каждый на своей подложке (аннотация `n-slab`): турниры во всю ширину, под ними матчи и баллы
// в два столбца. Плитки «Разделы» с главной сняты: разделы стоят в верхней строке хрома.
//
// На телефоне (`Mobile.dc.html`, аннотация `n-mob`) порядок другой: карточка входа поднята НАД
// героем — первое, что нужно гостю, это дверь, а не афиша, — и турниры листаются вбок.
//
// Хром страницы — общий верхний бар продукта (`_components/app-shell.tsx`).
// Почему так решено — в комментарии там же и в UI-GUIDELINES §2.
//
// Блок осколков с витрины снят (ТЗ 06): своя валюта за участие — это разговор про профиль, а не
// про лигу. Сам блок и его атом остались в репозитории и работают в профиле игрока.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  description:
    "SPIRIT/CTRL — киберспортивные турниры по Dota 2 в Минске. Таблица дивизиона, составы команд и разбор любого матча Dota 2.",
};

const SITE = "https://leagueofspirits.ru/lost_s1";

export default async function Home({ searchParams }: { searchParams: Promise<{ m?: string; p?: string }> }) {
  const { m, p } = await searchParams;
  const nav = await currentAccountNav();
  const current = await currentTournament();
  const divisions = current ? await getDivisions(current.id) : [];

  // Составы, встречи и показатели вошедшего — один заход на всё, что показывает витрина.
  const playerId = nav.raw?.player?.id ?? null;
  const [series, record, standing] = await Promise.all([
    divisions.length > 0 ? listSeries({ divisionIds: divisions.map((d) => d.id) }) : Promise.resolve([]),
    // Винрейт за сезон — в карточку игрока; у гостя и у аккаунта без профиля спрашивать нечего.
    playerId ? getPlayerRecord(playerId, { divisionIds: divisions.map((d) => d.id) }) : Promise.resolve(null),
    playerId ? tpLeaderboard(current?.id ?? null, { limit: 0, playerId }) : Promise.resolve(null),
  ]);

  const short = new Map(divisions.map((d) => [d.id, d.short]));

  return (
    <main className={`mx-auto w-full ${SITE_MAX_W} flex-1 space-y-6 px-4 pb-8 pt-4 font-pouf md:px-6`}>
      {/* Верхний ряд макета: герой добирает остаток ширины, карточка игрока — ровно 351px.
          `items-stretch` держит нижние края вровень. На узком экране ряд разворачивается в
          колонку ОБРАТНЫМ порядком — карточка входа сверху, как в `Mobile.dc.html`. */}
      <div className="flex flex-col-reverse gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_351px] lg:items-stretch">
        {/* Что сделать прямо сейчас — одно предложение, выбранное по данным. */}
        <HomeBanner guest={!nav.raw} />
        {/* Кто здесь я: гостю — дверь, новичку — состояние заявки, игроку — его карточка. */}
        <MiniProfile account={nav.raw} nav={nav} record={record} place={standing?.me?.place ?? null} />
      </div>

      <TournamentsBlock />

      {/* Нижний ряд макета: матчи в узкой колонке, баллы на остаток, высоты плит равны
          (`items-stretch` по умолчанию у грида). Пропорция 5:4 — те же 400 к 340 из макета. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <MatchesBlock series={series} cut={isMatchCut(m) ? m : undefined} divisionShort={short} />
        <PointsBlock tournament={current} playerId={playerId} cut={isPointsCut(p) ? p : "tp"} />
      </div>

      <p className="text-sm font-bold text-muted">
        Основной сайт лиги и анонсы сезона —{" "}
        <a href={SITE} target="_blank" rel="noreferrer" className="text-[var(--accent-ink)] hover:underline">
          leagueofspirits.ru
        </a>
        .
      </p>
    </main>
  );
}
