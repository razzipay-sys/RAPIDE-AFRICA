-- Add new roles to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'dispatcher';
