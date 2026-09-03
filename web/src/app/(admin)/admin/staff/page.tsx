import Link from "next/link";
import { playerPath } from "@/lib/profiles";
import { currentAccount, effectiveRole, listAccounts, ownerEmail, type StaffAccount } from "@/lib/account";
import { PERMISSIONS, PERMISSION_GROUPS } from "@/lib/permissions";
import { Button } from "@/components/pouf/Button";
import { Checkbox } from "@/components/pouf/checkbox";
import { DataCell, DataRow, DataTable, RowActions } from "@/components/pouf/data-table";
import { EmptyState, StatusPill } from "@/components/pouf/feedback";
import { FORM_MAX_W } from "@/components/pouf/blocks";
import { denyUnlessPermission } from "../../_components/permission-gate";
import { AdminHeader } from "../../_components/admin-header";
import { Panel } from "../../_components/panel";
import { makeAdmin, removeAdmin, removeAccount, savePermissions } from "./actions";
import { DeleteAccount } from "./_components/delete-account";

export const dynamic = "force-dynamic";
export const metadata = { title: "Команда лиги" };

// Команда лиги: владелец и админы отдельным списком, у каждого админа — чекбоксы прав
// (docs/archive/ACCOUNTS-PLAN.md §6). Пришла на смену /admin/roles, где была только роль целиком: роль решает
// «пускать ли в служебную часть вообще», а чем человек там занимается — вопрос прав.
//
// Новый админ получает ноль прав: владелец отмечает нужное осознанно, а не выдаёт всё скопом.
//
// Владелец и админы — карточки (у админа внутри полтора десятка прав), остальные аккаунты —
// таблица с действиями: это записи, а не сущности со своей страницей (UI-GUIDELINES §4).

/** Ссылка на профиль ростера — по числовому id: карточка живёт на /roster/players/<id>, не на slug
 *  (в /admin/roles тут был баг — ссылка вела на slug и упиралась в 404). */
function ProfileLink({ account }: { account: StaffAccount }) {
  if (!account.player) return null;
  return (
    <Link href={playerPath(account.player)} className="text-[var(--accent-ink)] hover:underline">
      {account.player.nickname}
    </Link>
  );
}

/** Как назвать аккаунт в диалоге удаления — почта, иначе tg-хендл, иначе id. */
function whoLabel(account: StaffAccount): string {
  return account.email ?? (account.tgUsername ? `@${account.tgUsername}` : `#${account.id}`);
}

