import { FormInput, FormTextarea } from "@/components/pouf/Input";
import type { TournamentStatus } from "@/lib/tournaments";

// Общие куски форм админки турниров: подпись + поле. Формы здесь простые (server actions, без
// клиентского состояния), поэтому вместо компонента-обёртки на каждый случай — одно поле на все.

export function Field({
  name,
  label,
  value,
  placeholder,
  type = "text",
  required = false,
  textarea = false,
  hint,
}: {
  name: string;
  label: string;
  value?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  hint?: string;
}) {
  const common = {
    name,
    id: `f-${name}`,
    required,
    placeholder,
    defaultValue: value ?? undefined,
  };
  return (
    <label htmlFor={`f-${name}`} className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      {textarea ? (
        <FormTextarea {...common} rows={4} className="mt-1" />
      ) : (
        <FormInput {...common} type={type} className="mt-1" />
      )}
      {hint && <span className="mt-1 block text-[11px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

/** Цвет плашки статуса: «идёт» и «приём заявок» должны читаться с одного взгляда в списке. */
export const STATUS_TONE: Record<TournamentStatus, string> = {
  draft: "border-hairline bg-surface-2 text-ink-subtle",
  registration: "border-sky-200 bg-sky-100 text-sky-700",
  running: "border-emerald-200 bg-emerald-100 text-emerald-700",
  finished: "border-amber-200 bg-amber-100 text-amber-700",
};
