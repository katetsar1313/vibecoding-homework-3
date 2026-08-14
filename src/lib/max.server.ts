// Серверный модуль работы с MAX API. Никогда не импортируется в браузерный код.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const MAX_API_BASE = "https://platform-api2.max.ru";
const MAX_TIMEOUT_MS = 15_000;

export const MAX_UPDATE_TYPES = [
  "bot_started",
  "message_created",
  "message_callback",
  "bot_added",
  "bot_removed",
  "bot_stopped",
  "user_added",
  "user_removed",
] as const;

export function getBotToken(): string {
  const token = process.env["MAX_BOT_TOKEN"];
  if (!token) throw new Error("MAX_BOT_TOKEN не найден");
  return token;
}

export function getWebhookSecret(): string {
  const secret = process.env["MAX_WEBHOOK_SECRET"];
  if (!secret) throw new Error("Секрет MAX_WEBHOOK_SECRET не добавлен");
  return secret;
}

/** Понятное сообщение об ошибке без секретов и сырого ответа MAX. */
export function humanError(status: number): string {
  if (status === 401) return "MAX API вернул 401: токен бота отклонён.";
  if (status === 403) return "MAX API вернул 403: у бота недостаточно прав.";
  if (status === 404) return "Запрошенный ресурс в MAX не найден.";
  if (status === 429) return "Слишком много запросов к MAX. Повторите чуть позже.";
  if (status >= 500) return `Сервис MAX временно недоступен (код ${status}).`;
  return `MAX вернул ошибку (код ${status}).`;
}

/** Классификация сетевой ошибки без раскрытия секретов. */
export function networkError(error: unknown): string {
  const raw = `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)} ${
    error instanceof Error && error.cause ? String((error.cause as Error).message ?? "") : ""
  }`.toLowerCase();

  if (raw.includes("abort") || raw.includes("timeout") || raw.includes("etimedout")) {
    return "Превышено время ожидания ответа MAX.";
  }
  if (
    raw.includes("certificate") ||
    raw.includes("tls") ||
    raw.includes("ssl") ||
    raw.includes("self-signed") ||
    raw.includes("handshake")
  ) {
    return "Ошибка TLS-соединения с MAX.";
  }
  if (raw.includes("enotfound") || raw.includes("dns") || raw.includes("getaddrinfo")) {
    return "Не удалось определить адрес сервера MAX (ошибка DNS).";
  }
  if (raw.includes("econnrefused") || raw.includes("econnreset") || raw.includes("network")) {
    return "Сетевая ошибка при обращении к MAX.";
  }
  return "Не удалось соединиться с MAX API.";
}

type MaxRequest = {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string>;
};

export async function maxFetch<T>({ path, method = "GET", body, query }: MaxRequest): Promise<T> {
  const token = getBotToken();
  const url = new URL(`${MAX_API_BASE}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);

  let response: Response;
  try {
    console.log(`[MAX] запрос ${method} ${path} → ${new URL(MAX_API_BASE).host}`);
    response = await fetch(url.toString(), {
      method,
      headers: {
        // Токен передаётся как есть, без префикса Bearer.
        Authorization: token,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(MAX_TIMEOUT_MS),
    });
  } catch (error) {
    const message = networkError(error);
    console.error(
      `[MAX] сетевая ошибка ${new URL(MAX_API_BASE).host}: ${message} (${
        error instanceof Error ? error.name : "unknown"
      })`,
    );
    throw new Error(message);
  }

  console.log(`[MAX] ${method} ${path} ← HTTP ${response.status} (${new URL(MAX_API_BASE).host})`);
  if (!response.ok) throw new Error(humanError(response.status));
  return (await response.json()) as T;
}

/** Значение настройки из таблицы settings. */
export async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("settings").select("value").eq("key", key).maybeSingle();
  return data?.value?.trim() ? data.value.trim() : null;
}

export async function setSetting(key: string, value: string, description?: string) {
  const { data } = await supabaseAdmin.from("settings").select("id").eq("key", key).maybeSingle();
  if (data) {
    await supabaseAdmin.from("settings").update({ value }).eq("key", key);
  } else {
    await supabaseAdmin.from("settings").insert({ key, value, description: description ?? null });
  }
}

/** Безопасная запись события: без токенов и секретов, с защитой от дублей. */
export async function logEvent(params: {
  eventType: string;
  description?: string;
  payload?: Record<string, unknown>;
  userId?: string | null;
  externalId?: string | null;
}) {
  const { error } = await supabaseAdmin.from("event_log").insert({
    event_type: params.eventType,
    description: params.description ?? null,
    payload: (params.payload ?? {}) as never,
    user_id: params.userId ?? null,
    external_id: params.externalId ?? null,
  });
  // Конфликт по external_id означает повторную доставку — это не ошибка.
  if (error && error.code !== "23505") console.error("[MAX] event_log insert failed", error.code);
  return !error;
}

// ---------- Отправка сообщений ----------

export type MaxButton =
  | { type: "callback"; text: string; payload: string }
  | { type: "link"; text: string; url: string };

const lastSentAt = new Map<string, number>();
const MIN_INTERVAL_MS = 500; // не более двух сообщений в секунду одному пользователю

async function throttle(userId: string) {
  const prev = lastSentAt.get(userId) ?? 0;
  const wait = prev + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastSentAt.set(userId, Date.now());
}

export async function sendMaxMessage(params: {
  userId: string;
  text: string;
  keyboard?: MaxButton[][];
}): Promise<{ ok: boolean; error?: string }> {
  await throttle(params.userId);

  const body: Record<string, unknown> = { text: params.text };
  if (params.keyboard?.length) {
    body["attachments"] = [
      { type: "inline_keyboard", payload: { buttons: params.keyboard } },
    ];
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await maxFetch({
        path: "/messages",
        method: "POST",
        query: { user_id: params.userId },
        body,
      });
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось отправить сообщение";
      const temporary = message.includes("временно") || message.includes("Слишком много");
      if (!temporary || attempt === 2) {
        console.error("[MAX] send failed");
        return { ok: false, error: message };
      }
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  return { ok: false, error: "Не удалось отправить сообщение" };
}

// ---------- Проверка подписки на канал ----------

export async function checkSubscription(maxUserId: string): Promise<{
  ok: boolean;
  subscribed?: boolean;
  message: string;
}> {
  const chatId = await getSetting("CHANNEL_CHAT_ID");
  if (!chatId) {
    return {
      ok: false,
      message:
        "CHANNEL_CHAT_ID не заполнен. Добавьте бота администратором канала — идентификатор определится автоматически.",
    };
  }

  try {
    const data = await maxFetch<{ members?: Array<{ user_id?: number | string }> }>({
      path: `/chats/${encodeURIComponent(chatId)}/members`,
      query: { user_ids: maxUserId },
    });
    const subscribed = (data.members ?? []).some((m) => String(m.user_id) === String(maxUserId));

    await supabaseAdmin
      .from("users")
      .update({ subscribed_to_channel: subscribed })
      .eq("max_user_id", String(maxUserId));

    return {
      ok: true,
      subscribed,
      message: subscribed ? "Подписка подтверждена." : "Пользователь не найден среди участников канала.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `${error.message} Убедитесь, что бот добавлен администратором канала.`
          : "Не удалось проверить подписку.",
    };
  }
}
