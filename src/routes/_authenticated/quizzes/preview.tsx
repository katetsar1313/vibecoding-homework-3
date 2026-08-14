import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RotateCcw } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { calculateQuizResult } from "@/lib/quiz.functions";
import { isQuizId } from "@/lib/quiz-admin";
import { QUIZ_DISCLAIMER, RESULT_TYPE_LABELS, type QuizQuestionWithOptions, type QuizScore } from "@/lib/quiz";

export const Route = createFileRoute("/_authenticated/quizzes/preview")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search["id"] === "string" ? search["id"] : "",
  }),
  beforeLoad: ({ search }) => {
    if (!isQuizId(search.id)) {
      throw redirect({ to: "/quizzes" });
    }
  },
  head: () => ({
    meta: [
      { title: "Предпросмотр теста — Честно о себе | Тесты" },
      { name: "description", content: "Тестовое прохождение теста без записи в статистику." },
      { property: "og:title", content: "Предпросмотр теста — Честно о себе | Тесты" },
      {
        property: "og:description",
        content: "Тестовое прохождение теста без записи в статистику.",
      },
    ],
  }),
  component: QuizPreviewPage,
});

type ResultRow = {
  result_type: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  recommendation: string | null;
  is_active: boolean;
};

function QuizPreviewPage() {
  const { id: quizId } = Route.useSearch();
  const calculate = useServerFn(calculateQuizResult);
  const [answers, setAnswers] = useState<string[]>([]);
  const [score, setScore] = useState<QuizScore | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["quiz-preview", quizId],
    queryFn: async () => {
      const [quiz, questions, results] = await Promise.all([
        supabase.from("quizzes").select("id, title, intro_text").eq("id", quizId).single(),
        supabase
          .from("quiz_questions")
          .select("id, question_number, text, is_active, quiz_options(id, question_id, option_number, text, result_type)")
          .eq("quiz_id", quizId)
          .eq("is_active", true)
          .order("question_number", { ascending: true }),
        supabase
          .from("quiz_results")
          .select("result_type, title, short_description, full_description, recommendation, is_active")
          .eq("quiz_id", quizId),
      ]);
      if (quiz.error) throw quiz.error;
      if (questions.error) throw questions.error;
      if (results.error) throw results.error;
      const list: QuizQuestionWithOptions[] = (questions.data ?? []).map((q) => ({
        id: q.id,
        question_number: q.question_number,
        text: q.text,
        is_active: q.is_active,
        options: [...(q.quiz_options ?? [])].sort((a, b) => a.option_number - b.option_number),
      }));
      return {
        title: quiz.data.title,
        introText: quiz.data.intro_text,
        questions: list,
        results: (results.data ?? []) as ResultRow[],
      };
    },
  });

  const questions = data?.questions ?? [];
  const current = questions[answers.length];

  async function choose(resultType: string) {
    const next = [...answers, resultType];
    setAnswers(next);
    if (next.length === questions.length) {
      const computed = await calculate({ data: { answers: next } });
      setScore(computed);
    }
  }

  function restart() {
    setAnswers([]);
    setScore(null);
  }

  const findResult = (type: string | null) =>
    type ? data?.results.find((r) => r.result_type === type) : undefined;

  return (
    <div>
      <PageHeader
        title={data?.title ? `Предпросмотр: ${data.title}` : "Предпросмотр теста"}
        description="Тестовое прохождение из админки. Ответы не сохраняются и не влияют на статистику."
        action={
          <div className="flex gap-2">
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/quizzes">
                <ArrowLeft className="size-4" />
                Назад
              </Link>
            </Button>
            <Button variant="outline" onClick={restart} className="gap-2">
              <RotateCcw className="size-4" />
              Начать заново
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : questions.length === 0 ? (
        <EmptyState
          title="Нет активных вопросов"
          description="Включите хотя бы один вопрос в разделе редактирования теста."
        />
      ) : score ? (
        <div className="space-y-4">
          <ResultCard result={findResult(score.result_type)} label="Основной результат" />
          {score.secondary_result_type ? (
            <ResultCard
              result={findResult(score.secondary_result_type)}
              label="Второй ведущий тип (равное количество баллов)"
            />
          ) : null}
          <Card className="rounded-2xl border-border/60 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">Баллы по типам</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {Object.entries(score.counts).map(([type, count]) => (
                <Badge key={type} variant="secondary">
                  {RESULT_TYPE_LABELS[type] ?? type}: {count}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : current ? (
        <div className="space-y-4">
          {answers.length === 0 && data?.introText ? (
            <Card className="rounded-2xl border-border/60 shadow-card">
              <CardContent className="pt-6 text-sm text-muted-foreground whitespace-pre-line">
                {data.introText}
              </CardContent>
            </Card>
          ) : null}
          <Card className="rounded-2xl border-border/60 shadow-card">
            <CardHeader className="space-y-3">
              <Progress value={(answers.length / questions.length) * 100} />
              <p className="text-xs text-muted-foreground">
                Вопрос {answers.length + 1} из {questions.length}
              </p>
              <CardTitle className="text-xl">{current.text}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {current.options.map((option) => (
                <Button
                  key={option.id}
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                  onClick={() => choose(option.result_type)}
                >
                  {option.text}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({ result, label }: { result: ResultRow | undefined; label: string }) {
  if (!result) return null;
  return (
    <Card className="rounded-2xl border-border/60 shadow-card">
      <CardHeader>
        <Badge variant="secondary" className="w-fit">
          {label}
        </Badge>
        <CardTitle className="text-xl">{result.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {result.short_description ? <p className="font-medium">{result.short_description}</p> : null}
        {result.full_description ? (
          <p className="text-muted-foreground">{result.full_description}</p>
        ) : null}
        {result.recommendation ? (
          <p className="rounded-xl bg-secondary/60 p-3">{result.recommendation}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{QUIZ_DISCLAIMER}</p>
      </CardContent>
    </Card>
  );
}
