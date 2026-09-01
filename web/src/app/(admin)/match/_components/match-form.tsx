"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/pouf/Button";
import { Input } from "@/components/pouf/Input";

// Ввод id матча. Форма ничего не грузит — она только собирает адрес отчёта:
// весь разбор живёт на /match/<id>, поэтому ссылкой на него можно поделиться.

/** Из ввода вынимаем число: пускай вставляют и ссылку на Dotabuff/OpenDota, и «Match ID: 123». */
function matchIdFrom(input: string): string | null {
  const digits = input.match(/\d{6,}/);
  return digits ? digits[0] : null;
}

export function MatchForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  function open(src: "opendota" | "steam") {
    const id = matchIdFrom(input);
    if (!id) {
      setError("Не нашёл id матча — это длинное число, например 8907510684");
      return;
    }
    // opendota — путь по умолчанию, в адрес его не пишем: ссылка остаётся короткой.
    router.push(src === "steam" ? `/match/${id}?src=steam` : `/match/${id}`);
  }

  return (
    <div className="font-pouf">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full max-w-xs">
          <Input
            value={input}
            onChange={(v) => {
              setInput(v);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && open("opendota")}
            placeholder="ID матча Dota 2, напр. 8907510684"
            inputMode="numeric"
            aria-label="ID матча Dota 2"
          />
        </div>
        <Button onClick={() => open("opendota")} disabled={!input.trim()}>
          Разобрать
        </Button>
        {/* Запасной источник: беднее данными, но живёт независимо от аварий OpenDota. */}
        <Button
          variant="quiet"
          onClick={() => open("steam")}
          disabled={!input.trim()}
          title="Первоисточник Valve: без графика золота, таймингов покупок, событий и ников"
        >
          Из Steam
        </Button>
      </div>
      {error && <p className="mt-2 text-sm font-bold text-rose-700">{error}</p>}
    </div>
  );
}
