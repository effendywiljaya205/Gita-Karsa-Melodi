-- =========================================================
-- DATABASE GITA KARSA MELODI (Supabase)
-- Cara pakai: Supabase > SQL Editor > New query >
-- paste semua isi file ini > klik RUN.
-- Data contoh akan terisi otomatis saat website pertama kali dibuka.
-- =========================================================

-- Tabel pesanan
create table if not exists public.bookings (
  id          text primary key,            -- kode pesanan, cth. GKM-0001
  name        text not null,               -- nama penyewa
  phone       text not null,               -- no. WhatsApp
  event       text not null,               -- jenis acara
  event_date  text not null,               -- tanggal acara (YYYY-MM-DD)
  address     text,                        -- alamat lokasi acara
  package     text not null,               -- P1 s/d P5
  addon       integer default 0,           -- jumlah MC / pemain musik
  overtime    integer default 0,           -- jam overtime
  payment     text,                        -- Transfer BCA / Cash
  notes       text,                        -- catatan
  total       numeric not null,            -- total biaya
  dp          numeric not null,            -- DP 50%
  status      text not null default 'pending', -- pending / confirmed / lunas / cancelled
  dp_paid     boolean default false,       -- DP sudah dibayar?
  created_at  text                         -- tanggal pesan (YYYY-MM-DD)
);

-- Tabel tanggal yang ditutup admin (servis alat, tim libur, dll)
create table if not exists public.blocked_dates (
  block_date  text primary key,            -- YYYY-MM-DD
  reason      text
);

-- ---------------------------------------------------------
-- HAK AKSES
-- CATATAN: ini PROTOTYPE untuk tugas kuliah. Siapa pun yang
-- punya link website boleh baca/tambah/ubah/hapus data.
-- Untuk usaha sungguhan, akses admin harus pakai login Supabase.
-- ---------------------------------------------------------
alter table public.bookings enable row level security;
alter table public.blocked_dates enable row level security;

drop policy if exists "prototype akses penuh" on public.bookings;
create policy "prototype akses penuh" on public.bookings
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "prototype akses penuh" on public.blocked_dates;
create policy "prototype akses penuh" on public.blocked_dates
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.bookings to anon, authenticated;
grant select, insert, update, delete on public.blocked_dates to anon, authenticated;
