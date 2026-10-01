-- Phase 7 / Punkt 2: Ungelesen-Zähler
-- Liefert pro Gruppe die Anzahl ungelesener Klapp-Nachrichten des angemeldeten Users
-- (eigene Nachrichten zählen nicht).

create or replace function public.get_unread_counts()
returns table (group_id uuid, unread_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.group_id, count(*)::bigint as unread_count
  from public.group_messages m
  join public.group_members gm
    on gm.group_id = m.group_id and gm.user_id = auth.uid()
  where m.sender_id <> auth.uid()
    and not exists (
      select 1 from public.group_message_reads r
      where r.message_id = m.id and r.user_id = auth.uid()
    )
  group by m.group_id;
$$;

grant execute on function public.get_unread_counts() to authenticated;
