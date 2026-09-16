import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Дефолтная карточка ссылки на всю лигу: её показывают телеграм, дискорд и поисковик там, где у
// страницы нет своей. Файл-конвенция Next: og:image, его размеры и тип проставляются в <head>
// каждой страницы сами, наследуясь вниз по дереву маршрутов.
//
// Картинки под конкретный матч и профиль — отдельный долг (BACKLOG, later): им нужен серверный
// рендер под данные, а генератор постгейма сейчас клиентский.
//
// Рисуем языком Кита: бумага `--canvas` (#E7E3D8), знак и начертание — те же файлы, что в шапке
// и подвале сайта. Начертание там кладётся CSS-маской в цвет текста; маски в satori нет, поэтому
// лавандовую заливку (она под тёмный фон) меняем на `--ink` прямо в разметке SVG.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SPIRIT/CTRL — любительская лига по Dota 2";

const brand = (file: string) => readFileSync(join(process.cwd(), "public/assets/brand", file), "utf8");
const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

export default async function Image() {
  const mark = dataUri(brand("mark.svg"));
  const wordmark = dataUri(brand("wordmark.svg").replaceAll("#E3E7FF", "#33322E"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 44,
          // Ровно бумага Кита, без подсветки: фиолетовый градиент под знаком satori растягивает
          // в серое пятно на весь кадр, и «бумага» в превью перестаёт быть бумагой.
          background: "#E7E3D8",
        }}
      >
        <img src={mark} alt="" width={224} height={215} />
        <img src={wordmark} alt="" width={660} height={81} />
        <div style={{ fontSize: 34, color: "#69655D" }}>Любительская лига по Dota 2</div>
      </div>
    ),
    size,
  );
}
