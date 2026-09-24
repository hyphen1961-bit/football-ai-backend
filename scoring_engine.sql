-- ============================================================
-- Scoring-Engine für Football AI Kumpel-Tipp
-- Läuft automatisch, sobald du in "matches" ein Ergebnis einträgst:
--   update public.matches
--   set home_score = 2, away_score = 1, status = 'FT'
--   where api_fixture_id = 9001;
-- ============================================================

-- 1) Zusatzspalten auf user_tips für idempotente Neuberechnung
alter table public.user_tips add column if not exists points_awarded integer;
alter table public.user_tips add column if not exists was_correct_1x2 boolean not null default false;
alter table public.user_tips add column if not exists was_exact_score boolean not null default false;
alter table public.user_tips add column if not exists was_deviation_bonus boolean not null default false;

-- 2) user_scores braucht einen Unique-Key auf user_id für den Upsert
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_scores_user_id_key'
  ) then
    alter table public.user_scores add constraint user_scores_user_id_key unique (user_id);
  end if;
end $$;

-- 3) Hilfsfunktion: normalisiert "1"/"Heim"/"Home" etc. auf "Home"/"Draw"/"Away"
create or replace function public.normalize_winner(val text)
returns text
language plpgsql
immutable
as $$
begin
  if val is null then return null; end if;
  if lower(val) in ('home', '1', 'heim') then return 'Home'; end if;
  if lower(val) in ('draw', '0', 'unentschieden', 'x') then return 'Draw'; end if;
  if lower(val) in ('away', '2', 'auswärts', 'auswaerts') then return 'Away'; end if;
  return val;
end;
$$;

-- 4) Die eigentliche Scoring-Funktion
create or replace function public.calculate_scores_for_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tip record;
  actual_winner text;
  actual_over_under text;
  actual_btts text;
  total_goals integer;
  points integer;
  correct_1x2 boolean;
  correct_exact boolean;
  deviation_bonus boolean;
  ai_pred text;
  delta_points integer;
  is_first_scoring boolean;
begin
  if NEW.status <> 'FT' or NEW.home_score is null or NEW.away_score is null then
    return NEW;
  end if;

  total_goals := NEW.home_score + NEW.away_score;

  if NEW.home_score > NEW.away_score then actual_winner := 'Home';
  elsif NEW.home_score < NEW.away_score then actual_winner := 'Away';
  else actual_winner := 'Draw';
  end if;

  actual_over_under := case when total_goals > 2.5 then 'Over' else 'Under' end;
  actual_btts := case when NEW.home_score > 0 and NEW.away_score > 0 then 'Yes' else 'No' end;

  select ai_prediction into ai_pred
  from public.match_analysis
  where api_fixture_id = NEW.api_fixture_id
  limit 1;

  for tip in
    select * from public.user_tips where api_fixture_id = NEW.api_fixture_id
  loop
    points := 0;
    correct_1x2 := (public.normalize_winner(tip.predicted_winner) = actual_winner);
    if correct_1x2 then points := points + 3; end if;

    if (actual_winner = 'Home' and tip.tip_double_chance in ('1X','12'))
       or (actual_winner = 'Draw' and tip.tip_double_chance in ('1X','X2'))
       or (actual_winner = 'Away' and tip.tip_double_chance in ('12','X2')) then
      points := points + 1;
    end if;

    if tip.tip_over_under = actual_over_under then
      points := points + 2;
    end if;

    if tip.tip_btts = actual_btts then
      points := points + 2;
    end if;

    correct_exact := (tip.tip_exact_score_home = NEW.home_score and tip.tip_exact_score_away = NEW.away_score);
    if correct_exact then points := points + 5; end if;

    deviation_bonus := (
      correct_1x2
      and ai_pred is not null
      and public.normalize_winner(ai_pred) <> public.normalize_winner(tip.predicted_winner)
    );
    if deviation_bonus then points := points + 5; end if;

    is_first_scoring := (tip.points_awarded is null);
    delta_points := points - coalesce(tip.points_awarded, 0);

    update public.user_tips
    set points_awarded = points,
        was_correct_1x2 = correct_1x2,
        was_exact_score = correct_exact,
        was_deviation_bonus = deviation_bonus
    where id = tip.id;

    insert into public.user_scores (user_id, username, total_points, correct_1x2, correct_exact_score, correct_with_deviation, tips_count, updated_at)
    select
      tip.user_id,
      u.username,
      points,
      case when correct_1x2 then 1 else 0 end,
      case when correct_exact then 1 else 0 end,
      case when deviation_bonus then 1 else 0 end,
      1,
      now()
    from public.users u
    where u.id = tip.user_id
    on conflict (user_id) do update set
      total_points = public.user_scores.total_points + delta_points,
      correct_1x2 = public.user_scores.correct_1x2
        + (case when correct_1x2 then 1 else 0 end) - (case when tip.was_correct_1x2 then 1 else 0 end),
      correct_exact_score = public.user_scores.correct_exact_score
        + (case when correct_exact then 1 else 0 end) - (case when tip.was_exact_score then 1 else 0 end),
      correct_with_deviation = public.user_scores.correct_with_deviation
        + (case when deviation_bonus then 1 else 0 end) - (case when tip.was_deviation_bonus then 1 else 0 end),
      tips_count = public.user_scores.tips_count + (case when is_first_scoring then 1 else 0 end),
      updated_at = now();

  end loop;

  return NEW;
end;
$$;

-- 5) Trigger auf matches: läuft bei jedem Update, das ein Ergebnis setzt/ändert
drop trigger if exists on_match_result_set on public.matches;
create trigger on_match_result_set
  after update on public.matches
  for each row
  execute function public.calculate_scores_for_match();
