import { supabase } from "@/integrations/supabase/client";

/** Стабильный id первого теста из миграции multi_quiz_foundation. */
export const LEGACY_QUIZ_ID = "b1e00000-4a5e-4f01-9c01-000000000001";

/** Эталонное содержимое теста «Какую роль ты устала играть?». */
export const SEED_SETTINGS: { key: string; value: string; description: string }[] = [
  { key: "quiz_title", value: "Какую роль ты устала играть?", description: "Название теста" },
  {
    key: "quiz_description",
    value:
      "Короткий развлекательный тест, который помогает заметить привычную жизненную роль. Тест не является психологической или медицинской диагностикой.",
    description: "Описание теста",
  },
  {
    key: "quiz_disclaimer",
    value:
      "Этот тест носит развлекательный и ознакомительный характер и не заменяет консультацию специалиста.",
    description: "Дисклеймер",
  },
];

export const SEED_QUESTIONS: {
  question_number: number;
  text: string;
  options: { option_number: number; result_type: string; text: string }[];
}[] = [
  {
    question_number: 1,
    text: "Когда у тебя начинается сложный период, ты чаще всего…",
    options: [
      { option_number: 1, result_type: "strong", text: "Собираюсь и решаю всё сама, даже если сил почти нет." },
      { option_number: 2, result_type: "rescuer", text: "Продолжаю помогать другим — у них ведь тоже проблемы." },
      { option_number: 3, result_type: "good_girl", text: "Стараюсь никому не показывать, что мне тяжело." },
      { option_number: 4, result_type: "invisible", text: "Закрываюсь и пропадаю из общения." },
    ],
  },
  {
    question_number: 2,
    text: "Когда близкий человек недоволен тобой, первая мысль обычно…",
    options: [
      { option_number: 1, result_type: "strong", text: "Хорошо, сама разберусь и всё исправлю." },
      { option_number: 2, result_type: "rescuer", text: "Наверное, я мало для него сделала." },
      { option_number: 3, result_type: "good_girl", text: "Только бы не было конфликта." },
      { option_number: 4, result_type: "invisible", text: "Лучше промолчу и отойду в сторону." },
    ],
  },
  {
    question_number: 3,
    text: "Что тебе сложнее всего сказать?",
    options: [
      { option_number: 1, result_type: "strong", text: "Я не справляюсь, помоги мне." },
      { option_number: 2, result_type: "rescuer", text: "Это не моя проблема." },
      { option_number: 3, result_type: "good_girl", text: "Нет, я этого не хочу." },
      { option_number: 4, result_type: "invisible", text: "Послушайте меня, мне важно высказаться." },
    ],
  },
  {
    question_number: 4,
    text: "Если у тебя неожиданно появляется свободный вечер, ты…",
    options: [
      { option_number: 1, result_type: "strong", text: "Сразу вспоминаю, что ещё нужно сделать." },
      { option_number: 2, result_type: "rescuer", text: "Думаю, кому из близких сейчас нужна помощь." },
      { option_number: 3, result_type: "good_girl", text: "Соглашаюсь на чужие планы, даже если хотела другого." },
      { option_number: 4, result_type: "invisible", text: "Остаюсь одна и стараюсь никого не беспокоить." },
    ],
  },
  {
    question_number: 5,
    text: "Как ты обычно реагируешь на похвалу?",
    options: [
      { option_number: 1, result_type: "strong", text: "Думаю: ничего особенного, просто сделала как надо." },
      { option_number: 2, result_type: "rescuer", text: "Радуюсь, если благодаря мне другому человеку стало лучше." },
      { option_number: 3, result_type: "good_girl", text: "Смущаюсь и стараюсь быстро сменить тему." },
      { option_number: 4, result_type: "invisible", text: "Не очень верю, что похвала искренняя." },
    ],
  },
  {
    question_number: 6,
    text: "Что сильнее всего выматывает тебя в отношениях?",
    options: [
      { option_number: 1, result_type: "strong", text: "Ощущение, что всё держится только на мне." },
      { option_number: 2, result_type: "rescuer", text: "Постоянная необходимость спасать и поддерживать." },
      { option_number: 3, result_type: "good_girl", text: "Страх кого-то расстроить или разочаровать." },
      { option_number: 4, result_type: "invisible", text: "Ощущение, что меня будто не замечают." },
    ],
  },
  {
    question_number: 7,
    text: "Какую фразу ты говоришь себе чаще всего?",
    options: [
      { option_number: 1, result_type: "strong", text: "Ничего, я справлюсь." },
      { option_number: 2, result_type: "rescuer", text: "Кроме меня ему никто не поможет." },
      { option_number: 3, result_type: "good_girl", text: "Лучше уступить, чтобы не было ссоры." },
      { option_number: 4, result_type: "invisible", text: "Мои желания всё равно никому не интересны." },
    ],
  },
];

