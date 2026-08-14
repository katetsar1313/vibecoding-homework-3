import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getMaxSettings,
  saveChannelSettings,
  checkMaxToken,
  getMaxSubscriptions,
  setupMaxWebhook,
  checkChannel,
} from "@/lib/max.functions";

export const Route = createFileRoute("/_authenticated/max-settings")({
  head: () => ({
    meta: [
      { title: "Настройки MAX — Честно о себе | Тесты" },
      { name: "description", content: "Параметры интеграции чат-бота MAX и канала." },
      { property: "og:title", content: "Настройки MAX — Честно о себе | Тесты" },
      { property: "og:description", content: "Параметры интеграции чат-бота MAX и канала." },
    ],
  }),
  component: MaxSettingsPage,
});

type Status = { tone: "ok" | "error" | "idle"; text: string };

function StatusDot({ tone }: { tone: Status["tone"] }) {
  const color =
    tone === "ok" ? "bg-emerald-500" : tone === "error" ? "bg-rose-500" : "bg-muted-foreground/40";
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />;
}

function MaxSettingsPage() {
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getMaxSettings);
  const saveChannel = useServerFn(saveChannelSettings);
  const runCheckToken = useServerFn(checkMaxToken);
  const runGetSubs = useServerFn(getMaxSubscriptions);
  const runSetupWebhook = useServerFn(setupMaxWebhook);
  const runCheckChannel = useServerFn(checkChannel);

  const settingsQuery = useQuery({ queryKey: ["max-settings"], queryFn: () => fetchSettings() });

  const [channelUrl, setChannelUrl] = useState("");
  const [channelChatId, setChannelChatId] = useState("");
  const [status, setStatus] = useState<Status>({ tone: "idle", text: "Проверка не выполнялась" });
  const [details, setDetails] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      setChannelUrl(settingsQuery.data.channelUrl);
      setChannelChatId(settingsQuery.data.channelChatId);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => saveChannel({ data: { channelUrl, channelChatId } }),
    onSuccess: () => {
      toast.success("Настройки канала сохранены");
      queryClient.invalidateQueries({ queryKey: ["max-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const apiMutation = useMutation({
    mutationFn: async (action: "token" | "subs" | "webhook" | "channel") => {
      if (action === "token") return runCheckToken();
      if (action === "subs") return runGetSubs();
      if (action === "channel") return runCheckChannel();
      return runSetupWebhook({ data: { confirm: true } });
    },
    onSuccess: (result: any) => {
      if (!result.ok) {
        setStatus({ tone: "error", text: result.message });
        setDetails([]);
        return;
      }
      if (result.bot) {
        setStatus({ tone: "ok", text: result.status });
        setDetails([
          `user_id: ${result.bot.userId}`,
          `имя: ${result.bot.name}`,
          `username: ${result.bot.username}`,
          `описание: ${result.bot.description}`,
        ]);
        return;
      }
      if (result.subscriptions) {
        setStatus({
          tone: "ok",
          text: `Подписок найдено: ${result.subscriptions.length} · проверено ${new Date(
            result.checkedAt,
          ).toLocaleString("ru-RU")}`,
        });
        setDetails(
          result.subscriptions.length
            ? result.subscriptions.map(
                (s: any) => `${s.url} · ${s.state} · события: ${s.updateTypes.join(", ") || "—"}`,
              )
            : ["Активных webhook-подписок нет."],
        );
        return;
      }
      setStatus({ tone: "ok", text: result.message });
      setDetails([]);
      queryClient.invalidateQueries({ queryKey: ["max-settings"] });
    },
    onError: (error: Error) => {
      const raw = (error?.message ?? "").toLowerCase();
      const unreachable =
        raw.includes("fetch") || raw.includes("network") || raw.includes("failed to");
      setStatus({
        tone: "error",
        text: unreachable ? "Серверная функция недоступна" : error.message,
      });
      setDetails([]);
    },
  });

  const data = settingsQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки MAX"
        description="Параметры бота и канала «Чудеса за полчаса»."
      />

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Канал</CardTitle>
          <CardDescription>
            Канал «{data?.channelName ?? "Чудеса за полчаса"}». Чтобы проверка подписки работала, бот
            должен быть добавлен администратором канала.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="channel-url">CHANNEL_URL</Label>
                  <Input
                    id="channel-url"
                    value={channelUrl}
                    placeholder="https://max.ru/..."
                    onChange={(e) => setChannelUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel-chat-id">CHANNEL_CHAT_ID</Label>
                  <Input
                    id="channel-chat-id"
                    value={channelChatId}
                    placeholder="Определится автоматически"
                    onChange={(e) => setChannelChatId(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Сохранение…" : "Сохранить"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Секреты</CardTitle>
          <CardDescription>
            Значения секретов никогда не отображаются и хранятся только на сервере.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">MAX_BOT_TOKEN</span>
            <Badge variant={data?.hasBotToken ? "default" : "secondary"}>
              {data?.hasBotToken ? "добавлен" : "не добавлен"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">MAX_WEBHOOK_SECRET</span>
            <Badge variant={data?.hasWebhookSecret ? "default" : "secondary"}>
              {data?.hasWebhookSecret ? "добавлен" : "не добавлен"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Секреты добавляются только через защищённое окно Lovable Secrets — напишите в чате
            «Добавить секреты MAX», и откроется защищённая форма.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              toast.info(
                "Попросите в чате Lovable добавить MAX_BOT_TOKEN и MAX_WEBHOOK_SECRET — откроется защищённая форма.",
              )
            }
          >
            Добавить секреты
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>MAX API</CardTitle>
          <CardDescription>Все запросы выполняются только на сервере.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={apiMutation.isPending}
              onClick={() => apiMutation.mutate("token")}
            >
              Проверить токен
            </Button>
            <Button
              variant="outline"
              disabled={apiMutation.isPending}
              onClick={() => apiMutation.mutate("subs")}
            >
              Получить webhook-подписки
            </Button>
            <Button
              variant="outline"
              disabled={apiMutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Подключить webhook
            </Button>
            <Button
              variant="outline"
              disabled={apiMutation.isPending}
              onClick={() => apiMutation.mutate("channel")}
            >
              Проверить канал
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-card/60 p-4">
            <span className="mt-1.5">
              <StatusDot tone={apiMutation.isPending ? "idle" : status.tone} />
            </span>
            <div className="space-y-1 text-sm">
              <p>{apiMutation.isPending ? "Запрос выполняется…" : status.text}</p>
              {details.map((line) => (
                <p key={line} className="text-muted-foreground">
                  {line}
                </p>
              ))}
            </div>
          </div>

          {data?.webhookUrl ? (
            <p className="text-xs text-muted-foreground break-all">
              Адрес webhook: {data.webhookUrl}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подключить webhook MAX к этому проекту?</AlertDialogTitle>
            <AlertDialogDescription>
              MAX начнёт присылать события бота на адрес {data?.webhookUrl || "—"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={() => apiMutation.mutate("webhook")}>
              Подключить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
