-- Add KYC and Verification fields to profiles (Users)
ALTER TABLE public.profiles
ADD COLUMN kyc_status public.kyc_status DEFAULT 'pending',
ADD COLUMN id_document_url text,
ADD COLUMN phone_verified boolean DEFAULT false;