export const SEED_RESULTS: {
  result_type: string;
  title: string;
  short_description: string;
  full_description: string;
  recommendation: string;
}[] = [
  {
    result_type: "strong",
    title: "Сильная женщина",
    short_description:
      "Ты привыкла справляться сама и сохранять контроль, даже когда сил почти не осталось.",
    full_description:
      "Ты умеешь собираться в сложных обстоятельствах, быстро принимать решения и быть опорой для себя и других. Это действительно сильная сторона. Но иногда привычка всё выдерживать самостоятельно превращается в роль, из которой трудно выйти.",
    recommendation:
      "Попробуй начать с маленькой просьбы о помощи и не объяснять, почему ты не справилась сама.",
  },
  {
    result_type: "rescuer",
    title: "Спасательница",
    short_description:
      "Ты тонко чувствуешь чужие переживания и часто ставишь потребности близких выше собственных.",
    full_description:
      "Ты умеешь поддержать, выслушать и найти решение, когда другому человеку плохо. Но постоянная готовность спасать может незаметно лишать тебя времени, энергии и права заниматься собственной жизнью.",
    recommendation:
      "Перед тем как бросаться решать чужую проблему, спроси себя: меня попросили о помощи или я снова взяла ответственность автоматически?",
  },
  {
    result_type: "good_girl",
    title: "Хорошая девочка",
    short_description:
      "Ты стараешься никого не расстраивать, избегать конфликтов и оставаться удобной для окружающих.",
    full_description:
      "Ты умеешь находить компромиссы и внимательно относишься к чувствам людей. Но желание сохранить мир любой ценой может заставлять тебя соглашаться на то, чего ты не хочешь.",
    recommendation:
      "Попробуй хотя бы один раз сказать спокойное «нет» без длинных оправданий. Твои границы не делают тебя плохой.",
  },
  {
    result_type: "invisible",
    title: "Невидимка",
    short_description:
      "Ты привыкла прятать чувства и желания, чтобы не стать обузой и не столкнуться с отвержением.",
    full_description:
      "Ты умеешь наблюдать, замечать детали и не навязывать себя окружающим. Но иногда осторожность превращается в привычку исчезать именно тогда, когда особенно нужны внимание и поддержка.",
    recommendation:
      "Выбери одного безопасного человека и прямо скажи ему о маленьком желании или чувстве.",
  },
];

/**
 * Идемпотентное восстановление данных теста: существующие строки обновляются,
 * дубликаты не создаются.
 */
export async function restoreQuizSeed() {
  const settings = await supabase
    .from("settings")
    .upsert(SEED_SETTINGS, { onConflict: "key" });
  if (settings.error) throw settings.error;

  const results = await supabase
    .from("quiz_results")
    .upsert(
      SEED_RESULTS.map((r) => ({ ...r, is_active: true, quiz_id: LEGACY_QUIZ_ID })),
      { onConflict: "quiz_id,result_type" },
    );
  if (results.error) throw results.error;

  const questions = await supabase
    .from("quiz_questions")
    .upsert(
      SEED_QUESTIONS.map((q) => ({
        question_number: q.question_number,
        text: q.text,
        is_active: true,
        quiz_id: LEGACY_QUIZ_ID,
      })),
      { onConflict: "quiz_id,question_number" },
    )
    .select("id, question_number");
  if (questions.error) throw questions.error;

  const byNumber = new Map((questions.data ?? []).map((q) => [q.question_number, q.id]));
  const options = SEED_QUESTIONS.flatMap((q) =>
    q.options.map((o) => ({
      question_id: byNumber.get(q.question_number)!,
      option_number: o.option_number,
      text: o.text,
      result_type: o.result_type,
    })),
  ).filter((o) => Boolean(o.question_id));

  const optionsRes = await supabase
    .from("quiz_options")
    .upsert(options, { onConflict: "question_id,option_number" });
  if (optionsRes.error) throw optionsRes.error;
}
