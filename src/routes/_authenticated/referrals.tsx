import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/admin/page-shell";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "Рефералы — Честно о себе | Тесты" },
      { name: "description", content: "Приглашения участников и реферальные коды." },
      { property: "og:title", content: "Рефералы — Честно о себе | Тесты" },
      { property: "og:description", content: "Приглашения участников и реферальные коды." },
    ],
  }),
  component: () => (
    <div>
      <PageHeader title="Рефералы" description="Кто кого пригласил и по какому коду." />
      <EmptyState
        title="Приглашений пока нет"
        description="Здесь будет список приглашений: пригласивший, приглашённый и реферальный код."
      />
    </div>
  ),
});
