export const RESULT_TYPES = ["strong", "rescuer", "good_girl", "invisible"] as const;

export type ResultType = (typeof RESULT_TYPES)[number];

export const RESULT_TYPE_LABELS: Record<string, string> = {
  strong: "Сильная женщина",
  rescuer: "Спасательница",
  good_girl: "Хорошая девочка",
  invisible: "Невидимка",
};

export const QUIZ_DISCLAIMER =
  "Этот тест носит развлекательный и ознакомительный характер и не заменяет консультацию специалиста.";

export type QuizOption = {
  id: string;
  question_id: string;
  option_number: number;
  text: string;
  result_type: string;
};

export type QuizQuestion = {
  id: string;
  question_number: number;
  text: string;
  is_active: boolean;
};

export type QuizQuestionWithOptions = QuizQuestion & { options: QuizOption[] };

export type QuizScore = {
  counts: Record<string, number>;
  result_type: ResultType | null;
  secondary_result_type: ResultType | null;
};

/**
 * Подсчёт результата теста. Никаких диагнозов — только частота выбранных типов.
 */
export function scoreAnswers(answers: string[]): QuizScore {
  const counts: Record<string, number> = {};
  for (const type of RESULT_TYPES) counts[type] = 0;
  for (const answer of answers) {
    if (answer in counts) counts[answer] = (counts[answer] ?? 0) + 1;
  }

  const ranked = RESULT_TYPES.filter((type) => (counts[type] ?? 0) > 0).sort(
    (a, b) => (counts[b] ?? 0) - (counts[a] ?? 0),
  );

  const primary = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const isTie =
    primary !== null && runnerUp !== null && (counts[primary] ?? 0) === (counts[runnerUp] ?? 0);

  return {
    counts,
    result_type: primary,
    secondary_result_type: isTie ? runnerUp : null,
  };
}
