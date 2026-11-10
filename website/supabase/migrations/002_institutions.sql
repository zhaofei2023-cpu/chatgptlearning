-- 在 schema.sql 后执行；先备份。已有账号默认停用，需管理员明确分配机构。
begin;
create table public.institutions(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 80),code text not null unique check(code ~ '^[a-z0-9][a-z0-9_-]{2,19}$'),is_active boolean not null default true,created_at timestamptz not null default now());
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check(role in ('platform_admin','org_admin','teacher','student'));
alter table public.profiles add column institution_id uuid references public.institutions(id),add column username text check(username ~ '^[a-z0-9][a-z0-9_-]{2,31}$'),add column is_active boolean not null default false,add column must_change_password boolean not null default true,add unique(institution_id,username);
create function public.session_role() returns text language sql stable security definer set search_path='' as $$select p.role from public.profiles p left join public.institutions i on i.id=p.institution_id where p.id=auth.uid() and p.is_active and not p.must_change_password and (p.role='platform_admin' or i.is_active)$$;
create function public.session_institution() returns uuid language sql stable security definer set search_path='' as $$select institution_id from public.profiles where id=auth.uid() and public.session_role() is not null$$;
create function public.administers(i uuid) returns boolean language sql stable security definer set search_path='' as $$select coalesce(public.session_role()='platform_admin' or (public.session_role()='org_admin' and i=public.session_institution()),false)$$;
create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path='' as $$select coalesce(public.session_role()='teacher',false)$$;
alter table public.classes add column institution_id uuid references public.institutions(id) default public.session_institution();
create or replace function public.owns_class(c uuid) returns boolean language sql stable security definer set search_path='' as $$select public.is_teacher() and exists(select 1 from public.classes where id=c and teacher_id=auth.uid() and institution_id=public.session_institution())$$;
create or replace function public.in_class(c uuid) returns boolean language sql stable security definer set search_path='' as $$select public.session_role()='student' and exists(select 1 from public.memberships m join public.classes c1 on c1.id=m.class_id where c1.id=c and m.student_id=auth.uid() and c1.institution_id=public.session_institution())$$;
create function public.class_visible(c uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.classes where id=c and (public.administers(institution_id) or public.owns_class(id) or public.in_class(id)))$$;
create function public.password_changed() returns trigger language plpgsql security definer set search_path='' as $$begin if new.encrypted_password is distinct from old.encrypted_password then update public.profiles set must_change_password=false where id=new.id;end if;return new;end$$;
create trigger password_change_completed after update of encrypted_password on auth.users for each row execute function public.password_changed();
create or replace function public.join_class(invite text) returns uuid language plpgsql security definer set search_path='' as $$declare c uuid;begin
if public.session_role() is distinct from 'student' then raise exception '请使用有效学生账号';end if;
select id into c from public.classes where join_code=upper(trim(invite)) and institution_id=public.session_institution() and length(invite)<=30;
if c is null then raise exception '邀请码无效或不属于本机构';end if;
insert into public.memberships values(c,auth.uid()) on conflict do nothing;return c;end$$;
create function public.class_owner_valid() returns trigger language plpgsql security definer set search_path='' as $$begin
if not exists(select 1 from public.profiles where id=new.teacher_id and role='teacher' and is_active and institution_id=new.institution_id) then raise exception '班级教师机构不匹配';end if;return new;end$$;
create trigger class_owner_valid before insert or update on public.classes for each row execute function public.class_owner_valid();
create or replace function public.validate_submission() returns trigger language plpgsql security definer set search_path='' as $$begin
if new.student_id<>auth.uid() or public.session_role() is distinct from 'student' then raise exception '仅有效学生本人可提交';end if;
if not exists(select 1 from public.assignments a where a.id=new.assignment_id and a.status='published' and a.due_at>now() and public.in_class(a.class_id)) then raise exception '作业不可提交';end if;
select display_name into new.student_name from public.profiles where id=auth.uid();new.status='pending';new.score=null;new.feedback=null;new.submitted_at=now();return new;end$$;
alter table public.resources add column institution_id uuid references public.institutions(id) default public.session_institution();
-- 保留系统公开资源；旧教师资源不因缺少机构自动公开。
drop policy profile_self on public.profiles;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.administers(institution_id));
drop policy class_read on public.classes;
create policy class_read on public.classes for select to authenticated using(public.administers(institution_id) or (public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution()) or public.in_class(id));
drop policy class_create on public.classes;
create policy class_create on public.classes for insert to authenticated with check(public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution());
drop policy membership_read on public.memberships;
create policy membership_read on public.memberships for select to authenticated using((student_id=auth.uid() and public.in_class(class_id)) or public.owns_class(class_id) or exists(select 1 from public.classes c where c.id=class_id and public.administers(c.institution_id)));
drop policy assignment_read on public.assignments;
create policy assignment_read on public.assignments for select to authenticated using(public.owns_class(class_id) or exists(select 1 from public.classes c where c.id=class_id and public.administers(c.institution_id)) or (status='published' and public.in_class(class_id)));
drop policy assignment_update on public.assignments;
create policy assignment_update on public.assignments for update to authenticated using(public.owns_class(class_id) and teacher_id=auth.uid()) with check(public.owns_class(class_id) and teacher_id=auth.uid());
drop policy submission_read on public.submissions;
create policy submission_read on public.submissions for select to authenticated using((student_id=auth.uid() and public.session_role()='student') or exists(select 1 from public.assignments a where a.id=assignment_id and (public.owns_class(a.class_id) or exists(select 1 from public.classes c where c.id=a.class_id and public.administers(c.institution_id)))));
drop policy resource_read on public.resources;
create policy resource_read on public.resources for select to anon,authenticated using((institution_id is null and teacher_id is null) or (public.session_role() is not null and institution_id=public.session_institution()) or public.administers(institution_id));
drop policy resource_create on public.resources;
create policy resource_create on public.resources for insert to authenticated with check(public.is_teacher() and teacher_id=auth.uid() and institution_id=public.session_institution());
alter table public.institutions enable row level security;
create policy institution_read on public.institutions for select to authenticated using(public.administers(id) or id=public.session_institution());
create table public.account_audit(id uuid primary key default gen_random_uuid(),actor_id uuid references public.profiles(id),institution_id uuid references public.institutions(id),target_id uuid,action text not null,created_at timestamptz not null default now());
alter table public.account_audit enable row level security;
create policy audit_read on public.account_audit for select to authenticated using(public.administers(institution_id));
grant select on public.institutions,public.account_audit to authenticated;
revoke all on function public.session_role(),public.session_institution(),public.administers(uuid),public.class_visible(uuid),public.password_changed(),public.class_owner_valid() from public,anon,authenticated;
grant execute on function public.session_role(),public.session_institution(),public.administers(uuid),public.class_visible(uuid) to authenticated;
-- 公开资源策略在匿名请求中也调用这些只返回当前会话范围的函数。
grant execute on function public.session_role(),public.session_institution(),public.administers(uuid) to anon;
create index profiles_institution on public.profiles(institution_id);
create index classes_institution on public.classes(institution_id);
create index resources_institution on public.resources(institution_id);
create or replace function public.consume_mentor_quota() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if public.session_role() is null then raise exception '请先登录';end if;
 insert into public.mentor_usage as m(user_id,day,used) values(auth.uid(),(now() at time zone 'UTC')::date,1)
 on conflict(user_id,day) do update set used=m.used+1 where m.used<20 returning used into n;
 if n is null then raise exception '今日学习助手请求次数已用完';end if;return n;
end $$;
commit;
