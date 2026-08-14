import type { Database } from "@/integrations/supabase/types";

export type QuizStatus = Database["public"]["Enums"]["quiz_status"];

export const QUIZ_STATUS_LABELS: Record<QuizStatus, string> = {
  draft: "Черновик",
  published: "Активен",
  archived: "Архив",
};

export const QUIZ_STATUS_OPTIONS: { value: QuizStatus; label: string }[] = [
  { value: "draft", label: "Черновик" },
  { value: "published", label: "Активен" },
  { value: "archived", label: "Архив" },
];

export function quizStatusBadgeVariant(
  status: QuizStatus,
): "default" | "secondary" | "outline" {
  if (status === "published") return "default";
  if (status === "archived") return "outline";
  return "secondary";
}

/** Транслитерация названия в URL-slug. */
export function slugifyTitle(title: string): string {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  const base = title
    .trim()
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `quiz-${Date.now()}`;
}

export function isQuizId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
