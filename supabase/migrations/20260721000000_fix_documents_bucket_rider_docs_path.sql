-- The documents bucket is used by two different upload flows with two
-- different path conventions:
--   - app.verification.tsx (customer KYC)  -> kyc_documents/user_<id>-<rand>.<ext>
--   - rider/documents.tsx (rider KYC docs) -> rider-docs/<riderId>/<type>.<ext>
-- The INSERT policy only ever allowed the first prefix, so every rider
-- document upload (license, ID card, vehicle registration, insurance,
-- profile photo) has been failing with "new row violates row-level
-- security policy" since this bucket was provisioned. The UPDATE policy
-- was also too broad (any authenticated user could overwrite ANY file in
-- the bucket, not just their own) — fixing both together.

DROP POLICY IF EXISTS "documents_owner_insert" ON storage.objects;
CREATE POLICY "documents_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
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

DROP POLICY IF EXISTS "documents_owner_update" ON storage.objects;
CREATE POLICY "documents_owner_update" ON storage.objects FOR UPDATE TO authenticated
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
