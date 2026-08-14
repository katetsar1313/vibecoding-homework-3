import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  QUIZ_STATUS_OPTIONS,
  slugifyTitle,
  type QuizStatus,
} from "@/lib/quiz-admin";

export const Route = createFileRoute("/_authenticated/quizzes/new")({
  head: () => ({
    meta: [
      { title: "Новый тест — Честно о себе | Тесты" },
      { name: "description", content: "Создание нового теста." },
      { property: "og:title", content: "Новый тест — Честно о себе | Тесты" },
      { property: "og:description", content: "Создание нового теста." },
    ],
  }),
  component: QuizNewPage,
});

async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const { data, error } = await supabase.from("quizzes").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }
  return `${base}-${Date.now()}`;
}

function QuizNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [introText, setIntroText] = useState("");
  const [status, setStatus] = useState<QuizStatus>("draft");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Название теста не может быть пустым");
      return;
    }
    const order = Number.parseInt(sortOrder, 10);
    if (!Number.isFinite(order)) {
      toast.error("Порядок отображения должен быть числом");
      return;
    }

    setSaving(true);
    try {
      const slug = await ensureUniqueSlug(slugifyTitle(title));
      const { data, error } = await supabase
        .from("quizzes")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          intro_text: introText.trim() || null,
          status,
          is_active: status === "published",
          sort_order: order,
          slug,
          requires_subscription: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Тест создан");
      await navigate({ to: "/quizzes/edit", search: { id: data.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать тест");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Новый тест"
        description="Основные параметры. Вопросы и результаты добавляются на странице редактирования."
        action={
          <div className="flex gap-2">
            <Button asChild variant="ghost" className="gap-2">
              <Link to="/quizzes">
                <ArrowLeft className="size-4" />
                Назад
              </Link>
            </Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              <Save className="size-4" />
              {saving ? "Создание…" : "Создать"}
            </Button>
          </div>
        }
      />

      <Card className="rounded-2xl border-border/60 shadow-card">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="quiz-title">Название</Label>
            <Input
              id="quiz-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: Какую роль ты устала играть?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-description">Короткое описание</Label>
            <Textarea
              id="quiz-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-intro">Вступительный текст</Label>
            <Textarea
              id="quiz-intro"
              rows={4}
              value={introText}
              onChange={(event) => setIntroText(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiz-status">Статус</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as QuizStatus)}>
                <SelectTrigger id="quiz-status">
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
              <Label htmlFor="quiz-sort">Порядок отображения</Label>
              <Input
                id="quiz-sort"
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
