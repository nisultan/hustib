-- Telegram bot: one linked chat per account, and a log of what was sent.
--
-- Linking: the app writes a short-lived random `link_code` into the user's
-- own row (RLS lets them), then opens t.me/<bot>?start=<code>. The bot's
-- webhook runs with the service role, finds the row by code and fills in
-- `chat_id`. The browser can never write `chat_id` itself — the column
-- grants below leave it out — so nobody can point their reminders at
-- someone else's chat.

create table if not exists telegram_links (
  user_id          uuid primary key default auth.uid() references auth.users on delete cascade,
  chat_id          bigint unique,
  username         text,
  link_code        text unique,
  code_expires_at  timestamptz,
  timezone         text not null default 'Asia/Almaty',
  morning_hour     smallint not null default 8,
  evening_hour     smallint not null default 21,
  notify_blocks    boolean not null default true,
  paused           boolean not null default false,
  linked_at        timestamptz,
  created_at       timestamptz not null default now(),
  constraint morning_hour_is_hour check (morning_hour between 0 and 23),
  constraint evening_hour_is_hour check (evening_hour between 0 and 23)
);

alter table telegram_links enable row level security;
alter table telegram_links force row level security;
drop policy if exists telegram_links_owner on telegram_links;
create policy telegram_links_owner on telegram_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke insert, update on telegram_links from authenticated, anon;
grant select, delete on telegram_links to authenticated;
grant insert (link_code, code_expires_at, timezone, morning_hour, evening_hour, notify_blocks, paused)
  on telegram_links to authenticated;
grant update (link_code, code_expires_at, timezone, morning_hour, evening_hour, notify_blocks, paused)
  on telegram_links to authenticated;

-- One row per message sent, keyed so the same reminder never goes twice.
-- No policies: only the server (service role) reads or writes it.
create table if not exists telegram_sent (
  user_id  uuid not null references auth.users on delete cascade,
  key      text not null,
  sent_at  timestamptz not null default now(),
  primary key (user_id, key)
);

alter table telegram_sent enable row level security;
alter table telegram_sent force row level security;
