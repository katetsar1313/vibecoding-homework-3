import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/admin/page-shell";

export const Route = createFileRoute("/_authenticated/events")({
  head: () => ({
    meta: [
      { title: "Журнал событий — Честно о себе | Тесты" },
      { name: "description", content: "История действий пользователей и системных событий." },
      { property: "og:title", content: "Журнал событий — Честно о себе | Тесты" },
      {
        property: "og:description",
        content: "История действий пользователей и системных событий.",
      },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Журнал событий" description="История действий и системных событий." />
      <EmptyState
        title="Событий пока нет"
        description="Здесь будут записи о запусках теста, подписках и приглашениях."
      />
    </div>
  ),
});
