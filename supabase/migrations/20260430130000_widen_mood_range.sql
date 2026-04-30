alter table public.journal_entries drop constraint journal_entries_mood_check;
alter table public.journal_entries add constraint journal_entries_mood_check check (mood between 0 and 10);
