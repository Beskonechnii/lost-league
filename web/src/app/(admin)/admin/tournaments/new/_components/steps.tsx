import type { Step } from "@/components/pouf/stepper";

// Шаги мастера заведения турнира. Сам рисунок полосы — китовый `Stepper`
// (`components/pouf/stepper.tsx`): до Э9 здесь жила своя полоса из пилюль со
// стрелками «→», то есть второй степпер на сайте рядом с тем, что Э8 поставил
// в анкете игрока. Осталось только знание о шагах и о том, куда с них ходят.

export const WIZARD_STEPS = [
  { key: "describe", label: "Описание" },
  { key: "divisions", label: "Дивизионы" },
  { key: "import", label: "Импорт составов" },
  { key: "draw", label: "Жеребьёвка" },
  { key: "done", label: "Готово" },
] as const;

export type StepKey = (typeof WIZARD_STEPS)[number]["key"];
export const isStep = (v: unknown): v is StepKey => WIZARD_STEPS.some((s) => s.key === v);
export const stepIndex = (key: StepKey) => WIZARD_STEPS.findIndex((s) => s.key === key);

/**
 * Шаги для `Stepper`. Адрес даём только пройденным — вернуться и поправить можно,
 * а пока черновика нет, цеплять к нему дивизионы и составы не к чему. Степпер сам
 * вешает нажатие лишь на пройденные, но и адрес без черновика не имеет смысла.
 */
export const wizardSteps = (slug: string | null): Step[] =>
  WIZARD_STEPS.map((s) => ({
    label: s.label,
    href: slug ? `/admin/tournaments/new/${s.key}?t=${slug}` : undefined,
  }));
