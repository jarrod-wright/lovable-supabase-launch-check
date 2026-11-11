create type public.app_role as enum ('admin','member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Signed-in users read profiles" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Signed-in users read roles" on public.user_roles for select to authenticated using (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  current_period_end timestamptz,
  environment text not null default 'sandbox',
  updated_at timestamptz not null default now()
);
grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "Users read own subscription" on public.subscriptions for select to authenticated using (auth.uid() = user_id);

create or replace function public.is_pro(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.subscriptions
    where user_id = _user_id and status in ('active','trialing')
    and (current_period_end is null or current_period_end > now()))
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'member');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.get_team_roster()
returns table (user_id uuid, display_name text, email text, role text, plan text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name,
    case when public.has_role(auth.uid(),'admin') then u.email::text else null end,
    case when public.has_role(p.id,'admin') then 'admin' else 'member' end,
    case when public.is_pro(p.id) then 'Pro' else 'Free' end,
    p.created_at
  from public.profiles p join auth.users u on u.id = p.id
  where auth.uid() is not null
  order by p.created_at
$$;
revoke execute on function public.get_team_roster() from anon, public;
grant execute on function public.get_team_roster() to authenticated;

create or replace function public.promote_to_admin(_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then
    raise exception 'Only store owners can promote members' using errcode = '42501';
  end if;
  insert into public.user_roles (user_id, role) values (_target,'admin') on conflict do nothing;
  delete from public.user_roles where user_id = _target and role = 'member';
end $$;
revoke execute on function public.promote_to_admin(uuid) from anon, public;
grant execute on function public.promote_to_admin(uuid) to authenticated;

create table public.products (
  id serial primary key,
  name text not null,
  category text not null,
  price numeric(10,2) not null
);
grant select on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Signed-in read products" on public.products for select to authenticated using (true);

create table public.orders (
  id serial primary key,
  product_id int not null references public.products(id),
  quantity int not null,
  total numeric(10,2) not null,
  customer_ref text not null,
  created_at timestamptz not null
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Signed-in read orders" on public.orders for select to authenticated using (true);

insert into public.products (name, category, price) values
 ('Linen Tote Bag','Bags',38.00),
 ('Ceramic Pour-Over','Kitchen',54.00),
 ('Beeswax Candle Trio','Home',29.00),
 ('Merino Beanie','Apparel',42.00),
 ('Walnut Desk Tray','Office',65.00),
 ('Organic Tea Sampler','Pantry',24.00),
 ('Recycled Notebook Set','Office',18.00),
 ('Stoneware Mug','Kitchen',22.00);

insert into public.orders (product_id, quantity, total, customer_ref, created_at)
select pid, qty, round((select price from public.products where id = pid) * qty, 2),
  'C' || lpad(((g * 37) % 140 + 1)::text, 4, '0'),
  date_trunc('day', now()) - ((g % 90) || ' days')::interval - ((g * 7 % 24) || ' hours')::interval
from (
  select g,
    ((g * 13 + (g / 7)) % 8) + 1 as pid,
    (g % 3) + 1 as qty
  from generate_series(1, 620) as g
  where (g % 90) < 90 - ((g * 11) % 25)
) s;

create or replace function public.get_pro_insights()
returns json language plpgsql stable security definer set search_path = public as $$
declare result json;
begin
  if not public.is_pro(auth.uid()) then
    raise exception 'Pro subscription required' using errcode = '42501';
  end if;
  select json_build_object(
    'repeat_rate', (select round(100.0 * count(*) filter (where n > 1) / nullif(count(*),0), 1)
                    from (select customer_ref, count(*) n from orders group by 1) c),
    'customers', (select count(distinct customer_ref) from orders),
    'ltv', (select round(avg(t),2) from (select sum(total) t from orders group by customer_ref) x),
    'cohorts', (select coalesce(json_agg(c order by c.month),'[]') from (
        select to_char(first_month,'Mon') as month, first_month,
          count(*) as customers, round(avg(spent),2) as avg_spend
        from (select customer_ref, date_trunc('month', min(created_at)) first_month, sum(total) spent
              from orders group by 1) f group by first_month) c(month, first_month, customers, avg_spend)),
    'categories', (select coalesce(json_agg(x),'[]') from (
        select p.category, round(sum(o.total),2) revenue from orders o join products p on p.id=o.product_id
        group by 1 order by 2 desc) x)
  ) into result;
  return result;
end $$;
revoke execute on function public.get_pro_insights() from anon, public;
grant execute on function public.get_pro_insights() to authenticated;