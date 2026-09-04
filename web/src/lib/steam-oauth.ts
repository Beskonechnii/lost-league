// Только сервер: вход через Steam. У Steam нет OAuth2 для входа — только классический OpenID 2.0
// (checkid_setup → провайдер сам сверяет подпись по нашему запросу check_authentication, без кода
// и client_secret). Профиль (ник, аватар) отдельным вызовом ISteamUser/GetPlayerSummaries — тем же
// STEAM_API_KEY, что уже держит src/lib/steam-match.ts для архива матчей.

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/** Настроен ли вход через Steam. Без ключа профиль (ник/аватар) не подтянуть, поэтому кнопка
 *  скрыта — как и Google без своих ключей. */
export const steamConfigured = () => !!process.env.STEAM_API_KEY;

/** Адрес, на который уводим за подтверждением личности. */
export function steamLoginUrl(origin: string): string {
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${origin}/api/auth/steam/callback`,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_ENDPOINT}?${params}`;
}

export type SteamUser = { steamId: string; name?: string; avatar?: string };

/** Проверка ответа Steam: те же параметры уходят обратно с mode=check_authentication — площадка
 *  либо подтверждает подпись, либо нет. Отдельного `state` не заводим: подделать чужой callback
 *  здесь означало бы подделать подпись Steam, а не угадать наш токен. */
export async function verifySteamCallback(query: URLSearchParams): Promise<SteamUser> {
  const claimedId = query.get("openid.claimed_id") ?? "";
  const match = CLAIMED_ID_RE.exec(claimedId);
  if (!match) throw new Error("steam: claimed_id не разобран");

  const verify = new URLSearchParams(query);
  verify.set("openid.mode", "check_authentication");
  const res = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: verify,
  });
  if (!res.ok) throw new Error(`steam openid endpoint: ${res.status}`);
  const text = await res.text();
  if (!/is_valid\s*:\s*true/.test(text)) throw new Error("steam: подпись не подтверждена");

  const steamId = match[1];
  const profile = await fetchProfile(steamId);
  return { steamId, ...profile };
}

async function fetchProfile(steamId: string): Promise<{ name?: string; avatar?: string }> {
  const key = process.env.STEAM_API_KEY;
  if (!key) return {};
  try {
    const res = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamId}`,
    );
    if (!res.ok) return {};
    const json = (await res.json()) as { response?: { players?: { personaname?: string; avatarfull?: string }[] } };
    const player = json.response?.players?.[0];
    return player ? { name: player.personaname, avatar: player.avatarfull } : {};
  } catch {
    return {};
  }
}
