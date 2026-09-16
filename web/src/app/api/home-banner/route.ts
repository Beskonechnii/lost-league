import { NextResponse } from "next/server";
import { guard } from "@/lib/api-guard";
import { BANNER_LIMITS, type BannerDraft } from "@/lib/home-banner";
import { readBannerDraft, writeBannerDraft } from "@/lib/home-banner-store";

// Запись баннера главной. Одна строка в БД, одна кнопка на экране — соответственно и роут один,
// принимающий состояние формы целиком. Отдельных ручек на поле не заводим: баннер показывается
// только заполненным целиком, и частичные правки нечем было бы проверить.

/** Пустая строка и «поля не было» — одно и то же: и там и там баннер считается незаполненным. */
function text(raw: unknown, max?: number): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.trim();
  return clean ? (max ? clean.slice(0, max) : clean) : null;
}

export async function GET() {
  const denied = await guard("banner");
  if (denied) return denied;
  return NextResponse.json(await readBannerDraft());
}

export async function PATCH(req: Request) {
  const denied = await guard("banner");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ожидался объект баннера" }, { status: 400 });
  }

  const ctaHref = text(body.ctaHref);
  // Абсолютную ссылку на свой же домен не принимаем: канон домена ещё не закрыт, и такие ссылки
  // плодят расхождение http/https/www. Внутренний адрес — относительный путь.
  if (ctaHref && !/^(https?:\/\/|\/)/i.test(ctaHref)) {
    return NextResponse.json({ error: "Адрес кнопки: путь внутри сайта («/tournaments/…») или полная ссылка с https://" }, { status: 400 });
  }

  const draft: BannerDraft = {
    enabled: body.enabled === true,
    image: text(body.image),
    title: text(body.title, BANNER_LIMITS.title),
    text: text(body.text, BANNER_LIMITS.text),
    ctaLabel: text(body.ctaLabel, BANNER_LIMITS.ctaLabel),
    ctaHref,
  };

  return NextResponse.json(await writeBannerDraft(draft));
}
