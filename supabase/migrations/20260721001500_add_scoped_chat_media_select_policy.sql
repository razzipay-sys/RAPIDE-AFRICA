-- Same root cause as documents bucket (see
-- 20260721001000_add_scoped_documents_select_policy.sql): removing
-- chat_media_select entirely to close the "anyone can list every
-- conversation's media" advisory also broke uploads themselves, since
-- INSERT ... RETURNING requires the new row to pass a SELECT policy to be
-- returned. Restoring read access scoped to actual conversation
-- participants only (not public), keyed off the conversation id embedded
-- as the first path segment (`${conversationId}/images/...` /
-- `${conversationId}/voice/...`).
DROP POLICY IF EXISTS "chat_media_select" ON storage.objects;
CREATE POLICY "chat_media_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );
