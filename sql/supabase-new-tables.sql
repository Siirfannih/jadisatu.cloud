-- New tables for JadiSatu Dashboard OS Integration

-- 1. Morning Briefings Table
CREATE TABLE IF NOT EXISTS public.morning_briefings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  energy_level TEXT NOT NULL, -- 'Low', 'Medium', 'High', 'Peak'
  focus_domain TEXT NOT NULL, -- 'Work', 'Learn', 'Business', 'Personal'
  priority_task TEXT NOT NULL,
  blockers TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date)
);

-- 2. Domains Table (computed from tasks, but can be used for customization)
CREATE TABLE IF NOT EXISTS public.domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- 'work', 'learn', 'business', 'personal'
  display_name TEXT NOT NULL,
  icon TEXT, -- icon name
  color TEXT, -- color name
  total_tasks INTEGER DEFAULT 0,
  completed_tasks INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Schedule Blocks Table
CREATE TABLE IF NOT EXISTS public.schedule_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  title TEXT NOT NULL,
  domain TEXT, -- 'work', 'learn', 'business', 'personal'
  type TEXT DEFAULT 'task', -- 'task', 'meeting', 'break', 'deep_work'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add domain field to existing tasks table if not exists
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'personal';

-- Enable RLS
ALTER TABLE public.morning_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_blocks ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY Enable all access for anon ON public.morning_briefings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY Enable all access for anon ON public.domains FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY Enable all access for anon ON public.schedule_blocks FOR ALL USING (true) WITH CHECK (true);

-- Insert default domains
INSERT INTO public.domains (name, display_name, icon, color) VALUES
('work', 'Work', 'Briefcase', 'blue'),
('learn', 'Learn', 'GraduationCap', 'purple'),
('business', 'Business', 'TrendingUp', 'green'),
('personal', 'Personal', 'Heart', 'pink')
ON CONFLICT (name) DO NOTHING;

-- Insert sample schedule blocks for today
INSERT INTO public.schedule_blocks (date, start_time, end_time, title, domain, type) VALUES
(CURRENT_DATE, '09:00', '11:00', 'Deep Work', 'work', 'deep_work'),
(CURRENT_DATE, '13:00', '15:00', 'Kuliah', 'learn', 'task'),
(CURRENT_DATE, '15:00', '17:00', 'Ojek', 'business', 'task')
ON CONFLICT DO NOTHING;
