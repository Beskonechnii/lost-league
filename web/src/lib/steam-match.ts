// Второй источник матча — Steam Web API (GetMatchDetails), первоисточник самой Valve.
// Нужен, когда OpenDota лежит: их 522 роняли отчёт целиком (см. DECISIONS.md).
// Ключ бесплатный (steamcommunity.com/dev/apikey), живёт в web/.env как STEAM_API_KEY.
//
// Формат ответа Valve — это то, из чего OpenDota делает свой: поля игроков и матча совпадают,
// поэтому мы приводим ответ к RawMatch и отдаём в общую сборку buildMatchReport.
//
// Чего у Valve НЕТ (и что в отчёте останется пустым):
//   • график преимущества по золоту/опыту  • тайминги покупок (purchase_log)
//   • лог событий (первая кровь, рошан, курьеры, аегис)  • перманентные баффы (Аганим/шард — только по предметам)
//   • ники игроков (Valve отдаёт только account_id)  • линии (lane_role) — позиции считаются по фарму

import { buildMatchReport, type MatchReport, type RawMatch } from "./opendota";

const API = "https://api.steampowered.com/IDOTA2Match_570/GetMatchDetails/v1/";

type SteamPlayer = {
  account_id?: number;
  player_slot: number;
  hero_id: number;
  item_0?: number;
  item_1?: number;
  item_2?: number;
  item_3?: number;
  item_4?: number;
  item_5?: number;
  backpack_0?: number;
  backpack_1?: number;
  backpack_2?: number;
  item_neutral?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  last_hits?: number;
  denies?: number;
  gold_per_min?: number;
  xp_per_min?: number;
  level?: number;
  net_worth?: number;
  hero_damage?: number;
  tower_damage?: number;
  hero_healing?: number;
  ability_upgrades?: { ability: number; time: number; level: number }[];
};
type SteamMatch = {
  match_id?: number;
  radiant_win?: boolean;
  duration?: number;
  start_time?: number;
  radiant_score?: number;
  dire_score?: number;
  tower_status_radiant?: number;
  tower_status_dire?: number;
  barracks_status_radiant?: number;
  barracks_status_dire?: number;
  radiant_name?: string;
  dire_name?: string;
  picks_bans?: { is_pick: boolean; hero_id: number; team: number; order: number }[];
  players?: SteamPlayer[];
};
type SteamResponse = { result?: SteamMatch & { error?: string; status?: number; statusDetail?: string } };

// account_id у Valve — steam32 (0/анонимный профиль отдаётся нулём).
const accountId = (id?: number) => (id ? id : null);

function toRawMatch(r: SteamMatch): RawMatch {
  return {
    match_id: r.match_id ?? 0,
    // version — признак «матч распарсен». У Valve парсинга реплея нет по определению,
    // поэтому null: UI покажет обычное предупреждение о неполных данных.
    version: null,
    radiant_win: r.radiant_win,
    duration: r.duration,
    start_time: r.start_time,
    radiant_score: r.radiant_score,
    dire_score: r.dire_score,
    tower_status_radiant: r.tower_status_radiant,
    tower_status_dire: r.tower_status_dire,
    barracks_status_radiant: r.barracks_status_radiant,
    barracks_status_dire: r.barracks_status_dire,
    // Названия команд лиги Valve отдаёт строкой, без тега и лого.
    radiant_team: r.radiant_name ? { name: r.radiant_name } : null,
    dire_team: r.dire_name ? { name: r.dire_name } : null,
    picks_bans: r.picks_bans,
    players: (r.players ?? []).map((p) => ({
      // Сторона у Valve закодирована в слоте (<128 — свет), готового isRadiant нет.
      isRadiant: p.player_slot < 128,
      player_slot: p.player_slot,
      account_id: accountId(p.account_id),
      // Ников Valve не даёт вовсе — сборка подставит «Аноним», команда узнаётся по account_id.
      name: null,
      personaname: null,
      hero_id: p.hero_id,
      level: p.level,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      last_hits: p.last_hits,
      denies: p.denies,
      gold_per_min: p.gold_per_min,
      xp_per_min: p.xp_per_min,
      net_worth: p.net_worth,
      hero_damage: p.hero_damage,
      tower_damage: p.tower_damage,
      hero_healing: p.hero_healing,
      item_0: p.item_0,
      item_1: p.item_1,
      item_2: p.item_2,
      item_3: p.item_3,
      item_4: p.item_4,
      item_5: p.item_5,
      backpack_0: p.backpack_0,
      backpack_1: p.backpack_1,
      backpack_2: p.backpack_2,
      item_neutral: p.item_neutral,
      // ability_upgrades у Valve — объекты с таймингом; сборке нужен плоский порядок id.
      ability_upgrades_arr: (p.ability_upgrades ?? []).map((a) => a.ability),
      lane_role: null,
      purchase_log: null,
      permanent_buffs: null,
    })),
  };
}

export async function fetchSteamMatchReport(matchId: string): Promise<MatchReport> {
  const key = process.env.STEAM_API_KEY;
  if (!key) {
    throw new Error("Нет STEAM_API_KEY в web/.env — ключ берётся на steamcommunity.com/dev/apikey.");
  }

  const url = `${API}?key=${encodeURIComponent(key)}&match_id=${encodeURIComponent(matchId)}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error("Не достучались до Steam — сеть или таймаут.");
  }
  if (res.status === 403) throw new Error("Steam отклонил ключ (403). Проверь STEAM_API_KEY.");
  if (!res.ok) throw new Error(`Steam ответил ${res.status}.`);

  const json = (await res.json()) as SteamResponse;
  const r = json.result;
  // Матч не найден или реплей ещё не разъехался — Valve отдаёт 200 с полем error внутри.
  if (!r || r.error) throw new Error(`Steam не отдал матч: ${r?.error ?? "пустой ответ"}`);
  if (!r.players?.length) throw new Error(`Матч ${matchId} у Steam без данных об игроках.`);

  return buildMatchReport(matchId, toRawMatch(r));
}
