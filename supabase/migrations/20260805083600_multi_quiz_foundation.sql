-- Multi-quiz foundation: table quizzes + quiz_id on questions/results/sessions/answers.
-- Safe backfill of the existing single quiz. Does not delete or null existing rows.

CREATE TYPE public.quiz_status AS ENUM ('draft', 'published', 'archived');

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  intro_text text,
  image_url text,
  status public.quiz_status NOT NULL DEFAULT 'draft',
  is_active boolean NOT NULL DEFAULT true,
  requires_subscription boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
GRANT SELECT ON public.quizzes TO anon;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quizzes"
  ON public.quizzes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read published active quizzes"
  ON public.quizzes
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published' AND is_active = true);

CREATE TRIGGER trg_quizzes_updated
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Stable id for the existing test so backfill is deterministic and idempotent.
-- slug: kakuyu-rol-ty-ustala-igrat
INSERT INTO public.quizzes (
  id,
  title,
  slug,
  description,
  intro_text,
  image_url,
  status,
  is_active,
  requires_subscription,
  sort_order
)
VALUES (
  'b1e00000-4a5e-4f01-9c01-000000000001'::uuid,
  COALESCE(
    (SELECT value FROM public.settings WHERE key = 'quiz_title' LIMIT 1),
    'Какую роль ты устала играть?'
  ),
  'kakuyu-rol-ty-ustala-igrat',
  COALESCE(
    (SELECT value FROM public.settings WHERE key = 'quiz_description' LIMIT 1),
    'Короткий развлекательный тест, который помогает заметить привычную жизненную роль. Тест не является психологической или медицинской диагностикой.'
  ),
  'Отвечай честно и выбирай вариант, который первым откликается внутри.
Здесь нет правильных и неправильных ответов.',
  NULL,
  'published',
  true,
  true,
  1
)
ON CONFLICT (id) DO NOTHING;

-- 1) Add nullable quiz_id columns
ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS quiz_id uuid;

ALTER TABLE public.quiz_results
  ADD COLUMN IF NOT EXISTS quiz_id uuid;

ALTER TABLE public.quiz_sessions
  ADD COLUMN IF NOT EXISTS quiz_id uuid;

ALTER TABLE public.quiz_answers
  ADD COLUMN IF NOT EXISTS quiz_id uuid;

-- 2) Backfill existing rows to the legacy quiz (do not touch already-linked rows)
UPDATE public.quiz_questions
SET quiz_id = 'b1e00000-4a5e-4f01-9c01-000000000001'::uuid
WHERE quiz_id IS NULL;

UPDATE public.quiz_results
SET quiz_id = 'b1e00000-4a5e-4f01-9c01-000000000001'::uuid
WHERE quiz_id IS NULL;

UPDATE public.quiz_sessions
SET quiz_id = 'b1e00000-4a5e-4f01-9c01-000000000001'::uuid
WHERE quiz_id IS NULL;

UPDATE public.quiz_answers qa
SET quiz_id = qs.quiz_id
FROM public.quiz_sessions qs
WHERE qa.session_id = qs.id
  AND qa.quiz_id IS NULL;

-- 3) Only after backfill: NOT NULL + foreign keys
ALTER TABLE public.quiz_questions
  ALTER COLUMN quiz_id SET NOT NULL;

ALTER TABLE public.quiz_results
  ALTER COLUMN quiz_id SET NOT NULL;

ALTER TABLE public.quiz_sessions
  ALTER COLUMN quiz_id SET NOT NULL;

ALTER TABLE public.quiz_answers
  ALTER COLUMN quiz_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_results_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_results
      ADD CONSTRAINT quiz_results_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_sessions_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_sessions
      ADD CONSTRAINT quiz_sessions_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_answers_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_answers
      ADD CONSTRAINT quiz_answers_quiz_id_fkey
      FOREIGN KEY (quiz_id) REFERENCES public.quizzes(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- 4) Replace global uniqueness with per-quiz uniqueness
ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_question_number_key;

ALTER TABLE public.quiz_results
  DROP CONSTRAINT IF EXISTS quiz_results_result_type_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_quiz_id_question_number_key'
  ) THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_quiz_id_question_number_key
      UNIQUE (quiz_id, question_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_results_quiz_id_result_type_key'
  ) THEN
    ALTER TABLE public.quiz_results
      ADD CONSTRAINT quiz_results_quiz_id_result_type_key
      UNIQUE (quiz_id, result_type);
  END IF;
END $$;

-- Ensure an answer cannot reference a session and a question from different quizzes:
-- composite FKs force answer.quiz_id to match both session.quiz_id and question.quiz_id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_sessions_id_quiz_id_key'
  ) THEN
    ALTER TABLE public.quiz_sessions
      ADD CONSTRAINT quiz_sessions_id_quiz_id_key
      UNIQUE (id, quiz_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_id_quiz_id_key'
  ) THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_id_quiz_id_key
      UNIQUE (id, quiz_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_answers_session_id_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_answers
      ADD CONSTRAINT quiz_answers_session_id_quiz_id_fkey
      FOREIGN KEY (session_id, quiz_id)
      REFERENCES public.quiz_sessions (id, quiz_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quiz_answers_question_id_quiz_id_fkey'
  ) THEN
    ALTER TABLE public.quiz_answers
      ADD CONSTRAINT quiz_answers_question_id_quiz_id_fkey
      FOREIGN KEY (question_id, quiz_id)
      REFERENCES public.quiz_questions (id, quiz_id);
  END IF;
END $$;

-- 5) Indexes for frequent lookups
CREATE INDEX IF NOT EXISTS quizzes_published_active_sort_order_idx
  ON public.quizzes (sort_order ASC)
  WHERE status = 'published' AND is_active = true;

CREATE INDEX IF NOT EXISTS quiz_questions_quiz_id_question_number_idx
  ON public.quiz_questions (quiz_id, question_number);

CREATE INDEX IF NOT EXISTS quiz_results_quiz_id_idx
  ON public.quiz_results (quiz_id);

CREATE INDEX IF NOT EXISTS quiz_sessions_user_id_quiz_id_idx
  ON public.quiz_sessions (user_id, quiz_id);

CREATE INDEX IF NOT EXISTS quiz_answers_quiz_id_idx
  ON public.quiz_answers (quiz_id);

-- 6) Public read for questions/options of published active quizzes.
-- quiz_results stay admin/service_role only (no anon SELECT) so full result text
-- cannot bypass subscription checks. Existing admin ALL policies are unchanged;
-- sessions/answers/users policies are not weakened.
GRANT SELECT ON public.quiz_questions TO anon;
GRANT SELECT ON public.quiz_options TO anon;

CREATE POLICY "Public read questions of published quizzes"
  ON public.quiz_questions
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quizzes q
      WHERE q.id = quiz_questions.quiz_id
        AND q.status = 'published'
        AND q.is_active = true
    )
  );

CREATE POLICY "Public read options of published quizzes"
  ON public.quiz_options
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quiz_questions qq
      JOIN public.quizzes q ON q.id = qq.quiz_id
      WHERE qq.id = quiz_options.question_id
        AND q.status = 'published'
        AND q.is_active = true
    )
  );
