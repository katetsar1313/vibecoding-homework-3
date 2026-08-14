import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Play, Plus } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  QUIZ_STATUS_LABELS,
  quizStatusBadgeVariant,
  type QuizStatus,
} from "@/lib/quiz-admin";

export const Route = createFileRoute("/_authenticated/quizzes/")({
  head: () => ({
    meta: [
      { title: "Тесты — Честно о себе | Тесты" },
      { name: "description", content: "Управление вопросами и вариантами ответов теста." },
      { property: "og:title", content: "Тесты — Честно о себе | Тесты" },
      {
        property: "og:description",
        content: "Управление вопросами и вариантами ответов теста.",
      },
    ],
  }),
  component: QuizzesPage,
});

type QuizOverview = {
  id: string;
  title: string;
  description: string | null;
  status: QuizStatus;
  sort_order: number;
  totalQuestions: number;
  activeQuestions: number;
  optionsCount: number;
  resultsCount: number;
};

function QuizzesPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["quiz-overview"],
    queryFn: async (): Promise<QuizOverview[]> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select(
          "id, title, description, status, sort_order, quiz_questions(id, is_active, quiz_options(id)), quiz_results(id)",
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((quiz) => {
        const questions = quiz.quiz_questions ?? [];
        return {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          status: quiz.status,
          sort_order: quiz.sort_order,
          totalQuestions: questions.length,
          activeQuestions: questions.filter((q) => q.is_active).length,
          optionsCount: questions.reduce((sum, q) => sum + (q.quiz_options?.length ?? 0), 0),
          resultsCount: quiz.quiz_results?.length ?? 0,
        };
      });
    },
  });

  return (
    <div>
      <PageHeader
        title="Тесты"
        description="Вопросы, варианты ответов и предпросмотр."
        action={
          <Button asChild className="gap-2">
            <Link to="/quizzes/new">
              <Plus className="size-4" />
              Создать тест
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card className="rounded-2xl border-destructive/40 shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="size-5 text-destructive" />
              Не удалось загрузить тесты
            </CardTitle>
            <CardDescription className="mt-2">
              {error instanceof Error ? error.message : "Неизвестная ошибка загрузки данных."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => refetch()}>
              Повторить загрузку
            </Button>
          </CardContent>
        </Card>
      ) : !data?.length ? (
        <div className="space-y-4">
          <EmptyState
            title="Тестов пока нет"
            description="Создайте первый тест — после этого можно будет добавить вопросы, варианты ответов и типы результатов."
          />
          <div className="flex justify-center">
            <Button asChild className="gap-2">
              <Link to="/quizzes/new">
                <Plus className="size-4" />
                Создать тест
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((quiz) => (
            <Card key={quiz.id} className="rounded-2xl border-border/60 shadow-card">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{quiz.title}</CardTitle>
                    {quiz.description ? (
                      <CardDescription className="mt-2 max-w-2xl">{quiz.description}</CardDescription>
                    ) : null}
                  </div>
                  <Badge variant={quizStatusBadgeVariant(quiz.status)}>
                    {QUIZ_STATUS_LABELS[quiz.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Активных вопросов</p>
                    <p className="text-2xl font-semibold">{quiz.activeQuestions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Всего вопросов</p>
                    <p className="text-2xl font-semibold">{quiz.totalQuestions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Вариантов ответов</p>
                    <p className="text-2xl font-semibold">{quiz.optionsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Типов результата</p>
                    <p className="text-2xl font-semibold">{quiz.resultsCount}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="gap-2">
                    <Link to="/quizzes/edit" search={{ id: quiz.id }}>
                      <Pencil className="size-4" />
                      Редактировать
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="gap-2">
                    <Link to="/quizzes/preview" search={{ id: quiz.id }}>
                      <Play className="size-4" />
                      Предпросмотр
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
