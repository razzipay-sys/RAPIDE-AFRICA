-- ROOT CAUSE of "new row violates row-level security policy" on document
-- uploads: documents_public_read (a public, unrestricted SELECT policy) was
-- dropped in an earlier migration to close a "anyone can list every KYC
-- document" security advisory finding — but Postgres RLS requires
-- `INSERT ... RETURNING` to pass a SELECT policy for the new row to be
-- returned, and Supabase Storage's upload endpoint always does a
-- RETURNING-style insert. With zero SELECT policy at all, EVERY upload to
-- this bucket failed with an RLS violation, not just unauthorized listing —
-- confirmed by direct reproduction: an insert with a trivial
-- `WITH CHECK (true)` INSERT policy still failed until a SELECT policy
-- existed, and started returning successfully immediately after adding one.
--
-- This restores read access, but scoped to actual ownership this time
-- instead of the original overly-broad public policy.
DROP POLICY IF EXISTS "documents_owner_select" ON storage.objects;
CREATE POLICY "documents_owner_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (
      (storage.foldername(name))[1] = 'kyc_documents'
      OR (
        (storage.foldername(name))[1] = 'rider-docs'
        AND EXISTS (
          SELECT 1 FROM public.riders r
          WHERE r.id::text = (storage.foldername(name))[2]
            AND r.user_id = auth.uid()
        )
      )
    )
  );
