-- =====================================================================
-- MSK Hacks Physiotherapy — booking database
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again (it drops and recreates the functions and policies,
-- but never deletes your bookings).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Staff: who may open the Practice Portal
-- ---------------------------------------------------------------------
create table if not exists public.staff (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- Short, hard-to-guess reference codes, e.g. MSK-7KQ2PX (no 0/O/1/I/L to avoid mix-ups)
create or replace function public.gen_ref(prefix text)
returns text
language plpgsql volatile
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return prefix || '-' || result;
end;
$$;

-- South African "today"
create or replace function public.sa_today()
returns date
language sql stable
as $$ select (now() at time zone 'Africa/Johannesburg')::date; $$;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table if not exists public.appointments (
  id             uuid primary key default gen_random_uuid(),
  reference_code text not null unique default public.gen_ref('MSK'),
  service_id     text not null,
  therapist_id   text not null,
  appt_date      date not null,
  time_slot      text not null,
  status         text not null default 'confirmed'
                 check (status in ('confirmed', 'completed', 'cancelled', 'rescheduled')),
  intake         jsonb not null,
  patient_email  text generated always as (lower(trim(intake ->> 'email'))) stored,
  clinical_notes text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One patient per physio per time slot (cancelled bookings free the slot)
create unique index if not exists appointments_slot_unique
  on public.appointments (therapist_id, appt_date, time_slot)
  where status <> 'cancelled';
create index if not exists appointments_date_idx  on public.appointments (appt_date);
create index if not exists appointments_email_idx on public.appointments (patient_email);

create table if not exists public.blocked_slots (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  type            text not null default 'custom' check (type in ('lunch', 'holiday', 'custom')),
  therapist_id    text not null default 'all',
  block_date      date,
  start_date      date,
  end_date        date,
  time_slots      text[],
  is_full_day     boolean not null default false,
  recurring_daily boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.waitlist (
  id                     uuid primary key default gen_random_uuid(),
  reference_code         text not null unique default public.gen_ref('WAIT'),
  patient_name           text not null,
  email                  text not null,
  phone                  text not null,
  service_id             text not null,
  therapist_id           text not null,
  preferred_date         date not null,
  preferred_time_of_day  text not null default 'any' check (preferred_time_of_day in ('morning', 'afternoon', 'any')),
  pain_location          text,
  notes                  text,
  status                 text not null default 'active' check (status in ('active', 'contacted', 'booked', 'cancelled')),
  created_at             timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. Row Level Security: patients can never read the tables directly.
--    Only staff can see bookings and the waitlist.
-- ---------------------------------------------------------------------
alter table public.staff         enable row level security;
alter table public.appointments  enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.waitlist      enable row level security;

drop policy if exists "staff can see own row"        on public.staff;
drop policy if exists "staff manage appointments"    on public.appointments;
drop policy if exists "staff manage waitlist"        on public.waitlist;
drop policy if exists "anyone can read blocked"      on public.blocked_slots;
drop policy if exists "staff insert blocked"         on public.blocked_slots;
drop policy if exists "staff update blocked"         on public.blocked_slots;
drop policy if exists "staff delete blocked"         on public.blocked_slots;

create policy "staff can see own row" on public.staff
  for select to authenticated using (user_id = auth.uid());

create policy "staff manage appointments" on public.appointments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff manage waitlist" on public.waitlist
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- Closures and lunch breaks contain no patient data, so the public calendar may read them
create policy "anyone can read blocked" on public.blocked_slots
  for select to anon, authenticated using (true);
create policy "staff insert blocked" on public.blocked_slots
  for insert to authenticated with check (public.is_staff());
create policy "staff update blocked" on public.blocked_slots
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete blocked" on public.blocked_slots
  for delete to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- 4. Public functions the website calls (no login needed).
--    They run with elevated rights but only return what is safe.
-- ---------------------------------------------------------------------

-- Taken slots only: date, time and physio. No names, no health details.
create or replace function public.get_booked_slots(p_from date, p_to date)
returns table (appt_date date, time_slot text, therapist_id text)
language sql stable security definer
set search_path = public
as $$
  select a.appt_date, a.time_slot, a.therapist_id
  from public.appointments a
  where a.status <> 'cancelled'
    and a.appt_date between p_from and least(p_to, p_from + 190);
$$;

create or replace function public.slot_is_blocked(p_date date, p_slot text, p_therapist text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocked_slots b
    where (b.therapist_id = 'all' or b.therapist_id = p_therapist)
      and (
        (b.is_full_day and (b.block_date = p_date or p_date between b.start_date and b.end_date))
        or (b.recurring_daily and p_slot = any (b.time_slots))
        or (b.block_date = p_date and p_slot = any (b.time_slots))
      )
  );
$$;

-- Shared checks for a requested appointment time
create or replace function public.check_bookable(p_date date, p_slot text, p_therapist text)
returns void
language plpgsql stable security definer
set search_path = public
as $$
begin
  if p_date is null or p_slot is null then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if p_date <= public.sa_today() or p_date > public.sa_today() + 180 then
    raise exception 'date_out_of_range' using errcode = 'P0001';
  end if;
  if extract(isodow from p_date) > 5 then
    raise exception 'closed_on_weekends' using errcode = 'P0001';
  end if;
  if p_slot !~ '^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$' then
    raise exception 'invalid_slot' using errcode = 'P0001';
  end if;
  if public.slot_is_blocked(p_date, p_slot, p_therapist) then
    raise exception 'slot_blocked' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.create_booking(
  p_service_id text,
  p_therapist_id text,
  p_date date,
  p_time_slot text,
  p_intake jsonb
)
returns table (id uuid, reference_code text, created_at timestamptz)
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_intake ->> 'email'));
begin
  if coalesce(trim(p_intake ->> 'fullName'), '') = ''
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or length(coalesce(trim(p_intake ->> 'phone'), '')) < 7 then
    raise exception 'missing_details' using errcode = 'P0001';
  end if;
  if length(p_intake::text) > 6000 or length(p_service_id) > 60 or length(p_therapist_id) > 60 then
    raise exception 'too_long' using errcode = 'P0001';
  end if;

  perform public.check_bookable(p_date, p_time_slot, p_therapist_id);

  -- Basic spam protection: at most 4 upcoming bookings per email address
  if (select count(*) from public.appointments a
      where a.patient_email = v_email and a.status <> 'cancelled' and a.appt_date >= public.sa_today()) >= 4 then
    raise exception 'too_many_bookings' using errcode = 'P0001';
  end if;

  return query
    insert into public.appointments (service_id, therapist_id, appt_date, time_slot, status, intake)
    values (p_service_id, p_therapist_id, p_date, p_time_slot, 'confirmed', p_intake - 'clinicalNotes')
    returning appointments.id, appointments.reference_code, appointments.created_at;
exception
  when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

create or replace function public.join_waitlist(
  p_patient_name text,
  p_email text,
  p_phone text,
  p_service_id text,
  p_therapist_id text,
  p_preferred_date date,
  p_preferred_time_of_day text,
  p_pain_location text,
  p_notes text
)
returns table (id uuid, reference_code text, created_at timestamptz)
language plpgsql volatile security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_patient_name), '') = ''
     or lower(trim(p_email)) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or length(coalesce(trim(p_phone), '')) < 7 then
    raise exception 'missing_details' using errcode = 'P0001';
  end if;
  if length(coalesce(p_notes, '')) > 2000 or length(p_patient_name) > 200 then
    raise exception 'too_long' using errcode = 'P0001';
  end if;
  if (select count(*) from public.waitlist w
      where lower(w.email) = lower(trim(p_email)) and w.status = 'active') >= 3 then
    raise exception 'too_many_bookings' using errcode = 'P0001';
  end if;

  return query
    insert into public.waitlist (patient_name, email, phone, service_id, therapist_id, preferred_date,
                                 preferred_time_of_day, pain_location, notes)
    values (trim(p_patient_name), trim(p_email), trim(p_phone), p_service_id, p_therapist_id, p_preferred_date,
            coalesce(nullif(p_preferred_time_of_day, ''), 'any'), p_pain_location, nullif(trim(p_notes), ''))
    returning waitlist.id, waitlist.reference_code, waitlist.created_at;
