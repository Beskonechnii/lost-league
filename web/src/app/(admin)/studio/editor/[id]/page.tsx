import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getRefs } from "@/lib/studio-refs";
import { normalizeDoc } from "@/studio/editor/model";
import { BUILTIN_FONTS } from "@/studio/editor/fonts";
import { discoverFonts } from "@/studio/editor/fonts-server";
import { Workspace } from "../_components/workspace";
import { DeleteDesign } from "../_components/delete-design";

export const dynamic = "force-dynamic";

// Страница редактирования одного документа: серверная обёртка грузит Design.doc и отдаёт клиентский
// воркспейс. Раскладка правится целиком на клиенте, сохранение — PUT /api/studio/designs/[id].

export default async function DesignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [design, discovered, refs] = await Promise.all([
    prisma.design.findUnique({ where: { id } }),
    discoverFonts(),
    getRefs(),
  ]);
  if (!design) notFound();

  const doc = normalizeDoc(JSON.parse(design.doc) as unknown);
  // системные шрифты + подхваченные из public/fonts (файловые перекрывают одноимённые системные)
  const fonts = [...BUILTIN_FONTS, ...discovered];
  // библиотека командами: у каждой команды её лого + фото игроков (кто в этой команде и с картинкой).
  // Игрок к команде привязан по имени команды (PlayerRef.teamName) — тем же, что показывает ростер.
  const teamGroups = refs.teams.map((t) => ({
    id: t.id,
    name: t.name,
    logo: t.logo,
    players: refs.players
      .filter((p) => p.teamName === t.name && p.photo)
      .map((p) => ({ src: p.photo!, name: p.nickname })),
  }));
  // игроки без узнанной команды, но с фото — отдельной группой, чтобы были доступны
  const named = new Set(refs.teams.map((t) => t.name));
  const orphans = refs.players
    .filter((p) => p.photo && (!p.teamName || !named.has(p.teamName)))
    .map((p) => ({ src: p.photo!, name: p.nickname }));
  if (orphans.length) teamGroups.push({ id: 0, name: "Без команды", logo: null, players: orphans });

  return (
    <div className="space-y-4 font-pouf">
      <div className="flex items-center justify-between">
        <Link href="/studio/editor" className="text-xs font-bold text-muted hover:text-[var(--accent-ink)]">
          ← к списку документов
        </Link>
        <DeleteDesign id={design.id} title={design.title} redirectTo="/studio/editor" full />
      </div>
      <Workspace
        id={design.id}
        initialTitle={design.title ?? ""}
        initialDoc={doc}
        fonts={fonts}
        teams={teamGroups}
      />
    </div>
  );
}
