/* Метр винрейта — лист Кита «Винрейт · WinrateMeter».
 *
 * Атом, а не кусок карточки игрока: тот же показатель нужен профилю игрока и списку ростера, и
 * считается он везде одинаково — `lib/player-record.ts`. Внутри только показ: доля берётся из
 * побед и поражений, чтобы вызывающий не гонял процент отдельным числом и не округлял его по-своему.
 *
 * Полоса нарисована здесь, а не взята из `Meter`: у метра винрейта своя толщина (11px из макета),
 * а высота `Meter` задана классом и снаружи не переопределяется.
 */
export function WinrateMeter({
  label = "Винрейт за сезон",
  wins,
  losses,
  className = "",
}: {
  label?: string;
  wins: number;
  losses: number;
  className?: string;
}) {
  const games = wins + losses;
  const pct = games > 0 ? (wins / games) * 100 : 0;

  return (
    <div className={`rounded-blob bg-surface-1 px-5 pb-[18px] pt-4 font-pouf cushion-card ${className}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[1px] text-muted">{label}</div>
      <div className="flex items-baseline gap-2.5">
        {/* Игр нет — прочерк, а не «0%»: ноль процентов это результат, а его ещё не было. */}
        <span className="text-[28px] font-black tabular-nums tracking-[-0.5px] text-ink">
          {games > 0 ? `${Math.round(pct)}%` : "—"}
        </span>
        <span className="ml-auto text-[12px] font-extrabold tabular-nums text-muted">
          {games > 0 ? `${wins}–${losses}` : "нет игр"}
        </span>
      </div>
      <div className="mt-3 h-[11px] overflow-hidden rounded-pill bg-surface-2 cushion-field">
        <div className="h-full rounded-pill bg-accent-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
