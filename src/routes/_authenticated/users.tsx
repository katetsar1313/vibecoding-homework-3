import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/admin/page-shell";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Пользователи — Честно о себе | Тесты" },
      { name: "description", content: "Участники чат-бота: имена, подписка и рефералы." },
      { property: "og:title", content: "Пользователи — Честно о себе | Тесты" },
      { property: "og:description", content: "Участники чат-бота: имена, подписка и рефералы." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Пользователи" description="Список участников чат-бота MAX." />
      <EmptyState
        title="Пока нет пользователей"
        description="Здесь появятся участники бота с их именами, подпиской на канал и реферальными кодами."
      />
    </div>
  ),
});
