import { redirect } from "next/navigation";

// Групповая стадия переехала на корень дивизиона: адрес дивизиона теперь открывает данные, а не
// список ссылок. Ссылки вида /tournaments/s2/d1/groups раздавались в чат — поэтому редирект, не 404.
export default async function GroupsRedirect({ params }: { params: Promise<{ slug: string; div: string }> }) {
  const { slug, div } = await params;
  redirect(`/tournaments/${slug}/${div}`);
}
