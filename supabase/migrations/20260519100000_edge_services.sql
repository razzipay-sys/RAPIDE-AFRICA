-- Rate limiting table for Edge Functions
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  id        bigserial PRIMARY KEY,
  user_action text NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limit_log_lookup
  ON public.rate_limit_log (user_action, created_at DESC);

-- Only service role (Edge Functions) can write; no user access needed
ALTER TABLE public.rate_limit_log ENABLE ROW LEVEL SECURITY;

-- Chat media storage bucket (public read, auth write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media',
  'chat-media',
  true,
  10485760,
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated users can upload to chat-media
CREATE POLICY "chat_media_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

-- Anyone can read public chat media (bucket is public)
CREATE POLICY "chat_media_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-media');
