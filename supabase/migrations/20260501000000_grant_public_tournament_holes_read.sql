-- Grant read access to anon and authenticated roles for spectator leaderboard
GRANT SELECT ON TABLE public.tournament_holes TO anon, authenticated;

-- Allow public reads on tournament_holes
CREATE POLICY "Public tournament holes are readable"
  ON public.tournament_holes FOR SELECT TO anon, authenticated
  USING (true);
