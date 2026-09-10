// Разовый бэкфилл осколков: начислить вехи тем, кого одобрили ДО появления валюты (Э22).
//
// Запуск (из web/):  npx tsx scripts/backfill-shards.ts [--dry]
//
// Начисление живёт в событиях (апрув заявки, привязка Steam/телеграма, правка анкеты), поэтому у
// тех, кто прошёл модерацию раньше, событий уже не будет никогда — и витрина показывала бы им ноль
// при полностью заполненном профиле. Скрипт просто прогоняет по ним ту же `syncShards`, что зовёт
// приложение: своих правил у него нет и быть не должно.
//
// Идемпотентно: повторный запуск ничего не удваивает — вехи держит уникальный ключ в БД.

import { prisma } from "../src/lib/prisma";
import { syncShards } from "../src/lib/shards";

const dry = process.argv.slice(2).includes("--dry");

async function main() {
  const accounts = await prisma.userAccount.findMany({
    where: { status: "active" },
    select: { id: true, email: true, tgUsername: true, player: { select: { nickname: true } } },
    orderBy: { id: "asc" },
  });

  let touched = 0;
  for (const a of accounts) {
    const who = a.player?.nickname ?? a.email ?? a.tgUsername ?? `аккаунт #${a.id}`;
    if (dry) {
      const has = await prisma.shardEntry.count({ where: { accountId: a.id } });
      console.log(`${who}: начислений сейчас ${has}`);
      continue;
    }
    const added = await syncShards(a.id);
    if (added > 0) touched++;
    console.log(`${who}: ${added > 0 ? `+${added}` : "без изменений"}`);
  }
  console.log(dry ? "— пробный прогон, ничего не записано" : `Готово: начислено ${touched} аккаунтам из ${accounts.length}`);
}

main().finally(() => prisma.$disconnect());
