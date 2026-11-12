CREATE POLICY "Members can view their businesses" ON public.businesses FOR SELECT TO authenticated USING (public.is_business_member(id));
CREATE POLICY "Signed-in users can create their own business" ON public.businesses FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update their businesses" ON public.businesses FOR UPDATE TO authenticated USING (public.has_business_role(id, 'owner')) WITH CHECK (public.has_business_role(id, 'owner'));

CREATE POLICY "Members can view their memberships" ON public.business_members FOR SELECT TO authenticated USING (public.is_business_member(business_id) AND (user_id = auth.uid() OR public.has_business_role(business_id, 'owner') OR public.has_business_role(business_id, 'manager')));