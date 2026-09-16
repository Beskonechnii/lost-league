import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { uploadUrl, type UploadKind } from "@/lib/profiles";
import { invalidateUploads } from "@/lib/uploads";
import { guard } from "@/lib/api-guard";
import type { PermissionKey } from "@/lib/permissions";

// Загрузка картинки: multipart { kind: teams|players|home, file } → файл в public/uploads + путь.
// Путь дальше кладётся в Team.logo / Team.wordmark / Team.photo / Player.photo / HomeBanner.image.

const MAX_BYTES = 8 * 1024 * 1024;
// Право решает НАЗНАЧЕНИЕ картинки, а не роут: полотно главной правит оператор баннера, которому
// ростер трогать незачем, и наоборот.
const PERM: Record<UploadKind, PermissionKey> = { teams: "roster.edit", players: "roster.edit", home: "banner" };
const EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

export async function POST(req: Request) {
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "") as UploadKind;
  const file = form.get("file");

  if (!(kind in PERM)) {
    return NextResponse.json({ error: "kind: ожидалось teams|players|home" }, { status: 400 });
  }
  // Проверка права — после разбора kind: роль в /api уже спросил proxy, а какое именно право
  // нужно, известно только из назначения картинки.
  const denied = await guard(PERM[kind]);
  if (denied) return denied;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file: не пришёл файл" }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: `Формат ${file.type || "?"} не поддержан: png, jpeg или webp` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Файл больше ${MAX_BYTES / 1024 / 1024} МБ` }, { status: 413 });
  }

  // Полотну главной имя говорящее: у картинки без alt это единственный оставшийся сигнал о том,
  // что это вообще такое.
  const name = `${kind === "home" ? "home-banner-" : ""}${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", kind);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  invalidateUploads(kind); // листинг папки закэширован — иначе фолбэк не увидит свежий файл

  return NextResponse.json({ path: uploadUrl(kind, name) });
}
