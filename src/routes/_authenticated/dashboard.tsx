import { createFileRoute } from "@tanstack/react-router";
import { Users, PlayCircle, CheckCircle2, BellRing, Gift } from "lucide-react";

import { PageHeader } from "@/components/admin/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Главная — Честно о себе | Тесты" },
      { name: "description", content: "Сводка по пользователям, тестам и подпискам бота." },
      { property: "og:title", content: "Главная — Честно о себе | Тесты" },
      { property: "og:description", content: "Сводка по пользователям, тестам и подпискам бота." },
    ],
  }),
  component: DashboardPage,
});

const cards = [
  { title: "Всего пользователей", icon: Users, tone: "bg-lavender/15 text-lavender" },
  { title: "Начали тест", icon: PlayCircle, tone: "bg-rose/15 text-rose" },
  { title: "Завершили тест", icon: CheckCircle2, tone: "bg-teal/15 text-teal" },
  { title: "Подтвердили подписку", icon: BellRing, tone: "bg-primary/15 text-primary" },
  { title: "Пришли по приглашению", icon: Gift, tone: "bg-secondary text-secondary-foreground" },
] as const;

function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Главная"
        description="Ключевые показатели бота «Честно о себе». Данные появятся после подключения MAX."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.title} className="rounded-2xl border-border/60 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <span className={`flex size-9 items-center justify-center rounded-xl ${card.tone}`}>
                <card.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">Ожидает данных</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
