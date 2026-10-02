-- =====================================================================
-- EduMemory — Telegram Mini App davomat tizimi
-- Supabase PostgreSQL sxemasi
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Kengaytmalar
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. ENUM turlari
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('owner', 'admin', 'teacher', 'parent', 'student');
  end if;

  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type attendance_status as enum ('present', 'absent', 'late');
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 2. schools — maktablar / o'quv markazlari
-- ---------------------------------------------------------------------
create table if not exists schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  owner_id    uuid,
  is_active   boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------------------
-- 3. profiles — Telegram orqali kirgan barcha foydalanuvchilar
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id             uuid primary key default gen_random_uuid(),
  telegram_id    bigint not null unique,
  username       text,
  full_name      text not null,
  phone          text,
  photo_url      text,
  role           user_role not null default 'student',
  school_id      uuid references schools(id) on delete set null,
  is_active      boolean not null default true,
  created_at     timestamptz not null default timezone('utc', now()),
  updated_at     timestamptz not null default timezone('utc', now())
);

alter table schools
  add constraint schools_owner_id_fkey
  foreign key (owner_id) references profiles(id) on delete set null;

create index if not exists idx_profiles_telegram_id on profiles(telegram_id);
create index if not exists idx_profiles_school_id on profiles(school_id);
create index if not exists idx_profiles_role on profiles(role);

