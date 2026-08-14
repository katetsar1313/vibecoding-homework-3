import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

function safeNext(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : undefined;
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const next = safeNext(search["next"]);
    return next ? { next } : {};
  },
  head: () => ({
    meta: [
      { title: "Вход администратора — Честно о себе | Тесты" },
      {
        name: "description",
        content:
          "Вход в административную панель бота «Честно о себе»: тесты, пользователи, рефералы и настройки.",
      },
      { property: "og:title", content: "Вход администратора — Честно о себе | Тесты" },
      {
        property: "og:description",
        content: "Защищённая панель управления чат-ботом психологических тестов.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch() as { next?: string };
  const next = safeNext(search.next);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (next) window.location.href = next;
        else navigate({ to: "/dashboard", replace: true });
      }
    });
    supabase.rpc("admin_exists").then(({ data }) => setAdminExists(Boolean(data)));
  }, [navigate, next]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (next) window.location.href = next;
      else navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      setLoading(false);
    }
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-soft px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground">
            <Sparkles className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold">Честно о себе</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Панель администратора чат-бота с тестами
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Электронная почта</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Подождите…" : "Войти"}
          </Button>
        </form>

        {adminExists === false && (
          <Link
            to="/register"
            className="mt-6 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            Первый вход? Зарегистрировать администратора
          </Link>
        )}


        <p className="mt-6 text-center text-xs text-muted-foreground">
          Канал «Чудеса за полчаса» ·{" "}
          <Link to="/" className="hover:text-primary">
            Честно о себе
          </Link>
        </p>
      </div>
    </main>
  );
}
