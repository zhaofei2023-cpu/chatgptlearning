-- 已完成 schema.sql + 002_institutions.sql 的项目执行一次；先备份。
-- 需要 Supabase Storage 的 storage.buckets / storage.objects。
begin;
create function public.scope_readable(i uuid) returns boolean language sql stable security definer set search_path='' as $$select public.session_role() is not null and (i is null or i=public.session_institution() or public.session_role()='platform_admin')$$;
create function public.content_visible(i uuid,s text) returns boolean language sql stable security definer set search_path='' as $$select public.administers(i) or (s='published' and public.scope_readable(i))$$;
create table public.learning_topics(id uuid primary key default gen_random_uuid(),institution_id uuid references public.institutions(id),title text not null check(length(trim(title)) between 1 and 80),description text not null default '' check(length(description)<=1000),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now());
create table public.learning_items(id uuid primary key default gen_random_uuid(),institution_id uuid references public.institutions(id),topic_id uuid references public.learning_topics(id),title text not null check(length(trim(title)) between 1 and 150),description text not null default '' check(length(description)<=4000),kind text not null check(kind in ('video','courseware','knowledge_map','document')),source_type text not null check(source_type in ('upload','link','text')),url text check(url ~ '^https://'),object_path text unique,file_name text,file_size bigint check(file_size between 1 and 41943040),mime_type text,body text not null default '' check(length(body)<=60000),status text not null default 'draft' check(status in ('draft','published')),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(status<>'published' or (source_type='upload' and object_path is not null) or (source_type='link' and url is not null) or (source_type='text' and length(trim(body))>0)),check(object_path is null or (split_part(object_path,'/',1)=coalesce(institution_id::text,'global') and split_part(object_path,'/',3)=id::text and split_part(object_path,'/',2) ~ '^[0-9a-f-]{36}$' and split_part(object_path,'/',4) ~ '^[0-9a-f-]{36}\.[a-z0-9]+$')));
create function public.validate_learning_item() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.topic_id is not null and not exists(select 1 from public.learning_topics where id=new.topic_id and institution_id is not distinct from new.institution_id) then raise exception '主题与素材的发布范围不一致';end if;
 new.updated_at=now();return new;end$$;
create trigger learning_item_valid before insert or update on public.learning_items for each row execute function public.validate_learning_item();
create table public.school_information(id uuid primary key default gen_random_uuid(),institution_id uuid references public.institutions(id),title text not null check(length(trim(title)) between 1 and 150),school_name text not null check(length(trim(school_name)) between 1 and 120),category text not null default '学校介绍' check(length(category) between 1 and 60),summary text not null default '' check(length(summary)<=1000),body text not null check(length(trim(body)) between 1 and 30000),official_url text check(official_url ~ '^https://'),status text not null default 'draft' check(status in ('draft','published')),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create function public.touch_school_information() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
create trigger school_information_touch before update on public.school_information for each row execute function public.touch_school_information();
create table public.competitions(id uuid primary key default gen_random_uuid(),institution_id uuid references public.institutions(id),title text not null check(length(trim(title)) between 1 and 150),description text not null default '' check(length(description)<=4000),requirements text not null check(length(trim(requirements)) between 1 and 12000),audience text not null default '本活动范围内的学生' check(length(audience)<=500),starts_at timestamptz not null,ends_at timestamptz not null,registration_deadline timestamptz not null,recurrence text not null default 'none' check(recurrence in ('none','weekly','monthly')),status text not null default 'draft' check(status in ('draft','published','cancelled')),created_by uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),check(ends_at>starts_at),check(registration_deadline<=starts_at));
create table public.competition_problems(id uuid primary key default gen_random_uuid(),competition_id uuid not null references public.competitions(id) on delete cascade,title text not null check(length(trim(title)) between 1 and 150),statement text not null check(length(trim(statement)) between 1 and 20000),input_format text not null default '' check(length(input_format)<=4000),output_format text not null default '' check(length(output_format)<=4000),sample_input text not null default '' check(length(sample_input)<=4000),sample_output text not null default '' check(length(sample_output)<=4000),max_score integer not null default 100 check(max_score between 1 and 1000),position integer not null default 1 check(position between 1 and 100),created_at timestamptz not null default now());
create table public.competition_entries(id uuid primary key default gen_random_uuid(),competition_id uuid not null references public.competitions(id) on delete cascade,student_id uuid not null default auth.uid() references public.profiles(id),created_at timestamptz not null default now(),unique(competition_id,student_id));
create table public.competition_submissions(id uuid primary key default gen_random_uuid(),problem_id uuid not null references public.competition_problems(id),student_id uuid not null default auth.uid() references public.profiles(id),code text not null check(length(trim(code)) between 1 and 100000),language text not null check(language in ('C++17','Python 3','Java 17')),status text not null default 'pending' check(status in ('pending','graded')),score numeric check(score>=0),feedback text check(length(feedback)<=4000),submitted_at timestamptz not null default now(),check(status<>'graded' or (score is not null and feedback is not null)));
create function public.competition_admin(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.competitions where id=c and public.administers(institution_id))$$;
create function public.problem_visible(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.competitions x where x.id=c and (public.administers(x.institution_id) or (public.content_visible(x.institution_id,x.status) and x.starts_at<=now() and (x.ends_at<=now() or public.session_role()='teacher' or exists(select 1 from public.competition_entries e where e.competition_id=x.id and e.student_id=auth.uid())))))$$;
create function public.problem_locked() returns trigger language plpgsql security definer set search_path='' as $$declare c uuid;begin
 if TG_OP='INSERT' then c=new.competition_id;else c=old.competition_id;end if;
 if exists(select 1 from public.competitions where id=c and status='published' and starts_at<=now()) then raise exception '竞赛已经开赛，不能修改或移除题目';end if;
 if TG_OP='DELETE' then return old;end if;return new;end$$;
