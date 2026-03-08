-- Dashboard OS Schema
-- Run this in Supabase SQL Editor to set up the backend

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Ideas Table
create table if not exists public.ideas (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  content text,
  tags text[] default '{}',
  source text default 'manual', -- 'manual', 'telegram', 'vps'
  status text default 'active', -- 'active', 'archived'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid default auth.uid() -- Optional owner
);

-- 2. Tasks Table (Kanban)
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  status text default 'todo', -- 'backlog', 'todo', 'in_progress', 'done'
  priority text default 'medium', -- 'low', 'medium', 'high', 'urgent'
  project_id uuid references public.projects(id),
  assignee text default 'me', -- 'me', 'agent'
  due_date timestamp with time zone,
  tags text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Projects Table
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  status text default 'active', -- 'active', 'paused', 'completed'
  progress integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Agents Table (Status Monitoring)
create table if not exists public.agents (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique, -- 'OpenClaw', 'Antigravity', 'Hunter'
  status text default 'offline', -- 'online', 'offline', 'idle', 'error'
  last_active timestamp with time zone,
  current_task text,
  location text, -- 'VPS', 'Mac'
  cpu_usage integer,
  memory_usage integer,
  meta jsonb default '{}'::jsonb
);

-- 5. History Table (Activity Log)
create table if not exists public.history (
  id uuid primary key default uuid_generate_v4(),
  action text not null, -- 'created_task', 'agent_started', etc.
  details jsonb,
  source text not null, -- 'user', 'agent_name'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table public.ideas enable row level security;
alter table public.tasks enable row level security;
alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.history enable row level security;

-- Create Policies (Allow public read/write for now, or authenticated users only)
-- NOTE: User requested simplistic setup. We'll allow public access for the API key usage, 
-- but ideally this should be restricted to authenticated users.
create policy "Enable all access for anon" on public.ideas for all using (true) with check (true);
create policy "Enable all access for anon" on public.tasks for all using (true) with check (true);
create policy "Enable all access for anon" on public.projects for all using (true) with check (true);
create policy "Enable all access for anon" on public.agents for all using (true) with check (true);
create policy "Enable all access for anon" on public.history for all using (true) with check (true);

-- Populate Default Data
insert into public.projects (name, description, status) values
('JadiSatu Platform', 'Building the main ecosystem', 'active'),
('Personal Brand', 'Content creation and social media', 'active'),
('Kuliah', 'University tasks and assignments', 'active'),
('Hunter Agent', 'Lead generation system', 'active')
on conflict do nothing;

insert into public.agents (name, status, location) values
('OpenClaw', 'offline', 'VPS (Hostinger)'),
('Antigravity', 'offline', 'MacBook Air'),
('Hunter', 'offline', 'VPS (Hostinger)')
on conflict (name) do nothing;