-- ---------------------------------------------------------------------
-- 4. groups — sinf / guruhlar
-- ---------------------------------------------------------------------
create table if not exists groups (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  name        text not null,
  teacher_id  uuid references profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_groups_school_id on groups(school_id);
create index if not exists idx_groups_teacher_id on groups(teacher_id);

-- ---------------------------------------------------------------------
-- 5. students — o'quvchilar
-- ---------------------------------------------------------------------
create table if not exists students (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references schools(id) on delete cascade,
  group_id    uuid references groups(id) on delete set null,
  full_name   text not null,
  phone       text,
  parent_id   uuid references profiles(id) on delete set null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists idx_students_school_id on students(school_id);
create index if not exists idx_students_group_id on students(group_id);
create index if not exists idx_students_parent_id on students(parent_id);

-- ---------------------------------------------------------------------
-- 6. attendance — davomat
-- ---------------------------------------------------------------------
create table if not exists attendance (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  group_id      uuid references groups(id) on delete set null,
  date          date not null,
  status        attendance_status not null,
  recorded_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now()),
  constraint attendance_student_date_unique unique (student_id, date)
);

create index if not exists idx_attendance_student_id on attendance(student_id);
create index if not exists idx_attendance_group_id on attendance(group_id);
create index if not exists idx_attendance_date on attendance(date);

-- ---------------------------------------------------------------------
-- 7. updated_at avtomatik yangilash trigger'i
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_schools_updated_at on schools;
create trigger trg_schools_updated_at before update on schools
  for each row execute function set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_groups_updated_at on groups;
create trigger trg_groups_updated_at before update on groups
  for each row execute function set_updated_at();

drop trigger if exists trg_students_updated_at on students;
create trigger trg_students_updated_at before update on students
  for each row execute function set_updated_at();

drop trigger if exists trg_attendance_updated_at on attendance;
create trigger trg_attendance_updated_at before update on attendance
  for each row execute function set_updated_at();

-- =====================================================================
-- 8. RLS (Row Level Security)
-- =====================================================================
-- MUHIM: Bu ilova Supabase Auth'dan emas, Telegram initData'dan
-- foydalanadi. Shu sababli barcha o'qish/yozish amallari faqat
-- Server Action'lar ichida SUPABASE_SERVICE_ROLE_KEY orqali (RLS'ni
-- chetlab o'tadigan client bilan) bajariladi, chunki service_role
-- kaliti RLS'dan mustasno. Ruxsatlar (rolga qarab) shu Server
-- Action'larning ichida tekshiriladi (sessiya cookie orqali).
--
-- Quyidagi RLS policy'lari ikkinchi himoya qatlami (defense-in-depth)
-- sifatida ishlaydi: anon/authenticated kalitlar bilan to'g'ridan-to'g'ri
-- (frontend'dan) kirishga urinish bo'lsa, hech narsa qaytarilmaydi.
--
-- current_profile_id() — agar kelajakda so'rov konteksti ichiga
-- `set_config('app.current_profile_id', <uuid>, true)` orqali profil
-- ID o'rnatiladigan bo'lsa, policy'lar shundan foydalanadi.

create or replace function current_profile_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_profile_id', true), '')::uuid;
$$;

create or replace function current_profile_role()
returns user_role
language sql
stable
as $$
  select role from profiles where id = current_profile_id();
$$;

create or replace function current_profile_school_id()
returns uuid
language sql
stable
as $$
  select school_id from profiles where id = current_profile_id();
$$;

create or replace function is_owner()
returns boolean
language sql
stable
as $$
  select coalesce(current_profile_role() = 'owner', false);
$$;

alter table schools enable row level security;
alter table profiles enable row level security;
alter table groups enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;

-- anon/authenticated uchun default: hech narsa ko'rinmaydi
revoke all on schools, profiles, groups, students, attendance from anon, authenticated;

-- owner: to'liq ruxsat (barcha jadvallar, barcha maktablar)
create policy owner_full_access_schools on schools
  for all using (is_owner()) with check (is_owner());

create policy owner_full_access_profiles on profiles
  for all using (is_owner()) with check (is_owner());

create policy owner_full_access_groups on groups
  for all using (is_owner()) with check (is_owner());

create policy owner_full_access_students on students
  for all using (is_owner()) with check (is_owner());

create policy owner_full_access_attendance on attendance
  for all using (is_owner()) with check (is_owner());

-- admin: faqat o'z maktabi doirasida to'liq ruxsat
create policy admin_school_access_profiles on profiles
  for all using (
    current_profile_role() = 'admin'
    and school_id = current_profile_school_id()
  ) with check (
    current_profile_role() = 'admin'
    and school_id = current_profile_school_id()
  );

create policy admin_school_access_groups on groups
  for all using (
    current_profile_role() = 'admin'
    and school_id = current_profile_school_id()
  ) with check (
    current_profile_role() = 'admin'
    and school_id = current_profile_school_id()
  );

create policy admin_school_access_students on students
  for all using (
    current_profile_role() = 'admin'
    and school_id = current_profile_school_id()
  ) with check (
    current_profile_role() = 'admin'
    and school_id = current_profile_school_id()
  );

create policy admin_school_access_attendance on attendance
  for all using (
    current_profile_role() = 'admin'
    and exists (
      select 1 from students s
      where s.id = attendance.student_id
      and s.school_id = current_profile_school_id()
    )
  ) with check (
    current_profile_role() = 'admin'
    and exists (
      select 1 from students s
      where s.id = attendance.student_id
      and s.school_id = current_profile_school_id()
    )
  );

-- teacher: faqat o'ziga biriktirilgan guruhlar va shu guruhdagi
-- o'quvchilarning davomatini ko'rish/belgilash
create policy teacher_read_groups on groups
  for select using (
    current_profile_role() = 'teacher'
    and teacher_id = current_profile_id()
  );

create policy teacher_read_students on students
  for select using (
    current_profile_role() = 'teacher'
    and group_id in (select id from groups where teacher_id = current_profile_id())
  );

create policy teacher_manage_attendance on attendance
  for all using (
    current_profile_role() = 'teacher'
    and group_id in (select id from groups where teacher_id = current_profile_id())
  ) with check (
    current_profile_role() = 'teacher'
    and group_id in (select id from groups where teacher_id = current_profile_id())
  );

-- parent: faqat o'z farzandi(lari)ning ma'lumotlarini ko'radi
create policy parent_read_own_children on students
  for select using (
    current_profile_role() = 'parent'
    and parent_id = current_profile_id()
  );

create policy parent_read_children_attendance on attendance
  for select using (
    current_profile_role() = 'parent'
    and student_id in (select id from students where parent_id = current_profile_id())
  );

-- student: faqat o'zining davomatini ko'radi
-- (profiles <-> students o'rtasida to'g'ridan-to'g'ri FK yo'qligi sababli,
-- moslashtirish ism + maktab bo'yicha amalga oshiriladi — attendance
-- policy'lari bilan bir xil yondashuv)
create policy student_read_own_profile on students
  for select using (
    current_profile_role() = 'student'
    and full_name = (select p.full_name from profiles p where p.id = current_profile_id())
    and school_id = current_profile_school_id()
  );

create policy student_read_own_attendance on attendance
  for select using (
    current_profile_role() = 'student'
    and student_id in (
      select st.id from students st
      join profiles p on p.id = current_profile_id()
      where st.full_name = p.full_name and st.school_id = p.school_id
    )
  );

-- har bir profil o'zini o'qiy oladi (rol aniqlash uchun)
create policy profiles_read_self on profiles
  for select using (id = current_profile_id());