create trigger competition_problem_lock before insert or update or delete on public.competition_problems for each row execute function public.problem_locked();
create function public.validate_competition() returns trigger language plpgsql security definer set search_path='' as $$begin
 if TG_OP='UPDATE' and old.status='published' and old.starts_at<=now() and (new.starts_at<>old.starts_at or new.ends_at<>old.ends_at or new.registration_deadline<>old.registration_deadline or new.requirements<>old.requirements or new.institution_id is distinct from old.institution_id or new.status='draft') then raise exception '已开赛活动不可改动赛程、要求或撤为草稿，可取消活动';end if;
 if new.status='published' and (TG_OP='INSERT' or old.status<>'published') and new.starts_at<=now() then raise exception '请设置未来的开赛时间再发布';end if;
 if new.status='published' and not exists(select 1 from public.competition_problems where competition_id=new.id) then raise exception '请至少添加一道题目再发布活动';end if;return new;end$$;
create trigger competition_valid before insert or update on public.competitions for each row execute function public.validate_competition();
create function public.validate_competition_submission() returns trigger language plpgsql security definer set search_path='' as $$declare limit_score integer;begin
 select max_score into limit_score from public.competition_problems where id=new.problem_id;
 if TG_OP='INSERT' then
  if public.session_role() is distinct from 'student' or new.student_id<>auth.uid() or not exists(select 1 from public.competition_problems p join public.competitions c on c.id=p.competition_id join public.competition_entries e on e.competition_id=c.id and e.student_id=auth.uid() where p.id=new.problem_id and c.status='published' and public.scope_readable(c.institution_id) and c.starts_at<=now() and now()<c.ends_at) then raise exception '仅已报名学生可在竞赛时间内提交';end if;
  new.status='pending';new.score=null;new.feedback=null;new.submitted_at=now();
 elsif new.score>limit_score then raise exception '分数超过题目满分';end if;
 return new;end$$;
