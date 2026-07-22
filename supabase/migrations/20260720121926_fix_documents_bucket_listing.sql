-- documents bucket (public=true) doesn't need a broad SELECT policy for
-- getPublicUrl() fetch to work; the policy only enabled listing/enumerating
-- every uploaded KYC document (driver's licenses, national IDs) across the
-- whole platform, which is worse than the chat-media case fixed in the
-- previous migration.
DROP POLICY IF EXISTS "documents_public_read" ON storage.objects;