function Who({ account, me }: { account: StaffAccount; me: number | null }) {
  return (
    <div className="min-w-0 flex-1 font-pouf">
      {/* Перенос, а не обрезка: почта — это и есть имя аккаунта, обрезанная «stani…» не опознаётся. */}
      <p className="text-sm font-black text-ink [overflow-wrap:anywhere]">
        {account.email ?? (account.tgUsername ? `@${account.tgUsername}` : "без почты")}
        {account.name && <span className="font-bold text-muted"> · {account.name}</span>}
        {account.id === me && <span className="font-bold text-muted"> · это вы</span>}
      </p>
      {account.player && (
        <p className="mt-0.5 text-xs font-bold text-muted [overflow-wrap:anywhere]">
          профиль: <ProfileLink account={account} />
        </p>
      )}
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
function AdminCard({ account, me, isOwner }: { account: StaffAccount; me: number | null; isOwner: boolean }) {
  const self = account.id === me;
  const granted = new Set<string>(account.perms);

  return (
    <li>
      <Panel>
        <div className="flex flex-wrap items-start gap-3">
          <StatusPill tone="ok">Админ</StatusPill>
          <Who account={account} me={me} />
          {!self && (
            <RowActions>
              <form action={removeAdmin}>
                <input type="hidden" name="accountId" value={account.id} />
                <Button type="submit" size="sm" variant="quiet">Снять админа</Button>
              </form>
              {isOwner && <DeleteAccount id={account.id} who={whoLabel(account)} action={removeAccount} />}
            </RowActions>
          )}
        </div>

        {/* Права свёрнуты по умолчанию: чекбоксов полтора десятка, и в развёрнутом виде каждая
            карточка админа занимала экран — список команды лиги переставал читаться. Что выдано,
            видно и в свёрнутом виде: строкой подписей. */}
        <form action={savePermissions} className="mt-4 border-t border-hairline pt-4 font-pouf">
          <input type="hidden" name="accountId" value={account.id} />
          <details className="group">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-xs font-bold text-muted">
              <span className="font-black text-ink">Права</span>
              <span>
                {account.perms.length ? `${account.perms.length} из ${PERMISSIONS.length}` : "прав пока нет"}
              </span>
              <span className="min-w-0 flex-1 truncate group-open:hidden">{grantedLabels(granted)}</span>
              <span className="shrink-0 font-black text-[var(--accent-ink)]">
                <span className="group-open:hidden">развернуть</span>
                <span className="hidden group-open:inline">свернуть</span>
              </span>
            </summary>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group}>
                  <p className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted">{group}</p>
                  <div className="mt-2 space-y-2">
                    {PERMISSIONS.filter((p) => p.group === group).map((p) => (
                      // Флажок Кита — <button> radix, поэтому подпись стоит рядом отдельным
                      // <label for>, а не обёрткой: внутри обёртки клик по тексту уходил бы в
                      // его скрытый input (тот же приём, что в /me/security).
                      <div key={p.key} className="flex items-start gap-2" title={p.hint}>
                        <Checkbox
                          id={`perm-${account.id}-${p.key}`}
                          name="perm"
                          value={p.key}
                          defaultChecked={granted.has(p.key)}
                          disabled={self}
                          className="mt-0.5"
                        />
                        <label
                          htmlFor={`perm-${account.id}-${p.key}`}
                          className={`text-xs font-bold ${self ? "text-muted" : "cursor-pointer text-ink-muted"}`}
                        >
                          {p.label}
                          <span className="block font-bold text-muted">{p.hint}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {self ? (
              <p className="mt-4 text-xs font-bold text-muted">
                Свои права здесь не меняются — их правит владелец лиги.
              </p>
            ) : (
              <div className="mt-4">
                <Button type="submit" size="sm">Сохранить права</Button>
              </div>
            )}
          </details>
        </form>
      </Panel>
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
  const isOwner = me != null && effectiveRole(me) === "owner";

  return (
    <main className={`mx-auto w-full ${FORM_MAX_W} flex-1 px-4 py-8 md:px-6`}>
      <AdminHeader title="Команда лиги">
        Роль решает, пускать ли в служебную часть вообще; чем человек там занимается — решают права.
        Права действуют сразу, роль — со следующего входа (она вшита в сессию).
      </AdminHeader>

      <div className="mt-6 space-y-4">
        <Panel
          title="Владелец"
          hint={
            <>
              Назначается почтой в <code>OWNER_EMAIL</code>
              {owner ? <> (<span className="text-ink">{owner}</span>)</> : null}: все права всегда,
              отобрать их из панели нельзя.
            </>
          }
        >
          {owners.length === 0 ? (
            <EmptyState icon="user" title="Владелец ещё ни разу не входил">
              Аккаунта с почтой из <code>OWNER_EMAIL</code> в базе пока нет — он заведётся при первом входе.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {owners.map((a) => (
                // На узком экране строка становится столбиком: в ряд почта, пилюля роли и
                // «все права» делят 300px, и почта ломается по три буквы в строке.
                <li
                  key={a.id}
                  className="flex flex-col items-start gap-2 rounded-blob bg-surface-2 px-4 py-3 cushion-field sm:flex-row sm:items-center sm:gap-3"
                >
                  <StatusPill tone="info">Владелец</StatusPill>
                  <Who account={a} me={me?.id ?? null} />
                  <span className="shrink-0 font-pouf text-xs font-bold text-muted">все права</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <h2 className="pt-2 font-pouf text-[13px] font-extrabold uppercase tracking-[1.5px] text-muted">
          Админы{admins.length > 0 && <span className="ml-2 tabular-nums">{admins.length}</span>}
        </h2>

        {admins.length === 0 ? (
          <EmptyState icon="users" title="Админов нет">
            Вся служебная часть на владельце. Назначьте админа в списке аккаунтов ниже.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {admins.map((a) => (
              <AdminCard key={a.id} account={a} me={me?.id ?? null} isOwner={isOwner} />
            ))}
          </ul>
        )}

        <Panel
          title="Остальные аккаунты"
          hint="Игроки лиги. Назначенный админ начинает с нуля прав — отметьте нужные в его карточке."
          aside={
            others.length > 0 ? (
              <span className="font-pouf text-xs font-bold tabular-nums text-muted">{others.length}</span>
            ) : undefined
          }
        >
          <DataTable
            caption="Аккаунты игроков"
            columns={[
              { label: "Аккаунт" },
              { label: "Профиль в ростере", hideOnNarrow: true },
              { label: "", align: "right", width: "1%" },
            ]}
            empty={
              <EmptyState icon="users" title="Других аккаунтов пока нет">
                Они появятся, когда игроки начнут заводить кабинет.
              </EmptyState>
            }
          >
            {others.map((a) => (
              <DataRow key={a.id}>
                <DataCell>
                  {a.email ?? (a.tgUsername ? `@${a.tgUsername}` : "без почты")}
                  {a.name && <span className="font-bold text-muted"> · {a.name}</span>}
                  {a.id === me?.id && <span className="font-bold text-muted"> · это вы</span>}
                </DataCell>
                <DataCell muted hideOnNarrow>
                  {a.player ? <ProfileLink account={a} /> : "—"}
                </DataCell>
                <DataCell align="right" nowrap>
                  {a.id !== me?.id && (
                    <RowActions>
                      <form action={makeAdmin}>
                        <input type="hidden" name="accountId" value={a.id} />
                        <Button type="submit" size="xs">Сделать админом</Button>
                      </form>
                      {isOwner && <DeleteAccount id={a.id} who={whoLabel(a)} action={removeAccount} />}
                    </RowActions>
                  )}
                </DataCell>
              </DataRow>
            ))}
          </DataTable>
        </Panel>
      </div>
    </main>
  );
}
