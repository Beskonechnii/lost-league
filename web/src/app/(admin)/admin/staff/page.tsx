import Link from "next/link";
import { currentAccount, listAccounts, ownerEmail, type StaffAccount } from "@/lib/account";
import { PERMISSIONS, PERMISSION_GROUPS } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { makeAdmin, removeAdmin, savePermissions } from "./actions";
import { FORM_MAX_W } from "@/app/_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Команда лиги" };

// Команда лиги: владелец и админы отдельным списком, у каждого админа — чекбоксы прав
// (ACCOUNTS-PLAN.md §6). Пришла на смену /admin/roles, где была только роль целиком: роль решает
// «пускать ли в служебную часть вообще», а чем человек там занимается — вопрос прав.
//
// Новый админ получает ноль прав: владелец отмечает нужное осознанно, а не выдаёт всё скопом.

/** Ссылка на профиль ростера — по числовому id: карточка живёт на /roster/players/<id>, не на slug
 *  (в /admin/roles тут был баг — ссылка вела на slug и упиралась в 404). */
function ProfileLink({ account }: { account: StaffAccount }) {
  if (!account.player) return null;
  return (
    <p className="mt-0.5 truncate text-xs text-ink-subtle">
      профиль:{" "}
      <Link href={`/roster/players/${account.player.id}`} className="text-accent-bright hover:underline">
        {account.player.nickname}
      </Link>
    </p>
  );
}

function Who({ account, me }: { account: StaffAccount; me: number | null }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm">
        <span className="text-ink-muted">{account.email}</span>
        {account.name && <span className="text-ink-subtle"> · {account.name}</span>}
        {account.id === me && <span className="text-ink-subtle"> · это вы</span>}
      </p>
      <ProfileLink account={account} />
    </div>
  );
}

/** Что выдано — одной строкой, для свёрнутого блока прав. Пусто — «ничего». */
function grantedLabels(granted: Set<string>): string {
  const labels = PERMISSIONS.filter((p) => granted.has(p.key)).map((p) => p.label);
  return labels.length ? labels.join(", ") : "ничего не выдано";
}

/** Карточка админа: кто это, набор прав и кнопка снятия роли. Свой аккаунт показываем только для
 *  чтения — иначе админ снял бы себе роль и запер сам себя, а «выдать себе всё» стало бы одним кликом. */
