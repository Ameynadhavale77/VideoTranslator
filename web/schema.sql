-- Create a table for Public Profiles (managed by Supabase Auth, but we use this for extra data if needed)
-- Actually, we'll just use the 'auth.users' table for generic auth, 
-- and a public 'users' table to link to it + 'credits'.

-- 1. Create 'credits' table
create table credits (
  user_id uuid references auth.users not null primary key,
  balance_seconds int default 3600, -- Give 1 Hour Free on sign up
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table credits enable row level security;

-- 3. Policy: Users can only see their own credits
create policy "Users can view own credits" on credits
  for select using (auth.uid() = user_id);

-- 4. Function to automatically create a credit entry when a new user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.credits (user_id, balance_seconds)
  values (new.id, 3600); -- 3600 seconds = 1 hour free
  return new;
end;
$$ language plpgsql security definer;

-- 5. Trigger the function on new user creation
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
