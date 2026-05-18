-- ============ SUPER ADMIN AUTO-ASSIGNMENT ============
-- Automatically assigns the 'admin' role to designated super admin email addresses.
-- Covers both existing users and future signups.

-- Function: assign admin role to super admin emails on user creation
CREATE OR REPLACE FUNCTION public.auto_assign_super_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.email IN ('razzipay@gmail.com', 'adegbesanadebola1@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger: fire after each new user is inserted into auth.users
DROP TRIGGER IF EXISTS trg_super_admin_role ON auth.users;
CREATE TRIGGER trg_super_admin_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_assign_super_admin();

-- Backfill: assign admin role to any existing accounts with these emails
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email IN ('razzipay@gmail.com', 'adegbesanadebola1@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
