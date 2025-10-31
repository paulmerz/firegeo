-- Custom SQL migration file, put your code below! ---- Migration 005: Add workspace trigger for new users (robust version)
-- This migration creates the trigger with proper security and typing

-- Function to create default workspace for new user
CREATE OR REPLACE FUNCTION public.create_default_workspace_for_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id uuid;
BEGIN
  -- Create a new workspace for the user and get the ID directly
  INSERT INTO public.workspaces (name, created_at, updated_at)
  VALUES ('Mon Workspace', NOW(), NOW())
  RETURNING id INTO new_workspace_id;
  
  -- Add user as owner of the workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, created_at)
  VALUES (new_workspace_id, NEW.id, 'owner', NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_create_workspace_after_user_insert ON public."user";
CREATE TRIGGER trigger_create_workspace_after_user_insert
  AFTER INSERT ON public."user"
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_workspace_for_user();
