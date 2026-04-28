-- ============================================================
-- QRコード発注システム スキーマ
-- 既存Supabaseプロジェクト (pwuhhdzomaojjvwmjizw) に追加
-- ============================================================

-- ============================================================
-- stores（卸先店舗）
-- ============================================================
create table if not exists stores (
  id          text primary key,                          -- スラッグ形式 例: cafe-yamada
  name        text not null,                             -- 店舗名（表示用）
  email       text not null,                             -- 発注確認メール送信先
  active      boolean not null default true,             -- false で発注不可
  created_at  timestamptz not null default now()
);

-- ============================================================
-- products（商品マスタ）
-- ============================================================
create table if not exists products (
  id          text primary key,                          -- スラッグ形式 例: cola-syrup
  name        text not null,                             -- 商品名（表示用）
  unit        text not null,                             -- 単位 例: 本、袋、個
  price       integer not null default 0,                -- 単価（円）
  description text,                                      -- 商品説明（フォームに表示）
  active      boolean not null default true,             -- false で選択肢から除外
  created_at  timestamptz not null default now()
);

-- ============================================================
-- wholesale_orders（発注）※ 既存の orders テーブルと区別するため接頭辞付き
-- ============================================================
create table if not exists wholesale_orders (
  id          uuid primary key default gen_random_uuid(),
  store_id    text not null references stores(id),
  product_id  text not null references products(id),
  quantity    integer not null check (quantity >= 1),
  note        text,
  status      text not null default 'pending'
              check (status in ('pending', 'confirmed', 'shipped')),
  created_at  timestamptz not null default now()
);

create index if not exists wholesale_orders_store_id_idx   on wholesale_orders(store_id);
create index if not exists wholesale_orders_product_id_idx on wholesale_orders(product_id);
create index if not exists wholesale_orders_status_idx     on wholesale_orders(status);
create index if not exists wholesale_orders_created_at_idx on wholesale_orders(created_at desc);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table stores           enable row level security;
alter table products         enable row level security;
alter table wholesale_orders enable row level security;

-- stores: 管理者のみ全操作（anon は読み取り不可）
-- ※ service_role key は RLS をバイパスするため管理画面から全操作可

-- products: 全員 SELECT 可、INSERT/UPDATE/DELETE は管理者のみ
create policy "products_select_all" on products
  for select using (true);

-- wholesale_orders: INSERT は全員可（認証不要）、SELECT/UPDATE は管理者のみ
create policy "wholesale_orders_insert_all" on wholesale_orders
  for insert with check (true);

-- ============================================================
-- サンプルデータ（テスト用）
-- ============================================================
insert into stores (id, name, email, active) values
  ('cafe-yamada',  '山田カフェ',          'yamada@example.com', true),
  ('bar-suzuki',   '鈴木バー',            'suzuki@example.com', true),
  ('sauna-tanaka', 'たなかサウナ',        'tanaka@example.com', true)
on conflict (id) do nothing;

insert into products (id, name, unit, price, description, active) values
  ('cola-syrup',   'クラフトコーラ原液',   '本',  3500, '1本で約10杯分。希釈割合1:4推奨。',  true),
  ('sauna-honey',  'サウナハチミツ',       '瓶',  1800, '国産百花蜜。ロウリュ用・食用兼用。',  true),
  ('herb-salt',    'ハーブソルト',         '袋',   800, 'フィンランド産ハーブブレンド。',       true)
on conflict (id) do nothing;
