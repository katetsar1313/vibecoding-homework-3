import { createFileRoute } from "@tanstack/react-router";

/**
 * Публичный приёмник событий MAX.
 * Запросы приходят от серверов MAX, поэтому пользовательская авторизация не
 * применяется — вместо неё проверяется заголовок X-Max-Bot-Api-Secret.
 * Секрет никогда не пишется в логи.
 */
export const Route = createFileRoute("/api/public/max-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["MAX_WEBHOOK_SECRET"];
        const provided = request.headers.get("X-Max-Bot-Api-Secret");
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let update: Record<string, any>;
        try {
          update = (await request.json()) as Record<string, any>;
        } catch {
          return new Response("Bad Request", { status: 400 });
        }

        // Отвечаем максимально быстро; обработка ошибок не блокирует ответ 200.
        try {
          await handleUpdate(update);
        } catch (error) {
          console.error("[MAX webhook] обработка не удалась", error instanceof Error ? error.message : "");
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

const KNOWN_TYPES = new Set([
  "bot_started",
  "message_created",
  "message_callback",
  "bot_added",
  "bot_removed",
  "bot_stopped",
  "user_added",
  "user_removed",
]);

/** Безопасная выборка полей payload — без токенов и секретов. */
function safePayload(update: Record<string, any>) {
  const chatId = update["chat_id"] ?? update["chat"]?.["chat_id"] ?? null;
  const user = update["user"] ?? update["message"]?.["sender"] ?? null;
  return {
    chat_id: chatId ? String(chatId) : null,
    is_channel: Boolean(update["is_channel"] ?? update["chat"]?.["type"] === "channel"),
    user_id: user?.["user_id"] ? String(user["user_id"]) : null,
    username: user?.["username"] ?? null,
    first_name: user?.["name"] ?? user?.["first_name"] ?? null,
    text: update["message"]?.["body"]?.["text"] ?? null,
    payload: update["callback"]?.["payload"] ?? null,
    timestamp: update["timestamp"] ?? null,
  };
}

async function handleUpdate(update: Record<string, any>) {
  const type = String(update["update_type"] ?? "unknown");
  if (!KNOWN_TYPES.has(type)) return;

  const { logEvent, getSetting, setSetting } = await import("@/lib/max.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const safe = safePayload(update);
  const externalId = `${type}:${safe.timestamp ?? ""}:${safe.user_id ?? ""}:${safe.chat_id ?? ""}`;

  const inserted = await logEvent({
    eventType: type,
    description: describe(type, safe),
    payload: safe,
    externalId,
  });
  if (!inserted) return; // повторная доставка того же события

  if (type === "bot_added" && safe.is_channel && safe.chat_id) {
    const existing = await getSetting("CHANNEL_CHAT_ID");
    if (!existing) {
      await setSetting("CHANNEL_CHAT_ID", safe.chat_id, "ID чата канала в MAX");
    }
    await logEvent({
      eventType: "channel_bot_added",
      description: "Бот обнаружен в канале",
      payload: { chat_id: safe.chat_id },
    });
  }

  if (type === "bot_removed") {
    await logEvent({
      eventType: "channel_bot_removed",
      description: "Бот удалён из канала",
      payload: { chat_id: safe.chat_id },
    });
  }

  if ((type === "user_added" || type === "user_removed") && safe.user_id) {
    const channelChatId = await getSetting("CHANNEL_CHAT_ID");
    if (channelChatId && safe.chat_id === channelChatId) {
      await supabaseAdmin
        .from("users")
        .update({ subscribed_to_channel: type === "user_added" })
        .eq("max_user_id", safe.user_id);
    }
  }
}

function describe(type: string, safe: ReturnType<typeof safePayload>) {
  switch (type) {
    case "bot_started":
      return "Пользователь запустил бота";
    case "message_created":
      return "Новое сообщение пользователя";
    case "message_callback":
      return "Нажата кнопка в сообщении";
    case "bot_added":
      return safe.is_channel ? "Бот обнаружен в канале" : "Бот добавлен в чат";
    case "bot_removed":
      return "Бот удалён из канала";
    case "bot_stopped":
      return "Пользователь остановил бота";
    case "user_added":
      return "Пользователь присоединился";
    case "user_removed":
      return "Пользователь вышел";
    default:
      return "Событие MAX";
  }
}