end;
$$;

-- A patient proves who they are with ONE reference code + the email used to book.
-- They then see all their own bookings (without the physio's clinical notes).
create or replace function public.patient_bookings(p_ref text, p_email text)
returns table (
  id uuid, reference_code text, service_id text, therapist_id text, appt_date date,
  time_slot text, status text, intake jsonb, created_at timestamptz
)
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
begin
  if not exists (
    select 1 from public.appointments a
    where a.reference_code = upper(trim(p_ref)) and a.patient_email = v_email
  ) then
    return;
  end if;
  return query
    select a.id, a.reference_code, a.service_id, a.therapist_id, a.appt_date, a.time_slot,
           a.status, a.intake, a.created_at
    from public.appointments a
    where a.patient_email = v_email
    order by a.appt_date desc, a.time_slot;
end;
$$;

create or replace function public.patient_cancel(p_ref text, p_email text)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.appointments a
     set status = 'cancelled'
   where a.reference_code = upper(trim(p_ref))
     and a.patient_email = lower(trim(p_email))
     and a.status in ('confirmed', 'rescheduled')
     and a.appt_date >= public.sa_today();
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.patient_reschedule(p_ref text, p_email text, p_date date, p_time_slot text)
returns boolean
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_therapist text;
  n int;
begin
  select a.therapist_id into v_therapist
    from public.appointments a
   where a.reference_code = upper(trim(p_ref))
     and a.patient_email = lower(trim(p_email))
     and a.status in ('confirmed', 'rescheduled')
     and a.appt_date >= public.sa_today();
  if v_therapist is null then
    return false;
  end if;

  perform public.check_bookable(p_date, p_time_slot, v_therapist);

  update public.appointments a
     set appt_date = p_date, time_slot = p_time_slot, status = 'rescheduled'
   where a.reference_code = upper(trim(p_ref))
     and a.patient_email = lower(trim(p_email));
  get diagnostics n = row_count;
  return n > 0;
exception
  when unique_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Who may call what
-- ---------------------------------------------------------------------
revoke all on function public.is_staff()                                       from public;
revoke all on function public.gen_ref(text)                                    from public;
revoke all on function public.slot_is_blocked(date, text, text)                from public;
revoke all on function public.check_bookable(date, text, text)                 from public;
revoke all on function public.get_booked_slots(date, date)                     from public;
revoke all on function public.create_booking(text, text, date, text, jsonb)    from public;
revoke all on function public.join_waitlist(text, text, text, text, text, date, text, text, text) from public;
revoke all on function public.patient_bookings(text, text)                     from public;
revoke all on function public.patient_cancel(text, text)                       from public;
revoke all on function public.patient_reschedule(text, text, date, text)       from public;

grant execute on function public.is_staff()                                    to authenticated;
grant execute on function public.gen_ref(text)                                 to anon, authenticated;
grant execute on function public.get_booked_slots(date, date)                  to anon, authenticated;
grant execute on function public.create_booking(text, text, date, text, jsonb) to anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, date, text, text, text) to anon, authenticated;
grant execute on function public.patient_bookings(text, text)                  to anon, authenticated;
grant execute on function public.patient_cancel(text, text)                    to anon, authenticated;
grant execute on function public.patient_reschedule(text, text, date, text)    to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Starting data: lunch break and South African public holidays.
--    (Only added if the blocked_slots table is empty.)
-- ---------------------------------------------------------------------
insert into public.blocked_slots (title, type, therapist_id, time_slots, recurring_daily, notes)
select 'Lunch break', 'lunch', 'all', array['12:30 PM'], true, 'Daily lunch break'
where not exists (select 1 from public.blocked_slots);

insert into public.blocked_slots (title, type, therapist_id, block_date, is_full_day)
select v.title, 'holiday', 'all', v.d::date, true
from (values
  ('Day of Reconciliation', '2026-12-16'),
  ('Christmas Day',          '2026-12-25'),
  ('Day of Goodwill',        '2026-12-26'),
  ('New Year''s Day',        '2027-01-01'),
  ('Human Rights Day',       '2027-03-22'),
  ('Good Friday',            '2027-03-26'),
  ('Family Day',             '2027-03-29'),
  ('Freedom Day',            '2027-04-27'),
  ('Workers'' Day',          '2027-05-01'),
  ('Youth Day',              '2027-06-16'),
  ('National Women''s Day',  '2027-08-09'),
  ('Heritage Day',           '2027-09-24'),
  ('Day of Reconciliation',  '2027-12-16'),
  ('Christmas Day',          '2027-12-25'),
  ('Day of Goodwill',        '2027-12-27')
) as v(title, d)
where not exists (select 1 from public.blocked_slots where type = 'holiday');
