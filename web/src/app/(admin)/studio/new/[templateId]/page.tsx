import Link from "next/link";
import { notFound } from "next/navigation";
import { getTemplate } from "@/studio/registry";
import { emptyPayload, type RawPayload } from "@/studio/types";
import { getMatchOptions, getRefs } from "@/lib/studio-refs";
import { prisma } from "@/lib/prisma";
import { Wizard } from "../../_components/wizard";

export const dynamic = "force-dynamic";

export default async function NewGraphicPage({
  params,
  searchParams,
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ render?: string; match?: string }>;
}) {
  const { templateId } = await params;
  const { render, match } = await searchParams;
  const template = getTemplate(templateId);
  if (!template) notFound();

  const [refs, matches] = await Promise.all([getRefs(), getMatchOptions()]);

  // ?render=<id> — открыть сохранённую генерацию и поправить.
  let initial: RawPayload | undefined;
  if (render) {
    const saved = await prisma.render.findUnique({ where: { id: Number(render) } });
    if (saved?.templateId === templateId) initial = JSON.parse(saved.payload) as RawPayload;
  }

  // ?match=<id> — открыть шаблон с уже выбранной картой (ссылка из архива серий).
  const matchField = template.fields.find((f) => f.kind === "match");
  if (match && matchField) {
    const base = initial ?? (emptyPayload(template.fields) as RawPayload);
    initial = { ...base, [matchField.key]: match };
  }

  return (
    <div className="space-y-6 font-pouf">
      <div>
        <Link href="/studio" className="text-sm font-bold text-muted hover:text-[var(--accent-ink)]">
          ← Шаблоны
        </Link>
        <h1 className="mt-2 text-[28px] font-black tracking-[-0.5px] text-ink md:text-4xl">{template.title}</h1>
        <p className="text-sm font-bold text-muted">{template.description}</p>
      </div>

      <Wizard templateId={templateId} refs={refs} matches={matches} initial={initial} />
    </div>
  );
}
