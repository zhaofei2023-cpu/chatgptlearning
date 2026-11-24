-- 第四版：在 schema + 002 + 003 后执行一次。执行前导出数据库备份。
-- 根据“每人每题仅保留最新代码”的要求，本迁移会清除同题旧提交代码；保留累计提交次数。
begin;
create table public.assignment_categories(
 id uuid primary key default gen_random_uuid(),teacher_id uuid not null default auth.uid() references public.profiles(id),
 institution_id uuid not null default public.session_institution() references public.institutions(id),
 title text not null check(length(trim(title)) between 1 and 80),created_at timestamptz not null default now(),unique(teacher_id,title));
alter table public.assignment_categories enable row level security;
create policy category_read on public.assignment_categories for select to authenticated using((public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution()) or public.administers(institution_id));
create policy category_create on public.assignment_categories for insert to authenticated with check(public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution());
create policy category_change on public.assignment_categories for update to authenticated using(public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution()) with check(public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution());
create policy category_delete on public.assignment_categories for delete to authenticated using(public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution());
revoke all on public.assignment_categories from public,anon,authenticated;
grant select,insert,delete on public.assignment_categories to authenticated;
grant update(title) on public.assignment_categories to authenticated;
alter table public.assignments add column category_id uuid references public.assignment_categories(id) on delete set null;
alter table public.assignments drop constraint assignments_status_check;
alter table public.assignments add constraint assignments_status_check check(status in ('draft','published','archived'));
grant update(category_id) on public.assignments to authenticated;
create function public.check_assignment_category() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.category_id is not null and not exists(select 1 from public.assignment_categories x join public.classes c on c.id=new.class_id where x.id=new.category_id and x.teacher_id=new.teacher_id and x.institution_id=c.institution_id) then raise exception '只能使用本教师、本机构的题目分类';end if;
 return new;end$$;
create trigger assignment_category_valid before insert or update on public.assignments for each row execute function public.check_assignment_category();
-- 归并旧记录，确定性保留 submitted_at 最新、id 最大的一条；只保留次数，不保存旧代码。
alter table public.submissions add column attempt_count integer not null default 1 check(attempt_count>0);
with counts as(select assignment_id,student_id,count(*) n from public.submissions group by assignment_id,student_id)
update public.submissions s set attempt_count=c.n from counts c where s.assignment_id=c.assignment_id and s.student_id=c.student_id;
delete from public.submissions where id in(select id from(select id,row_number() over(partition by assignment_id,student_id order by submitted_at desc,id desc) rn from public.submissions)x where rn>1);
alter table public.submissions add constraint submissions_latest_unique unique(assignment_id,student_id);
create function public.submit_solution(p_assignment uuid,p_code text,p_language text) returns public.submissions language plpgsql security definer set search_path='' as $$declare result public.submissions;begin
 if public.session_role() is distinct from 'student' then raise exception '仅有效学生可提交';end if;
 if length(trim(p_code)) not between 1 and 100000 or p_language not in ('C++17','Python 3','Java 17') or p_code is null or p_language is null then raise exception '代码或语言无效';end if;
 perform 1 from public.assignments where id=p_assignment and status='published' and due_at>now() and public.in_class(class_id) for share;
 if not found then raise exception '作业已截止、未发布或不属于你的班级';end if;
 insert into public.submissions as s(assignment_id,student_id,code,language) values(p_assignment,auth.uid(),p_code,p_language)
 on conflict(assignment_id,student_id) do update set code=excluded.code,language=excluded.language,student_name=excluded.student_name,status='pending',score=null,feedback=null,submitted_at=now(),attempt_count=s.attempt_count+1 returning * into result;
 return result;end$$;
create function public.grade_solution(p_submission uuid,p_revision integer,p_score numeric,p_feedback text) returns public.submissions language plpgsql security definer set search_path='' as $$declare result public.submissions;begin
 if not public.is_teacher() or not exists(select 1 from public.submissions s join public.assignments a on a.id=s.assignment_id where s.id=p_submission and public.owns_class(a.class_id)) then raise exception '无批阅权限';end if;
 if p_score is null or p_score<0 or p_score>100 or p_feedback is null or length(trim(p_feedback)) not between 1 and 4000 then raise exception '评分或反馈无效';end if;
 update public.submissions set score=p_score,feedback=p_feedback,status='graded' where id=p_submission and attempt_count=p_revision returning * into result;
 if not found then raise exception '学生已更新代码，请重新打开最新版本再批阅';end if;
 return result;end$$;
