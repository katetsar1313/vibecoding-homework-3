import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { PageHeader, EmptyState } from "@/components/admin/page-shell";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { QUIZ_DISCLAIMER, RESULT_TYPES } from "@/lib/quiz";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({
    meta: [
      { title: "Результаты — Честно о себе | Тесты" },
      { name: "description", content: "Типы результатов теста, описания и рекомендации." },
      { property: "og:title", content: "Результаты — Честно о себе | Тесты" },
      { property: "og:description", content: "Типы результатов теста, описания и рекомендации." },
    ],
  }),
  component: ResultsPage,
});

type ResultRow = {
  id: string;
  result_type: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  recommendation: string | null;
  is_active: boolean;
};

function ResultsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ResultRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["quiz-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_results")
        .select("id, result_type, title, short_description, full_description, recommendation, is_active");
      if (error) throw error;
      const order = RESULT_TYPES as readonly string[];
      return [...((data ?? []) as ResultRow[])].sort(
        (a, b) => order.indexOf(a.result_type) - order.indexOf(b.result_type),
      );
    },
  });

  async function handleSave() {
    if (!editing) return;
    if (!editing.title.trim()) {
      toast.error("Название результата не может быть пустым");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("quiz_results")
        .update({
          title: editing.title.trim(),
          short_description: editing.short_description?.trim() || null,
          full_description: editing.full_description?.trim() || null,
          recommendation: editing.recommendation?.trim() || null,
          is_active: editing.is_active,
        })
        .eq("id", editing.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["quiz-results"] });
      await queryClient.invalidateQueries({ queryKey: ["quiz-preview"] });
      toast.success("Результат сохранён");
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить результат");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Результаты" description="Типы результатов, описания и рекомендации." />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : !data?.length ? (
        <EmptyState
          title="Результаты не настроены"
          description="Тексты результатов появятся здесь после заполнения базы."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((result) => (
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
                <Button variant="outline" className="w-fit gap-2" onClick={() => setEditing(result)}>
                  <Pencil className="size-4" />
                  Редактировать
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? null : setEditing(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактирование результата</DialogTitle>
            <DialogDescription>
              Системный тип: <span className="font-mono">{editing?.result_type}</span>
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="result-title">Название</Label>
                <Input
                  id="result-title"
                  value={editing.title}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-short">Короткое описание</Label>
                <Textarea
                  id="result-short"
                  rows={2}
                  value={editing.short_description ?? ""}
                  onChange={(event) => setEditing({ ...editing, short_description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-full">Полная расшифровка</Label>
                <Textarea
                  id="result-full"
                  rows={6}
                  value={editing.full_description ?? ""}
                  onChange={(event) => setEditing({ ...editing, full_description: event.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="result-rec">Рекомендация</Label>
                <Textarea
                  id="result-rec"
                  rows={3}
                  value={editing.recommendation ?? ""}
                  onChange={(event) => setEditing({ ...editing, recommendation: event.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="result-active"
                  checked={editing.is_active}
                  onCheckedChange={(checked) => setEditing({ ...editing, is_active: checked })}
                />
                <Label htmlFor="result-active">Результат активен</Label>
              </div>
              <p className="rounded-xl bg-secondary/60 p-3 text-xs text-muted-foreground">
                {QUIZ_DISCLAIMER}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
