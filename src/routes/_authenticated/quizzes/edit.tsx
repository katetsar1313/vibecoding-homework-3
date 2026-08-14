import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowDown, ArrowUp, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  QUIZ_STATUS_OPTIONS,
  isQuizId,
  type QuizStatus,
} from "@/lib/quiz-admin";
import { QUIZ_DISCLAIMER, RESULT_TYPES, RESULT_TYPE_LABELS, type QuizQuestionWithOptions } from "@/lib/quiz";

export const Route = createFileRoute("/_authenticated/quizzes/edit")({
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
      { title: "Редактирование теста — Честно о себе | Тесты" },
      { name: "description", content: "Редактор вопросов, вариантов ответов и порядка теста." },
      { property: "og:title", content: "Редактирование теста — Честно о себе | Тесты" },
      {
        property: "og:description",
        content: "Редактор вопросов, вариантов ответов и порядка теста.",
      },
    ],
  }),
  component: QuizEditPage,
});

type QuizSettings = {
  id: string;
  title: string;
  description: string | null;
  intro_text: string | null;
  status: QuizStatus;
  sort_order: number;
};

type ResultRow = {
  id: string;
  result_type: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  recommendation: string | null;
  is_active: boolean;
};

async function fetchQuestions(quizId: string): Promise<QuizQuestionWithOptions[]> {
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, question_number, text, is_active, quiz_options(id, question_id, option_number, text, result_type)")
    .eq("quiz_id", quizId)
    .order("question_number", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((q) => ({
    id: q.id,
    question_number: q.question_number,
    text: q.text,
    is_active: q.is_active,
    options: [...(q.quiz_options ?? [])].sort((a, b) => a.option_number - b.option_number),
  }));
}

function QuizEditPage() {
  const { id: quizId } = Route.useSearch();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("settings");

  const settingsQuery = useQuery({
    queryKey: ["quiz-editor-settings", quizId],
    queryFn: async (): Promise<QuizSettings> => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, intro_text, status, sort_order")
        .eq("id", quizId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const questionsQuery = useQuery({
    queryKey: ["quiz-editor", quizId],
    queryFn: () => fetchQuestions(quizId),
  });

  const resultsQuery = useQuery({
    queryKey: ["quiz-results", quizId],
    queryFn: async (): Promise<ResultRow[]> => {
      const { data, error } = await supabase
        .from("quiz_results")
        .select("id, result_type, title, short_description, full_description, recommendation, is_active")
        .eq("quiz_id", quizId);
      if (error) throw error;
      const order = RESULT_TYPES as readonly string[];
      return [...((data ?? []) as ResultRow[])].sort((a, b) => {
        const ai = order.indexOf(a.result_type);
        const bi = order.indexOf(b.result_type);
        if (ai === -1 && bi === -1) return a.result_type.localeCompare(b.result_type);
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    },
  });

  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [items, setItems] = useState<QuizQuestionWithOptions[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [editingResult, setEditingResult] = useState<ResultRow | null>(null);
  const [creatingResult, setCreatingResult] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) setSettings(settingsQuery.data);
  }, [settingsQuery.data]);

  useEffect(() => {
    if (questionsQuery.data) setItems(questionsQuery.data);
  }, [questionsQuery.data]);

  function updateQuestion(id: string, patch: Partial<QuizQuestionWithOptions>) {
    setItems((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }

  function updateOption(questionId: string, optionId: string, text: string) {
    setItems((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.map((o) => (o.id === optionId ? { ...o, text } : o)) }
          : q,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index]!;
      const b = next[target]!;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  async function handleSaveSettings() {
    if (!settings) return;
    if (!settings.title.trim()) {
      toast.error("Название теста не может быть пустым");
      return;
    }
    setSavingSettings(true);
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({
          title: settings.title.trim(),
          description: settings.description?.trim() || null,
          intro_text: settings.intro_text?.trim() || null,
          status: settings.status,
          is_active: settings.status === "published",
          sort_order: settings.sort_order,
        })
        .eq("id", quizId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["quiz-editor-settings", quizId] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-overview"] });
      toast.success("Настройки сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveQuestions() {
    for (const [index, question] of items.entries()) {
      if (!question.text.trim()) {
        toast.error(`Вопрос №${index + 1}: текст не может быть пустым`);
        return;
      }
      if (question.is_active) {
        const filled = question.options.filter((o) => o.text.trim().length > 0);
        if (question.options.length !== 4 || filled.length !== 4) {
          toast.error(`Вопрос №${index + 1}: у активного вопроса должны быть 4 непустых варианта`);
          return;
        }
      }
    }

    setSavingQuestions(true);
    try {
      for (const [index, question] of items.entries()) {
        const { error } = await supabase
          .from("quiz_questions")
          .update({ question_number: -(index + 1) })
          .eq("id", question.id)
          .eq("quiz_id", quizId);
        if (error) throw error;
      }
      for (const [index, question] of items.entries()) {
        const { error } = await supabase
          .from("quiz_questions")
          .update({
            question_number: index + 1,
            text: question.text.trim(),
            is_active: question.is_active,
          })
          .eq("id", question.id)
          .eq("quiz_id", quizId);
        if (error) throw error;
        for (const option of question.options) {
          const { error: optionError } = await supabase
            .from("quiz_options")
            .update({ text: option.text.trim() })
            .eq("id", option.id);
          if (optionError) throw optionError;
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["quiz-editor", quizId] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-preview", quizId] });
      toast.success("Вопросы сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить вопросы");
    } finally {
      setSavingQuestions(false);
    }
  }

  async function handleAddQuestion() {
    setAddingQuestion(true);
    try {
      const resultTypes =
        (resultsQuery.data?.length ?? 0) >= 4
          ? resultsQuery.data!.slice(0, 4).map((r) => r.result_type)
          : [...RESULT_TYPES];

      const nextNumber = items.length + 1;
      const { data: question, error } = await supabase
        .from("quiz_questions")
        .insert({
          quiz_id: quizId,
          question_number: nextNumber,
          text: "",
          is_active: false,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: optionsError } = await supabase.from("quiz_options").insert(
        resultTypes.map((result_type, index) => ({
          question_id: question.id,
          option_number: index + 1,
          text: "",
          result_type,
        })),
      );
      if (optionsError) throw optionsError;

      await queryClient.invalidateQueries({ queryKey: ["quiz-editor", quizId] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-overview"] });
      toast.success("Вопрос добавлен");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось добавить вопрос");
    } finally {
      setAddingQuestion(false);
    }
  }

  async function handleSaveResult() {
    if (!editingResult) return;
    if (!editingResult.title.trim()) {
      toast.error("Название результата не может быть пустым");
      return;
    }
    if (creatingResult && !editingResult.result_type.trim()) {
      toast.error("Системный тип результата не может быть пустым");
      return;
    }

    setSavingResult(true);
    try {
      if (creatingResult) {
        const { error } = await supabase.from("quiz_results").insert({
          quiz_id: quizId,
          result_type: editingResult.result_type.trim(),
          title: editingResult.title.trim(),
          short_description: editingResult.short_description?.trim() || null,
          full_description: editingResult.full_description?.trim() || null,
          recommendation: editingResult.recommendation?.trim() || null,
          is_active: editingResult.is_active,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("quiz_results")
          .update({
            title: editingResult.title.trim(),
            short_description: editingResult.short_description?.trim() || null,
            full_description: editingResult.full_description?.trim() || null,
            recommendation: editingResult.recommendation?.trim() || null,
            is_active: editingResult.is_active,
          })
          .eq("id", editingResult.id)
          .eq("quiz_id", quizId);
        if (error) throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["quiz-results", quizId] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-preview", quizId] });
      toast.success(creatingResult ? "Тип результата создан" : "Результат сохранён");
      setEditingResult(null);
      setCreatingResult(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить результат");
    } finally {
      setSavingResult(false);
    }
  }

  const isLoading = settingsQuery.isLoading || questionsQuery.isLoading || resultsQuery.isLoading;

  return (
    <div>
      <PageHeader
        title={settings?.title ? `Редактирование: ${settings.title}` : "Редактирование теста"}
        description="Настройки, вопросы, варианты ответов и типы результатов выбранного теста."
        action={
          <Button asChild variant="ghost" className="gap-2">
            <Link to="/quizzes">
              <ArrowLeft className="size-4" />
              Назад
            </Link>
          </Button>
        }
      />

      {isLoading || !settings ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full max-w-md rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="settings">Настройки</TabsTrigger>
            <TabsTrigger value="questions">Вопросы</TabsTrigger>
            <TabsTrigger value="results">Результаты</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">
                <Save className="size-4" />
                {savingSettings ? "Сохранение…" : "Сохранить настройки"}
              </Button>
            </div>
            <Card className="rounded-2xl border-border/60 shadow-card">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Название</Label>
                  <Input
                    id="edit-title"
                    value={settings.title}
                    onChange={(event) => setSettings({ ...settings, title: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Короткое описание</Label>
                  <Textarea
                    id="edit-description"
                    rows={3}
                    value={settings.description ?? ""}
                    onChange={(event) => setSettings({ ...settings, description: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-intro">Вступительный текст</Label>
                  <Textarea
                    id="edit-intro"
                    rows={4}
                    value={settings.intro_text ?? ""}
                    onChange={(event) => setSettings({ ...settings, intro_text: event.target.value })}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-status">Статус</Label>
                    <Select
                      value={settings.status}
                      onValueChange={(value) => setSettings({ ...settings, status: value as QuizStatus })}
                    >
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUIZ_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-sort">Порядок отображения</Label>
                    <Input
                      id="edit-sort"
                      type="number"
                      value={settings.sort_order}
                      onChange={(event) =>
                        setSettings({
                          ...settings,
                          sort_order: Number.parseInt(event.target.value, 10) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="questions" className="space-y-4">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleAddQuestion}
                disabled={addingQuestion}
                className="gap-2"
              >
                <Plus className="size-4" />
                {addingQuestion ? "Добавление…" : "Добавить вопрос"}
              </Button>
              <Button
                onClick={handleSaveQuestions}
                disabled={savingQuestions || items.length === 0}
                className="gap-2"
              >
                <Save className="size-4" />
                {savingQuestions ? "Сохранение…" : "Сохранить вопросы"}
              </Button>
            </div>

            {items.length === 0 ? (
              <EmptyState
                title="Вопросов пока нет"
                description="Добавьте первый вопрос — к нему автоматически создадутся 4 варианта ответа."
              />
            ) : (
              items.map((question, index) => (
                <Card key={question.id} className="rounded-2xl border-border/60 shadow-card">
                  <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                        {index + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`active-${question.id}`}
                          checked={question.is_active}
                          onCheckedChange={(checked) =>
                            updateQuestion(question.id, { is_active: checked })
                          }
                        />
                        <Label htmlFor={`active-${question.id}`} className="text-sm text-muted-foreground">
                          {question.is_active ? "Активен" : "Отключён"}
                        </Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Переместить выше"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Переместить ниже"
                        disabled={index === items.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`text-${question.id}`}>Текст вопроса</Label>
                      <Textarea
                        id={`text-${question.id}`}
                        value={question.text}
                        onChange={(event) =>
                          updateQuestion(question.id, { text: event.target.value })
                        }
                        rows={2}
                      />
                    </div>
                    <div className="space-y-3">
                      {question.options.map((option) => (
                        <div key={option.id} className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`opt-${option.id}`} className="text-xs text-muted-foreground">
                              Вариант {option.option_number}
                            </Label>
                            <Badge variant="secondary" className="text-xs">
                              {RESULT_TYPE_LABELS[option.result_type] ?? option.result_type} ·{" "}
                              {option.result_type}
                            </Badge>
                          </div>
                          <Input
                            id={`opt-${option.id}`}
                            value={option.text}
                            onChange={(event) =>
                              updateOption(question.id, option.id, event.target.value)
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <div className="flex justify-end">
              <Button
                className="gap-2"
                onClick={() => {
                  setCreatingResult(true);
                  setEditingResult({
                    id: "",
                    result_type: "",
                    title: "",
                    short_description: "",
                    full_description: "",
                    recommendation: "",
                    is_active: true,
                  });
                }}
              >
                <Plus className="size-4" />
                Добавить тип результата
              </Button>
            </div>

            {!resultsQuery.data?.length ? (
              <EmptyState
                title="Типы результатов не настроены"
                description="Добавьте типы результата для этого теста — они используются в вариантах ответов и предпросмотре."
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {resultsQuery.data.map((result) => (
                  <Card key={result.id} className="flex flex-col rounded-2xl border-border/60 shadow-card">
                    <CardHeader className="space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <CardTitle className="text-lg">{result.title}</CardTitle>
                        <Badge variant={result.is_active ? "default" : "secondary"}>
                          {result.is_active ? "Активен" : "Отключён"}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="w-fit font-mono text-xs">
                        {result.result_type}
                      </Badge>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-4">
                      <div className="space-y-3 text-sm">
                        <p className="text-muted-foreground">{result.short_description}</p>
                        <p className="text-xs text-muted-foreground">{QUIZ_DISCLAIMER}</p>
                      </div>
                      <Button
                        variant="outline"
                        className="w-fit gap-2"
                        onClick={() => {
                          setCreatingResult(false);
                          setEditingResult(result);
                        }}
                      >
                        <Pencil className="size-4" />
                        Редактировать
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={editingResult !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingResult(null);
            setCreatingResult(false);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {creatingResult ? "Новый тип результата" : "Редактирование результата"}
            </DialogTitle>
            <DialogDescription>
              {creatingResult ? (
                "Системный тип будет сохранён как уникальный ключ внутри этого теста."
              ) : (
                <>
                  Системный тип: <span className="font-mono">{editingResult?.result_type}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingResult ? (
            <div className="space-y-4">
              {creatingResult ? (
                <div className="space-y-2">
                  <Label htmlFor="result-type">Системный тип</Label>
                  <Input
                    id="result-type"
                    value={editingResult.result_type}
                    onChange={(event) =>
                      setEditingResult({ ...editingResult, result_type: event.target.value })
                    }
                    placeholder="например: strong"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="result-title">Название</Label>
                <Input
                  id="result-title"
                  value={editingResult.title}
                  onChange={(event) => setEditingResult({ ...editingResult, title: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-short">Короткое описание</Label>
                <Textarea
                  id="result-short"
                  rows={2}
                  value={editingResult.short_description ?? ""}
                  onChange={(event) =>
                    setEditingResult({ ...editingResult, short_description: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-full">Полная расшифровка</Label>
                <Textarea
                  id="result-full"
                  rows={6}
                  value={editingResult.full_description ?? ""}
                  onChange={(event) =>
                    setEditingResult({ ...editingResult, full_description: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-rec">Рекомендация</Label>
                <Textarea
                  id="result-rec"
                  rows={3}
                  value={editingResult.recommendation ?? ""}
                  onChange={(event) =>
                    setEditingResult({ ...editingResult, recommendation: event.target.value })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="result-active"
                  checked={editingResult.is_active}
                  onCheckedChange={(checked) =>
                    setEditingResult({ ...editingResult, is_active: checked })
                  }
                />
                <Label htmlFor="result-active">Результат активен</Label>
              </div>
              <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                {QUIZ_DISCLAIMER}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setEditingResult(null);
                setCreatingResult(false);
              }}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveResult} disabled={savingResult}>
              {savingResult ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