revoke insert,update on public.submissions from authenticated;
revoke insert(assignment_id,student_id,language,code,status,submitted_at),update(score,feedback,status) on public.submissions from authenticated;
-- 竞赛提交同样每名学生每题只保留最新版本。
alter table public.competition_submissions add column attempt_count integer not null default 1 check(attempt_count>0);
with counts as(select problem_id,student_id,count(*) n from public.competition_submissions group by problem_id,student_id)
update public.competition_submissions s set attempt_count=c.n from counts c where s.problem_id=c.problem_id and s.student_id=c.student_id;
delete from public.competition_submissions where id in(select id from(select id,row_number() over(partition by problem_id,student_id order by submitted_at desc,id desc) rn from public.competition_submissions)x where rn>1);
alter table public.competition_submissions add constraint competition_submissions_latest_unique unique(problem_id,student_id);
create function public.submit_competition_solution(p_problem uuid,p_code text,p_language text) returns public.competition_submissions language plpgsql security definer set search_path='' as $$declare result public.competition_submissions;begin
 if public.session_role() is distinct from 'student' or p_code is null or length(trim(p_code)) not between 1 and 100000 or p_language is null or p_language not in ('C++17','Python 3','Java 17') then raise exception '提交无效';end if;
 perform 1 from public.competition_problems p join public.competitions c on c.id=p.competition_id join public.competition_entries e on e.competition_id=c.id and e.student_id=auth.uid() where p.id=p_problem and c.status='published' and public.scope_readable(c.institution_id) and c.starts_at<=now() and now()<c.ends_at for share of c;
 if not found then raise exception '仅已报名学生可在竞赛时间内提交';end if;
 insert into public.competition_submissions as s(problem_id,student_id,code,language) values(p_problem,auth.uid(),p_code,p_language)
 on conflict(problem_id,student_id) do update set code=excluded.code,language=excluded.language,status='pending',score=null,feedback=null,submitted_at=now(),attempt_count=s.attempt_count+1 returning * into result;
 return result;end$$;
revoke insert on public.competition_submissions from authenticated;
revoke insert(problem_id,student_id,code,language) on public.competition_submissions from authenticated;
-- 私有封面桶，PNG/JPEG/WebP，单张最多5MiB。路径绑定资源范围与资源ID。
alter table public.learning_items add column cover_path text unique;
alter table public.learning_items add constraint learning_cover_path_valid check(cover_path is null or(split_part(cover_path,'/',1)=coalesce(institution_id::text,'global') and split_part(cover_path,'/',3)=id::text and split_part(cover_path,'/',2) ~ '^[0-9a-f-]{36}$' and split_part(cover_path,'/',4) ~ '^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'));
grant update(cover_path) on public.learning_items to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('learning-covers','learning-covers',false,5242880,array['image/png','image/jpeg','image/webp']);
create function public.cover_read(n text) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.learning_items i where i.cover_path=n and public.content_visible(i.institution_id,i.status)) or public.material_manage(n,false)$$;
create policy covers_read on storage.objects for select to authenticated using(bucket_id='learning-covers' and public.cover_read(name));
create policy covers_upload on storage.objects for insert to authenticated with check(bucket_id='learning-covers' and public.material_manage(name,true));
create policy covers_remove on storage.objects for delete to authenticated using(bucket_id='learning-covers' and public.material_manage(name,false));
-- 管理员报告与对话按机构隔离；教师、学生均不可读取。
create table public.study_reports(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles(id),institution_id uuid not null references public.institutions(id),created_by uuid not null default auth.uid() references public.profiles(id),period_days integer not null check(period_days in(7,14,30,90)),instructions text not null default '' check(length(instructions)<=6000),conversation jsonb not null default '[]'::jsonb check(jsonb_typeof(conversation)='array' and length(conversation::text)<=60000),content text not null check(length(content) between 1 and 40000),summary jsonb not null default '{}'::jsonb,created_at timestamptz not null default now());
alter table public.study_reports enable row level security;
create policy reports_read on public.study_reports for select to authenticated using(public.administers(institution_id));
create policy reports_create on public.study_reports for insert to authenticated with check(public.administers(institution_id) and created_by=auth.uid() and exists(select 1 from public.profiles p where p.id=student_id and p.role='student' and p.institution_id=study_reports.institution_id));
revoke all on public.study_reports from public,anon,authenticated;
grant select,insert on public.study_reports to authenticated;
create table public.study_report_templates(owner_id uuid primary key default auth.uid() references public.profiles(id),instructions text not null check(length(instructions) between 1 and 6000));
alter table public.study_report_templates enable row level security;
create policy template_own on public.study_report_templates for all to authenticated using(owner_id=auth.uid() and public.session_role() in ('platform_admin','org_admin')) with check(owner_id=auth.uid() and public.session_role() in ('platform_admin','org_admin'));
revoke all on public.study_report_templates from public,anon,authenticated;
grant select,insert,update,delete on public.study_report_templates to authenticated;
create table public.study_report_usage(actor_id uuid not null references public.profiles(id),day date not null,used integer not null check(used between 1 and 30),primary key(actor_id,day));
alter table public.study_report_usage enable row level security;
revoke all on public.study_report_usage from public,anon,authenticated;
create function public.consume_study_report_quota() returns integer language plpgsql security definer set search_path='' as $$declare n integer;begin
 if public.session_role() not in ('platform_admin','org_admin') or public.session_role() is null then raise exception '仅管理员可使用学情分析';end if;
 insert into public.study_report_usage as u(actor_id,day,used) values(auth.uid(),(now() at time zone 'Asia/Shanghai')::date,1) on conflict(actor_id,day) do update set used=u.used+1 where u.used<30 returning used into n;
 if n is null then raise exception '今日分析与对话次数已达30次';end if;return n;end$$;
revoke all on function public.check_assignment_category(),public.submit_solution(uuid,text,text),public.grade_solution(uuid,integer,numeric,text),public.submit_competition_solution(uuid,text,text),public.cover_read(text),public.consume_study_report_quota() from public,anon,authenticated;
grant execute on function public.submit_solution(uuid,text,text),public.grade_solution(uuid,integer,numeric,text),public.submit_competition_solution(uuid,text,text),public.cover_read(text),public.consume_study_report_quota() to authenticated;
create index assignment_category_idx on public.assignments(category_id);
create index study_reports_student_idx on public.study_reports(student_id,created_at desc);
notify pgrst,'reload schema';
commit;
