import { createServerFn } from "@tanstack/react-start";

import { scoreAnswers, type QuizScore } from "./quiz";

/**
 * Серверный подсчёт результата теста.
 * Принимает список системных типов выбранных ответов и возвращает основной
 * и (при равенстве баллов) второй ведущий тип. Ничего не записывает в базу
 * и не выдаёт медицинских или психологических диагнозов.
 */
export const calculateQuizResult = createServerFn({ method: "POST" })
  .inputValidator((input: { answers: string[] }) => {
    if (!input || !Array.isArray(input.answers)) {
      throw new Error("Ожидается список ответов");
    }
    return { answers: input.answers.filter((a) => typeof a === "string") };
  })
  .handler(async ({ data }): Promise<QuizScore> => scoreAnswers(data.answers));
