-- Invites are bound to the invited email address; a signed-in user can preview an invite with its secret token.
CREATE FUNCTION invite_preview(p_token_hash text) RETURNS TABLE (business_name text, role business_role, email text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.name::text, i.role, i.email::text FROM business_invites i JOIN businesses b ON b.id = i.business_id
   WHERE i.token_hash = p_token_hash AND i.accepted_at IS NULL AND i.expires_at > now() AND app_user() IS NOT NULL $$;

CREATE OR REPLACE FUNCTION accept_invite(p_token_hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv business_invites%ROWTYPE; mine text;
BEGIN
  IF app_user() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM business_invites WHERE token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND OR inv.accepted_at IS NOT NULL OR inv.expires_at < now() THEN RAISE EXCEPTION 'This invite is invalid or has expired'; END IF;
  SELECT lower(email) INTO mine FROM neon_auth."user" WHERE id = app_user();
  IF mine IS DISTINCT FROM lower(inv.email) THEN RAISE EXCEPTION 'This invite was sent to a different email address'; END IF;
  IF EXISTS (SELECT 1 FROM business_members WHERE business_id = inv.business_id AND user_id = app_user()) THEN RAISE EXCEPTION 'You are already a member of this business'; END IF;
  INSERT INTO business_members (business_id, user_id, role) VALUES (inv.business_id, app_user(), inv.role);
  UPDATE business_invites SET accepted_at = now() WHERE id = inv.id;
  INSERT INTO audit_logs (business_id, actor_id, action, entity, entity_id, detail) VALUES (inv.business_id, app_user(), 'member.joined', 'member', app_user(), jsonb_build_object('role', inv.role));
  RETURN inv.business_id;
END $$;
