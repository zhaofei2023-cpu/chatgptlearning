-- 在新建Supabase项目的SQL Editor中执行。适用于全新数据库；不要对已有生产库盲目重复执行。
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 60),
 role text not null default 'student' check(role in ('student','teacher')),
 created_at timestamptz not null default now()
);
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,display_name,role) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'探索者同学'),60),'student');
 return new;
end $$;
create trigger create_profile after insert on auth.users for each row execute function public.handle_new_user();
create function public.is_teacher() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.profiles where id=auth.uid() and role='teacher')$$;
create table public.classes (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 80),
 teacher_id uuid not null references public.profiles(id),
 join_code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
 created_at timestamptz not null default now()
);
create table public.memberships (class_id uuid not null references public.classes(id) on delete cascade, student_id uuid not null references public.profiles(id) on delete cascade, primary key(class_id,student_id));
create function public.owns_class(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.classes where id=c and teacher_id=auth.uid())$$;
create function public.in_class(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.memberships where class_id=c and student_id=auth.uid())$$;
create function public.join_class(invite text) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='student') then raise exception '请使用学生账号加入班级';end if;
 if length(invite)>30 then raise exception '邀请码无效';end if;
 select id into c from public.classes where join_code=upper(trim(invite));
 if c is null then raise exception '邀请码无效';end if;
 insert into public.memberships values(c,auth.uid()) on conflict do nothing;
 return c;
end $$;
create table public.assignments (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.classes(id) on delete cascade,
 teacher_id uuid not null references public.profiles(id),title text not null check(length(title) between 1 and 120),
 statement text not null check(length(statement) between 1 and 15000),input_format text not null check(length(input_format)<=4000),output_format text not null check(length(output_format)<=4000),
 sample_input text not null default '' check(length(sample_input)<=4000),sample_output text not null default '' check(length(sample_output)<=4000),
 tags text[] not null default '{}',level text not null default '入门' check(level in ('入门','进阶','挑战')),
 status text not null default 'draft' check(status in ('draft','published')),due_at timestamptz not null,
 created_at timestamptz not null default now()
);
create function public.check_assignment_owner() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.classes where id=new.class_id and teacher_id=new.teacher_id) then raise exception '题目教师须为班级创建者';end if;
 if array_length(new.tags,1)>20 then raise exception '标签过多';end if;
 return new;
end $$;
create trigger assignment_owner before insert or update on public.assignments for each row execute function public.check_assignment_owner();
create table public.submissions (
 id uuid primary key default gen_random_uuid(),assignment_id uuid not null references public.assignments(id) on delete cascade,
 student_id uuid not null references public.profiles(id),student_name text not null default '',
 code text not null check(length(code) between 1 and 100000),language text not null check(language in ('C++17','Python 3','Java 17')),
 status text not null default 'pending' check(status in ('pending','graded')),score numeric check(score between 0 and 100),feedback text check(length(feedback)<=4000),
 submitted_at timestamptz not null default now(),check(status<>'graded' or (score is not null and feedback is not null))
);
create function public.validate_submission() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.student_id<>auth.uid() or not exists(select 1 from public.profiles where id=auth.uid() and role='student') then raise exception '仅学生本人可提交';end if;
 if not exists(select 1 from public.assignments a join public.memberships m on m.class_id=a.class_id where a.id=new.assignment_id and a.status='published' and a.due_at>now() and m.student_id=auth.uid()) then raise exception '作业不存在、已截止或你未加入班级';end if;
 select display_name into new.student_name from public.profiles where id=auth.uid();
 new.status='pending';new.score=null;new.feedback=null;new.submitted_at=now();return new;
end $$;
create trigger submission_validation before insert on public.submissions for each row execute function public.validate_submission();
create table public.resources (
 id uuid primary key default gen_random_uuid(),teacher_id uuid references public.profiles(id),title text not null check(length(title) between 1 and 150),
 school text not null check(length(school)<=100),kind text not null check(kind in ('视频','课件')),
 description text not null check(length(description)<=1000),url text not null check(url ~ '^https?://'),
 level text default '学习资料',tags text[] not null default '{}',color text default 'blue',created_at timestamptz not null default now()
);
create table public.mentor_usage(user_id uuid not null references public.profiles(id) on delete cascade,day date not null,used integer not null check(used between 0 and 20),primary key(user_id,day));
create function public.consume_mentor_quota() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid()) then raise exception '请先登录';end if;
 insert into public.mentor_usage as m(user_id,day,used) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set used=m.used+1 where m.used<20 returning used into n;
 if n is null then raise exception '今日学习助手请求次数已用完';end if;return n;
