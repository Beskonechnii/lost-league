import { NextResponse } from "next/server";
import { can } from "@/lib/account";
import { listResponses, quizBySlug, responsesTable } from "@/lib/quizzes";

// Выгрузка ответов анкеты в CSV — чтобы дальше работать в таблице (посадить по позициям, свести
// с ростером). Роут, а не server-action: файл отдаётся ответом, а не рендером.
//
// Право проверяется здесь же: GET-роуты открыты общим правилом, а ответы анкеты — не публичные данные.

/** Экранирование по RFC 4180: кавычки удваиваются, поле в кавычках терпит запятые и переносы. */
const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await can("quizzes"))) return NextResponse.json({ error: "Нет права «Анкеты»" }, { status: 403 });

  const quiz = await quizBySlug((await params).slug);
  if (!quiz) return NextResponse.json({ error: "Анкета не найдена" }, { status: 404 });

  const { columns, rows } = responsesTable(quiz.questions, await listResponses(quiz.id));
  const csv = [
    ["Телеграм", "Когда", ...columns].map(cell).join(","),
    ...rows.map((r) => [r.username ? `@${r.username}` : "", r.createdAt.toISOString(), ...r.cells].map(cell).join(",")),
  ].join("\n");

  return new NextResponse(`﻿${csv}`, {
    headers: {
      // BOM выше — иначе Excel открывает кириллицу кракозябрами.
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${quiz.slug}.csv"`,
    },
  });
}