create trigger competition_submission_valid before insert or update on public.competition_submissions for each row execute function public.validate_competition_submission();
-- 显式清除默认权限；角色由数据库决定，不依赖网页按钮。
alter table public.learning_topics enable row level security;
alter table public.learning_items enable row level security;
alter table public.school_information enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_problems enable row level security;
alter table public.competition_entries enable row level security;
alter table public.competition_submissions enable row level security;
revoke all on public.learning_topics,public.learning_items,public.school_information,public.competitions,public.competition_problems,public.competition_entries,public.competition_submissions from anon,authenticated;
grant select on public.learning_topics,public.learning_items,public.school_information,public.competitions,public.competition_problems,public.competition_entries,public.competition_submissions to authenticated;
grant insert on public.learning_topics,public.learning_items,public.school_information,public.competitions,public.competition_problems to authenticated;
grant update(title,description) on public.learning_topics to authenticated;
grant update(topic_id,title,description,kind,source_type,url,object_path,file_name,file_size,mime_type,body,status) on public.learning_items to authenticated;
grant update(title,school_name,category,summary,body,official_url,status,updated_at) on public.school_information to authenticated;
grant update(title,description,requirements,audience,starts_at,ends_at,registration_deadline,recurrence,status) on public.competitions to authenticated;
grant update(title,statement,input_format,output_format,sample_input,sample_output,max_score,position) on public.competition_problems to authenticated;
grant delete on public.competition_problems,public.learning_items to authenticated;
grant insert(competition_id,student_id) on public.competition_entries to authenticated;
grant insert(problem_id,student_id,code,language) on public.competition_submissions to authenticated;
grant update(score,feedback,status) on public.competition_submissions to authenticated;
create policy topics_read on public.learning_topics for select to authenticated using(public.scope_readable(institution_id));
create policy topics_create on public.learning_topics for insert to authenticated with check(public.administers(institution_id) and created_by=auth.uid());
create policy topics_edit on public.learning_topics for update to authenticated using(public.administers(institution_id)) with check(public.administers(institution_id));
create policy items_read on public.learning_items for select to authenticated using(public.content_visible(institution_id,status));
create policy items_create on public.learning_items for insert to authenticated with check(public.administers(institution_id) and created_by=auth.uid());
create policy items_edit on public.learning_items for update to authenticated using(public.administers(institution_id)) with check(public.administers(institution_id));
create policy items_remove on public.learning_items for delete to authenticated using(public.administers(institution_id));
create policy schools_read on public.school_information for select to authenticated using(public.content_visible(institution_id,status));
create policy schools_create on public.school_information for insert to authenticated with check(public.administers(institution_id) and created_by=auth.uid());
create policy schools_edit on public.school_information for update to authenticated using(public.administers(institution_id)) with check(public.administers(institution_id));
create policy contests_read on public.competitions for select to authenticated using(public.content_visible(institution_id,status) or (status='cancelled' and public.scope_readable(institution_id)));
create policy contests_create on public.competitions for insert to authenticated with check(public.administers(institution_id) and created_by=auth.uid());
create policy contests_edit on public.competitions for update to authenticated using(public.administers(institution_id)) with check(public.administers(institution_id));
create policy problems_read on public.competition_problems for select to authenticated using(public.problem_visible(competition_id));
create policy problems_create on public.competition_problems for insert to authenticated with check(public.competition_admin(competition_id));
create policy problems_edit on public.competition_problems for update to authenticated using(public.competition_admin(competition_id)) with check(public.competition_admin(competition_id));
create policy problems_remove on public.competition_problems for delete to authenticated using(public.competition_admin(competition_id));
create policy entries_read on public.competition_entries for select to authenticated using((student_id=auth.uid() and public.session_role()='student') or public.competition_admin(competition_id));
create policy entries_create on public.competition_entries for insert to authenticated with check(public.session_role()='student' and student_id=auth.uid() and exists(select 1 from public.competitions c where c.id=competition_id and public.content_visible(c.institution_id,c.status) and c.status='published' and now()<c.registration_deadline));
create policy contest_submission_read on public.competition_submissions for select to authenticated using((student_id=auth.uid() and public.session_role()='student') or exists(select 1 from public.competition_problems p where p.id=problem_id and public.competition_admin(p.competition_id)));
create policy contest_submission_create on public.competition_submissions for insert to authenticated with check(student_id=auth.uid() and public.session_role()='student');
create policy contest_submission_grade on public.competition_submissions for update to authenticated using(exists(select 1 from public.competition_problems p where p.id=problem_id and public.competition_admin(p.competition_id))) with check(exists(select 1 from public.competition_problems p where p.id=problem_id and public.competition_admin(p.competition_id)));
create index learning_items_topic on public.learning_items(topic_id);
create index learning_items_scope on public.learning_items(institution_id,status);
create index schools_scope on public.school_information(institution_id,status);
create index contests_scope on public.competitions(institution_id,status);
create index problems_contest on public.competition_problems(competition_id);
create index entries_student on public.competition_entries(student_id);
create index contest_submissions_problem on public.competition_submissions(problem_id);
create index contest_submissions_student on public.competition_submissions(student_id);
-- 私有文件桶：40MiB单文件限制。限额是免费首期的实现上限，不是无限存储承诺。
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('learning-materials','learning-materials',false,41943040,array['video/mp4','video/webm','application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','image/webp','text/plain','text/markdown']);
create function public.material_manage(n text,own_upload boolean) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.learning_items i where i.id::text=split_part(n,'/',3) and coalesce(i.institution_id::text,'global')=split_part(n,'/',1) and public.administers(i.institution_id) and (not own_upload or split_part(n,'/',2)=auth.uid()::text))$$;
create function public.material_read(n text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.learning_items i where i.object_path=n and i.id::text=split_part(n,'/',3) and coalesce(i.institution_id::text,'global')=split_part(n,'/',1) and public.content_visible(i.institution_id,i.status))$$;
create policy materials_read on storage.objects for select to authenticated using(bucket_id='learning-materials' and public.material_read(name));
create policy materials_upload on storage.objects for insert to authenticated with check(bucket_id='learning-materials' and public.material_manage(name,true));
create policy materials_remove on storage.objects for delete to authenticated using(bucket_id='learning-materials' and public.material_manage(name,false));
revoke all on function public.scope_readable(uuid),public.content_visible(uuid,text),public.validate_learning_item(),public.competition_admin(uuid),public.problem_visible(uuid),public.problem_locked(),public.validate_competition(),public.validate_competition_submission(),public.material_manage(text,boolean),public.material_read(text),public.touch_school_information() from public,anon,authenticated;
grant execute on function public.scope_readable(uuid),public.content_visible(uuid,text),public.competition_admin(uuid),public.problem_visible(uuid),public.material_manage(text,boolean),public.material_read(text) to authenticated;
commit;
