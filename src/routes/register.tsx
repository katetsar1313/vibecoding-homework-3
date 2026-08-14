import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Регистрация администратора — Честно о себе | Тесты" },
      {
        name: "description",
        content:
          "Создание первой учётной записи администратора панели управления чат-ботом «Честно о себе».",
      },
      { property: "og:title", content: "Регистрация администратора — Честно о себе" },
      {
        property: "og:description",
        content: "Создайте первую учётную запись администратора панели управления тестами.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    supabase.rpc("admin_exists").then(({ data }) => setAdminExists(Boolean(data)));
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.session) {
        toast.success("Администратор создан");
        navigate({ to: "/dashboard", replace: true });
      } else {
        toast.success("Проверьте почту и подтвердите адрес, чтобы войти.");
        navigate({ to: "/", replace: true });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось создать администратора",
      );
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
          <h1 className="mt-4 text-2xl font-semibold">Регистрация администратора</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Создайте учётную запись для панели управления
          </p>
        </div>

        {adminExists ? (
          <div className="mt-8 space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Администратор уже создан. Регистрация закрыта.
            </p>
            <Button asChild className="w-full">
              <Link to="/">Перейти ко входу</Link>
            </Button>
          </div>
        ) : (
          <>
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
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Повтор пароля</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Подождите…" : "Создать администратора"}
              </Button>
            </form>

            <Link
              to="/"
              className="mt-6 block w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              У меня уже есть доступ — войти
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