end $$;
-- 全部业务表开启RLS：前端角色切换不能绕过这些策略。
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.memberships enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.resources enable row level security;
alter table public.mentor_usage enable row level security;
create policy profile_self on public.profiles for select to authenticated using(id=auth.uid());
create policy class_read on public.classes for select to authenticated using(teacher_id=auth.uid() or public.in_class(id));
create policy class_create on public.classes for insert to authenticated with check(public.is_teacher() and teacher_id=auth.uid());
create policy membership_read on public.memberships for select to authenticated using(student_id=auth.uid() or public.owns_class(class_id));
create policy assignment_read on public.assignments for select to authenticated using(teacher_id=auth.uid() or (status='published' and public.in_class(class_id)));
create policy assignment_create on public.assignments for insert to authenticated with check(public.is_teacher() and teacher_id=auth.uid() and public.owns_class(class_id));
create policy assignment_update on public.assignments for update to authenticated using(public.is_teacher() and teacher_id=auth.uid()) with check(public.is_teacher() and teacher_id=auth.uid() and public.owns_class(class_id));
create policy submission_read on public.submissions for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.assignments a where a.id=assignment_id and a.teacher_id=auth.uid()));
create policy submission_create on public.submissions for insert to authenticated with check(student_id=auth.uid() and not public.is_teacher() and exists(select 1 from public.assignments a where a.id=assignment_id and a.status='published' and a.due_at>now() and public.in_class(a.class_id)));
create policy submission_grade on public.submissions for update to authenticated using(public.is_teacher() and exists(select 1 from public.assignments a where a.id=assignment_id and a.teacher_id=auth.uid())) with check(public.is_teacher() and exists(select 1 from public.assignments a where a.id=assignment_id and a.teacher_id=auth.uid()));
create policy resource_read on public.resources for select to anon,authenticated using(true);
create policy resource_create on public.resources for insert to authenticated with check(public.is_teacher() and teacher_id=auth.uid());
-- 最小化表权限；没有授予学生修改分数或教师修改提交代码的权限。
revoke all on public.profiles,public.classes,public.memberships,public.assignments,public.submissions,public.resources,public.mentor_usage from anon,authenticated;
grant select on public.resources to anon;
grant select on public.profiles,public.classes,public.memberships,public.assignments,public.submissions,public.resources to authenticated;
grant insert on public.classes,public.assignments,public.resources to authenticated;
grant insert(assignment_id,student_id,language,code,status,submitted_at) on public.submissions to authenticated;
grant update(score,feedback,status) on public.submissions to authenticated;
grant update(title,statement,input_format,output_format,sample_input,sample_output,tags,level,status,due_at) on public.assignments to authenticated;
revoke all on function public.handle_new_user(),public.validate_submission(),public.check_assignment_owner(),public.join_class(text),public.consume_mentor_quota(),public.is_teacher(),public.owns_class(uuid),public.in_class(uuid) from public,anon,authenticated;
grant execute on function public.join_class(text),public.consume_mentor_quota(),public.is_teacher(),public.owns_class(uuid),public.in_class(uuid) to authenticated;
create index assignment_class on public.assignments(class_id);
create index submission_assignment on public.submissions(assignment_id);
create index submission_student on public.submissions(student_id);
create index membership_student on public.memberships(student_id);
insert into public.resources(title,school,kind,description,url,level,tags,color) values
('Introduction to Algorithms','MIT OpenCourseWare','视频','算法设计与复杂度分析。英语公开课程，含讲义与视频入口。','https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/','进阶',array['算法设计','公开课'],'mint'),
('CS50 · 计算机科学导论','Harvard University','视频','计算机科学与程序设计入门，访问官方课程页。','https://cs50.harvard.edu/x/','入门',array['计算思维','C语言'],'violet'),
('Programming Abstractions','Stanford University','课件','递归、抽象与数据结构，部分资源可能需要登录。','https://cs106b.stanford.edu/','进阶',array['C++','数据结构'],'blue'),
('OI Wiki · 信息学知识地图','开源竞赛学习资源','课件','中文竞赛知识库，系统学习算法和数据结构。','https://oi-wiki.org/','入门',array['中文','竞赛体系'],'orange');
commit;