function AdminCard({ account, me }: { account: StaffAccount; me: number | null }) {
  const self = account.id === me;
  const granted = new Set<string>(account.perms);

  return (
    <li className="rounded-lg border border-hairline bg-surface-1 p-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 rounded-md border border-emerald-900 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300">
          Админ
        </span>
        <Who account={account} me={me} />
        {!self && (
          <form action={removeAdmin}>
            <input type="hidden" name="accountId" value={account.id} />
            <Button type="submit" size="sm" variant="outline">Снять админа</Button>
          </form>
        )}
      </div>

      {/* Права свёрнуты по умолчанию: чекбоксов полтора десятка, и в развёрнутом виде каждая
          карточка админа занимала экран — список команды лиги переставал читаться. Что выдано,
          видно и в свёрнутом виде: строкой подписей. */}
      <form action={savePermissions} className="mt-3 border-t border-hairline pt-3">
        <input type="hidden" name="accountId" value={account.id} />
        <details className="group">
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span className="font-semibold text-ink">Права</span>
            <span className="text-ink-subtle">
              {account.perms.length ? `${account.perms.length} из ${PERMISSIONS.length}` : "прав пока нет"}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink-subtle group-open:hidden">{grantedLabels(granted)}</span>
            <span className="shrink-0 text-accent-bright">
              <span className="group-open:hidden">развернуть</span>
              <span className="hidden group-open:inline">свернуть</span>
            </span>
          </summary>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">{group}</p>
              <div className="mt-1.5 space-y-1.5">
                {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                  <label key={p.key} className="flex items-start gap-2 text-xs text-ink-muted" title={p.hint}>
                    <input
                      type="checkbox"
                      name="perm"
                      value={p.key}
                      defaultChecked={granted.has(p.key)}
                      disabled={self}
                      className="mt-0.5 size-4 shrink-0 accent-accent"
                    />
                    <span>
                      {p.label}
                      <span className="block text-ink-subtle">{p.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {self ? (
          <p className="mt-3 text-xs text-ink-subtle">Свои права здесь не меняются — их правит владелец лиги.</p>
        ) : (
          <div className="mt-3">
            <Button type="submit" size="sm">Сохранить права</Button>
          </div>
        )}
        </details>
      </form>
    </li>
  );
}

export default async function StaffPage() {
  const denied = await denyUnlessPermission("accounts.admins", "Команда лиги");
  if (denied) return denied;

  const [accounts, me] = await Promise.all([listAccounts(), currentAccount()]);
  const owners = accounts.filter((a) => a.effectiveRole === "owner");
  const admins = accounts.filter((a) => a.effectiveRole === "admin");
  const others = accounts.filter((a) => a.effectiveRole === "player");
  const owner = ownerEmail();

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-300/80">Служебная часть</p>
      <h1 className="mt-1.5 text-xl font-bold tracking-tight">Команда лиги</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        Роль решает, пускать ли в служебную часть вообще; чем человек там занимается — решают права.
        Права действуют сразу, роль — со следующего входа (она вшита в сессию).
      </p>

      <h2 className="mt-6 text-sm font-semibold text-ink">Владелец</h2>
      <p className="mt-1 text-xs text-ink-subtle">
        Назначается почтой в <code>OWNER_EMAIL</code>
        {owner ? <> (<span className="text-ink">{owner}</span>)</> : null}: все права всегда, отобрать их
        из панели нельзя.
      </p>
      <ul className="mt-2 space-y-2">
        {owners.length === 0 ? (
          <li className="rounded-lg border border-hairline bg-surface-1 px-4 py-3 text-sm text-ink-subtle">
            Владелец ещё ни разу не входил — аккаунта с этой почтой в базе нет.
          </li>
        ) : (
          owners.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3">
              <span className="shrink-0 rounded-md border border-fuchsia-800 bg-fuchsia-950/40 px-2 py-0.5 text-xs text-fuchsia-300">
                Владелец
              </span>
              <Who account={a} me={me?.id ?? null} />
              <span className="shrink-0 text-xs text-ink-subtle">все права</span>
            </li>
          ))
        )}
      </ul>

      <h2 className="mt-8 text-sm font-semibold text-ink">
        Админы{admins.length > 0 && <span className="ml-2 font-normal text-ink-subtle">{admins.length}</span>}
      </h2>
      {admins.length === 0 ? (
        <p className="mt-2 rounded-lg border border-hairline bg-surface-1 px-4 py-6 text-center text-sm text-ink-subtle">
          Админов нет — вся служебная часть на владельце.
        </p>
      ) : (
        <ul className="mt-2 space-y-3">
          {admins.map((a) => (
            <AdminCard key={a.id} account={a} me={me?.id ?? null} />
          ))}
        </ul>
      )}

      <h2 className="mt-8 text-sm font-semibold text-ink">
        Остальные аккаунты{others.length > 0 && <span className="ml-2 font-normal text-ink-subtle">{others.length}</span>}
      </h2>
      <p className="mt-1 text-xs text-ink-subtle">Игроки лиги. Назначенный админ начинает с нуля прав — отметьте нужные в его карточке.</p>
      {others.length === 0 ? (
        <p className="mt-2 rounded-lg border border-hairline bg-surface-1 px-4 py-6 text-center text-sm text-ink-subtle">
          Других аккаунтов пока нет.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {others.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-lg border border-hairline bg-surface-1 px-4 py-3">
              <span className="shrink-0 rounded-md border border-hairline bg-surface-2 px-2 py-0.5 text-xs text-ink-muted">
                Игрок
              </span>
              <Who account={a} me={me?.id ?? null} />
              {a.id !== me?.id && (
                <form action={makeAdmin}>
                  <input type="hidden" name="accountId" value={a.id} />
                  <Button type="submit" size="sm">Сделать админом</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
