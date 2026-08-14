ALTER TABLE public.event_log ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS event_log_external_id_key ON public.event_log (external_id) WHERE external_id IS NOT NULL;
INSERT INTO public.settings (key, value, description)
VALUES ('CHANNEL_URL', '', 'Ссылка на канал «Чудеса за полчаса»'),
       ('CHANNEL_CHAT_ID', '', 'ID чата канала в MAX'),
       ('CHANNEL_NAME', 'Чудеса за полчаса', 'Название канала')
ON CONFLICT (key) DO NOTHING;