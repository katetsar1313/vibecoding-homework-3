import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Проверка роли admin на сервере. */
async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data, error } = await (context.supabase as any).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Доступ только для администратора");
}

export type ChannelSettings = {
  channelName: string;
  channelUrl: string;
  channelChatId: string;
  hasBotToken: boolean;
  hasWebhookSecret: boolean;
  webhookUrl: string;
};

export const getMaxSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChannelSettings> => {
    await assertAdmin(context as never);
    const { getSetting } = await import("./max.server");

    const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
    const proto = getRequestHeader("x-forwarded-proto") ?? "https";

    return {
      channelName: (await getSetting("CHANNEL_NAME")) ?? "Чудеса за полчаса",
      channelUrl: (await getSetting("CHANNEL_URL")) ?? "",
      channelChatId: (await getSetting("CHANNEL_CHAT_ID")) ?? "",
      hasBotToken: Boolean(process.env["MAX_BOT_TOKEN"]),
      hasWebhookSecret: Boolean(process.env["MAX_WEBHOOK_SECRET"]),
      webhookUrl: host ? `${proto}://${host}/api/public/max-webhook` : "",
    };
  });

export const saveChannelSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { channelUrl: string; channelChatId: string }) => ({
    channelUrl: String(input?.channelUrl ?? "").trim(),
    channelChatId: String(input?.channelChatId ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (data.channelUrl && !/^https?:\/\//i.test(data.channelUrl)) {
      throw new Error("Ссылка на канал должна начинаться с https://");
    }
    const { setSetting, logEvent } = await import("./max.server");
    await setSetting("CHANNEL_URL", data.channelUrl, "Ссылка на канал «Чудеса за полчаса»");
    await setSetting("CHANNEL_CHAT_ID", data.channelChatId, "ID чата канала в MAX");
    await logEvent({ eventType: "settings_updated", description: "Обновлены настройки канала" });
    return { ok: true };
  });

export const checkMaxToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    console.log("[MAX] check-token: функция запущена");
    await assertAdmin(context as never);

    if (!process.env["MAX_BOT_TOKEN"]) {
      console.error("[MAX] check-token: MAX_BOT_TOKEN не найден");
      return { ok: false as const, message: "MAX_BOT_TOKEN не найден" };
    }
    console.log("[MAX] check-token: токен найден в серверных секретах");

    const { maxFetch } = await import("./max.server");
    try {
      const bot = await maxFetch<{
        user_id?: number;
        name?: string;
        first_name?: string;
        username?: string;
        description?: string;
      }>({ path: "/me" });
      console.log("[MAX] check-token: успешно, бот получен");
      return {
        ok: true as const,
        status: "MAX API подключён",
        bot: {
          userId: bot.user_id ? String(bot.user_id) : "—",
          name: bot.first_name ?? bot.name ?? "—",
          username: bot.username ?? "—",
          description: bot.description ?? "—",
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось проверить токен";
      console.error(`[MAX] check-token: неуспешно — ${message}`);
      return { ok: false as const, message };
    }
  });

export const getMaxSubscriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { maxFetch } = await import("./max.server");
    try {
      const data = await maxFetch<{
        subscriptions?: Array<{ url?: string; update_types?: string[]; time?: number }>;
      }>({ path: "/subscriptions" });
      return {
        ok: true as const,
        checkedAt: new Date().toISOString(),
        subscriptions: (data.subscriptions ?? []).map((s) => ({
          url: s.url ?? "—",
          updateTypes: s.update_types ?? [],
          state: "активна",
        })),
      };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Не удалось получить подписки",
      };
    }
  });

export const setupMaxWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirm: boolean; webhookUrl?: string }) => ({
    confirm: Boolean(input?.confirm),
    webhookUrl: String(input?.webhookUrl ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.confirm) throw new Error("Требуется подтверждение администратора");

    const { maxFetch, getWebhookSecret, logEvent, MAX_UPDATE_TYPES } = await import("./max.server");

    const host = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? "";
    const proto = getRequestHeader("x-forwarded-proto") ?? "https";
    const url = data.webhookUrl || (host ? `${proto}://${host}/api/public/max-webhook` : "");
    if (!/^https:\/\//i.test(url)) {
      return { ok: false as const, message: "Нужен публичный HTTPS-адрес webhook." };
    }

    try {
      await maxFetch({
        path: "/subscriptions",
        method: "POST",
        body: { url, update_types: [...MAX_UPDATE_TYPES], secret: getWebhookSecret() },
      });
      await logEvent({ eventType: "webhook_connected", description: `Webhook подключён: ${url}` });
      return { ok: true as const, message: `Webhook подключён: ${url}` };
    } catch (error) {
      return {
        ok: false as const,
        message: error instanceof Error ? error.message : "Не удалось подключить webhook",
      };
    }
  });

export const checkChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { getSetting, maxFetch } = await import("./max.server");
    const chatId = await getSetting("CHANNEL_CHAT_ID");
    if (!chatId) {
      return {
        ok: false as const,
        message:
          "CHANNEL_CHAT_ID не заполнен. Добавьте бота администратором канала — идентификатор появится автоматически.",
      };
    }
    try {
      const chat = await maxFetch<{ title?: string; participants_count?: number }>({
        path: `/chats/${encodeURIComponent(chatId)}`,
      });
      return {
        ok: true as const,
        message: `Канал доступен: ${chat.title ?? chatId}${
          chat.participants_count ? ` · участников: ${chat.participants_count}` : ""
        }`,
      };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof Error
            ? `${error.message} Убедитесь, что бот добавлен администратором канала.`
            : "Канал недоступен",
      };
    }
  });

export const checkUserSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { maxUserId: string }) => ({
    maxUserId: String(input?.maxUserId ?? "").trim(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    if (!data.maxUserId) throw new Error("Нужен MAX user ID");
    const { checkSubscription } = await import("./max.server");
    return checkSubscription(data.maxUserId);
  });
