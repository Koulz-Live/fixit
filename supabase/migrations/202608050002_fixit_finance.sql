-- Fixit Finance: tenant-scoped double-entry accounting and management accounts.
create type public.account_type as enum ('asset','liability','equity','revenue','expense');

create table public.accounting_profiles (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  legal_form text not null default 'sole_proprietor' check(legal_form in ('sole_proprietor','private_company','partnership','other')),
  reporting_framework text not null default 'ifrs_for_smes_2015' check(reporting_framework in ('ifrs_for_smes_2015','ifrs_for_smes_2025')),
  framework_effective_from date not null default current_date,
  reporting_currency text not null default 'ZAR',
  financial_year_end_month smallint not null default 2 check(financial_year_end_month between 1 and 12),
  vat_registered boolean not null default false,
  vat_number text,
  vat_effective_from date,
  standard_vat_rate numeric(5,4) not null default 0.1500,
  review_status text not null default 'unreviewed' check(review_status in ('unreviewed','artisan_confirmed','accountant_reviewed','independently_assured')),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table public.gl_accounts (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,name text not null,account_type public.account_type not null,
  normal_balance text not null check(normal_balance in ('debit','credit')),system_account boolean not null default false,
  active boolean not null default true,created_at timestamptz not null default now(),unique(tenant_id,code)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
  entry_number bigint generated always as identity,entry_date date not null,description text not null,
  source_type text not null check(source_type in ('opening_balance','invoice','payment','expense','owner_contribution','adjustment','reversal')),
  source_id uuid,correlation_id uuid not null default gen_random_uuid(),status text not null default 'draft' check(status in ('draft','posted','reversed')),
  evidence_status text not null default 'platform_generated' check(evidence_status in ('platform_generated','artisan_confirmed','source_document_supported','bank_reconciled','accountant_reviewed','independently_assured')),
  created_by uuid not null references public.profiles(user_id),created_at timestamptz not null default now(),posted_at timestamptz,reversal_of uuid references public.journal_entries(id),
  unique(tenant_id,entry_number)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.gl_accounts(id),description text not null,debit_minor bigint not null default 0,credit_minor bigint not null default 0,
  job_id uuid references public.jobs(id),invoice_id uuid references public.invoices(id),
  check(debit_minor>=0 and credit_minor>=0 and ((debit_minor>0 and credit_minor=0) or (credit_minor>0 and debit_minor=0)))
);

create table public.finance_expenses (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),job_id uuid references public.jobs(id),
  expense_date date not null,supplier_name text,description text not null,amount_minor bigint not null check(amount_minor>0),
  vat_minor bigint not null default 0,account_code text not null,evidence_reference text,evidence_status text not null default 'artisan_confirmed',
  journal_entry_id uuid not null unique references public.journal_entries(id),created_by uuid not null references public.profiles(user_id),created_at timestamptz not null default now()
);

create table public.finance_payments (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),invoice_id uuid references public.invoices(id),job_id uuid references public.jobs(id),
  payment_date date not null,amount_minor bigint not null check(amount_minor>0),payment_method text not null default 'bank_transfer',reference text,
  journal_entry_id uuid not null unique references public.journal_entries(id),created_by uuid not null references public.profiles(user_id),created_at timestamptz not null default now()
);

create table public.accounting_period_closes (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),period_start date not null,period_end date not null,
  status text not null default 'open' check(status in ('open','review','closed','reopened')),reconciliation_status text not null default 'not_started' check(reconciliation_status in ('not_started','in_progress','reconciled')),
  closed_by uuid references public.profiles(user_id),closed_at timestamptz,reviewed_by uuid references public.profiles(user_id),notes text,unique(tenant_id,period_start,period_end)
);

create table public.management_commentaries (
  id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id),period_start date not null,period_end date not null,
  model text not null,prompt_version text not null,commentary jsonb not null,ledger_fingerprint text not null,
  status text not null default 'draft' check(status in ('draft','artisan_confirmed','accountant_reviewed')),
  generated_by uuid not null references public.profiles(user_id),generated_at timestamptz not null default now()
);

create index journal_entries_tenant_date_idx on public.journal_entries(tenant_id,entry_date desc) where status='posted';
create index journal_lines_entry_idx on public.journal_lines(journal_entry_id);
create index journal_lines_job_idx on public.journal_lines(job_id) where job_id is not null;
create index finance_expenses_tenant_idx on public.finance_expenses(tenant_id,expense_date desc);

create or replace function public.ensure_finance_workspace() returns uuid language plpgsql security definer set search_path=public as $$
declare v_ctx jsonb;v_tenant uuid;
begin
  if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED';end if;
  v_ctx:=public.ensure_marketplace_context(coalesce(auth.jwt()->'user_metadata'->>'full_name',split_part(auth.jwt()->>'email','@',1)));
  v_tenant:=(v_ctx->>'artisanTenantId')::uuid;
  if not public.has_tenant_role(v_tenant,'user_artisan') then raise exception 'FORBIDDEN';end if;
  insert into public.accounting_profiles(tenant_id) values(v_tenant) on conflict do nothing;
  insert into public.gl_accounts(tenant_id,code,name,account_type,normal_balance,system_account) values
    (v_tenant,'1000','Bank','asset','debit',true),(v_tenant,'1100','Trade receivables','asset','debit',true),(v_tenant,'1200','Materials inventory','asset','debit',false),
    (v_tenant,'2000','Trade payables','liability','credit',true),(v_tenant,'2100','VAT control','liability','credit',true),(v_tenant,'2200','Customer deposits','liability','credit',true),
    (v_tenant,'3000','Owner capital','equity','credit',true),(v_tenant,'3100','Retained earnings','equity','credit',true),
    (v_tenant,'4000','Service revenue','revenue','credit',true),(v_tenant,'4100','Call-out revenue','revenue','credit',false),
    (v_tenant,'5000','Direct materials','expense','debit',true),(v_tenant,'5100','Direct labour','expense','debit',true),(v_tenant,'5200','Subcontractors','expense','debit',false),
    (v_tenant,'6000','Vehicle and travel','expense','debit',false),(v_tenant,'6100','Tools and equipment','expense','debit',false),(v_tenant,'6200','Platform and payment fees','expense','debit',false),(v_tenant,'6900','Other operating expenses','expense','debit',false)
  on conflict(tenant_id,code) do nothing;
  return v_tenant;
end $$;

create or replace function public.assert_journal_balanced(p_entry uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_debit bigint;v_credit bigint;v_count int;
begin
  select coalesce(sum(debit_minor),0),coalesce(sum(credit_minor),0),count(*) into v_debit,v_credit,v_count from public.journal_lines where journal_entry_id=p_entry;
  if v_count<2 or v_debit<=0 or v_debit<>v_credit then raise exception 'UNBALANCED_JOURNAL';end if;
end $$;

create or replace function public.record_sales_invoice(p_description text,p_amount_ex_vat_minor bigint,p_invoice_date date,p_job_id uuid default null,p_invoice_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;v_entry uuid:=gen_random_uuid();v_ar uuid;v_revenue uuid;v_vat_account uuid;v_vat_registered boolean;v_vat_rate numeric;v_vat bigint:=0;v_corr uuid:=gen_random_uuid();
begin
  v_tenant:=public.ensure_finance_workspace();if p_amount_ex_vat_minor<=0 or length(trim(p_description))<3 then raise exception 'INVALID_INVOICE';end if;
  select vat_registered,standard_vat_rate into v_vat_registered,v_vat_rate from public.accounting_profiles where tenant_id=v_tenant;
  if v_vat_registered then v_vat:=round(p_amount_ex_vat_minor*v_vat_rate);end if;
  select id into v_ar from public.gl_accounts where tenant_id=v_tenant and code='1100';select id into v_revenue from public.gl_accounts where tenant_id=v_tenant and code='4000';select id into v_vat_account from public.gl_accounts where tenant_id=v_tenant and code='2100';
  insert into public.journal_entries(id,tenant_id,entry_date,description,source_type,source_id,correlation_id,status,evidence_status,created_by) values(v_entry,v_tenant,p_invoice_date,trim(p_description),'invoice',p_invoice_id,v_corr,'draft','platform_generated',auth.uid());
  insert into public.journal_lines(journal_entry_id,account_id,description,debit_minor,credit_minor,job_id,invoice_id) values(v_entry,v_ar,'Customer receivable',p_amount_ex_vat_minor+v_vat,0,p_job_id,p_invoice_id),(v_entry,v_revenue,trim(p_description),0,p_amount_ex_vat_minor,p_job_id,p_invoice_id);
  if v_vat>0 then insert into public.journal_lines(journal_entry_id,account_id,description,debit_minor,credit_minor,job_id,invoice_id) values(v_entry,v_vat_account,'Output VAT',0,v_vat,p_job_id,p_invoice_id);end if;
  perform public.assert_journal_balanced(v_entry);update public.journal_entries set status='posted',posted_at=now() where id=v_entry;
  perform public.record_security_event(v_corr,'application','finance','sales_invoice.posted','info','success',v_tenant,'invoice',coalesce(p_invoice_id,v_entry)::text,null,null,null,jsonb_build_object('amountExVatMinor',p_amount_ex_vat_minor,'vatMinor',v_vat));
  return jsonb_build_object('journalEntryId',v_entry,'totalMinor',p_amount_ex_vat_minor+v_vat,'vatMinor',v_vat,'correlationId',v_corr);
end $$;

create or replace function public.record_finance_expense(p_description text,p_amount_minor bigint,p_account_code text,p_expense_date date,p_supplier_name text default null,p_job_id uuid default null,p_evidence_reference text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;v_entry uuid:=gen_random_uuid();v_expense uuid:=gen_random_uuid();v_debit uuid;v_bank uuid;v_corr uuid:=gen_random_uuid();
begin
  v_tenant:=public.ensure_finance_workspace();
  if p_amount_minor<=0 or length(trim(p_description))<3 then raise exception 'INVALID_EXPENSE';end if;
  select id into v_debit from public.gl_accounts where tenant_id=v_tenant and code=p_account_code and account_type='expense' and active;
  select id into v_bank from public.gl_accounts where tenant_id=v_tenant and code='1000';if v_debit is null or v_bank is null then raise exception 'INVALID_ACCOUNT';end if;
  insert into public.journal_entries(id,tenant_id,entry_date,description,source_type,source_id,correlation_id,status,evidence_status,created_by,posted_at) values(v_entry,v_tenant,p_expense_date,trim(p_description),'expense',v_expense,v_corr,'draft',case when p_evidence_reference is null then 'artisan_confirmed' else 'source_document_supported' end,auth.uid(),null);
  insert into public.journal_lines(journal_entry_id,account_id,description,debit_minor,credit_minor,job_id) values(v_entry,v_debit,trim(p_description),p_amount_minor,0,p_job_id),(v_entry,v_bank,'Cash paid',0,p_amount_minor,p_job_id);
  perform public.assert_journal_balanced(v_entry);update public.journal_entries set status='posted',posted_at=now() where id=v_entry;
  insert into public.finance_expenses(id,tenant_id,job_id,expense_date,supplier_name,description,amount_minor,account_code,evidence_reference,evidence_status,journal_entry_id,created_by) values(v_expense,v_tenant,p_job_id,p_expense_date,p_supplier_name,trim(p_description),p_amount_minor,p_account_code,p_evidence_reference,case when p_evidence_reference is null then 'artisan_confirmed' else 'source_document_supported' end,v_entry,auth.uid());
  perform public.record_security_event(v_corr,'application','finance','expense.posted','info','success',v_tenant,'expense',v_expense::text,null,null,null,jsonb_build_object('amountMinor',p_amount_minor,'accountCode',p_account_code));
  return jsonb_build_object('id',v_expense,'journalEntryId',v_entry,'correlationId',v_corr);
end $$;

create or replace function public.record_customer_payment(p_amount_minor bigint,p_payment_date date,p_reference text default null,p_invoice_id uuid default null,p_job_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;v_entry uuid:=gen_random_uuid();v_payment uuid:=gen_random_uuid();v_bank uuid;v_ar uuid;v_corr uuid:=gen_random_uuid();
begin
  v_tenant:=public.ensure_finance_workspace();if p_amount_minor<=0 then raise exception 'INVALID_PAYMENT';end if;
  select id into v_bank from public.gl_accounts where tenant_id=v_tenant and code='1000';select id into v_ar from public.gl_accounts where tenant_id=v_tenant and code='1100';
  insert into public.journal_entries(id,tenant_id,entry_date,description,source_type,source_id,correlation_id,status,evidence_status,created_by) values(v_entry,v_tenant,p_payment_date,'Customer payment','payment',v_payment,v_corr,'draft','artisan_confirmed',auth.uid());
  insert into public.journal_lines(journal_entry_id,account_id,description,debit_minor,credit_minor,job_id,invoice_id) values(v_entry,v_bank,'Payment received',p_amount_minor,0,p_job_id,p_invoice_id),(v_entry,v_ar,'Receivable settled',0,p_amount_minor,p_job_id,p_invoice_id);
  perform public.assert_journal_balanced(v_entry);update public.journal_entries set status='posted',posted_at=now() where id=v_entry;
  insert into public.finance_payments(id,tenant_id,invoice_id,job_id,payment_date,amount_minor,reference,journal_entry_id,created_by) values(v_payment,v_tenant,p_invoice_id,p_job_id,p_payment_date,p_amount_minor,p_reference,v_entry,auth.uid());
  perform public.record_security_event(v_corr,'application','finance','payment.posted','info','success',v_tenant,'payment',v_payment::text,null,null,null,jsonb_build_object('amountMinor',p_amount_minor));
  return jsonb_build_object('id',v_payment,'journalEntryId',v_entry,'correlationId',v_corr);
end $$;

create or replace function public.record_owner_contribution(p_amount_minor bigint,p_entry_date date,p_reference text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;v_entry uuid:=gen_random_uuid();v_bank uuid;v_equity uuid;v_corr uuid:=gen_random_uuid();
begin
 v_tenant:=public.ensure_finance_workspace();if p_amount_minor<=0 then raise exception 'INVALID_AMOUNT';end if;
 select id into v_bank from public.gl_accounts where tenant_id=v_tenant and code='1000';select id into v_equity from public.gl_accounts where tenant_id=v_tenant and code='3000';
 insert into public.journal_entries(id,tenant_id,entry_date,description,source_type,correlation_id,status,evidence_status,created_by) values(v_entry,v_tenant,p_entry_date,coalesce(p_reference,'Owner contribution'),'owner_contribution',v_corr,'draft','artisan_confirmed',auth.uid());
 insert into public.journal_lines(journal_entry_id,account_id,description,debit_minor,credit_minor) values(v_entry,v_bank,'Funds introduced',p_amount_minor,0),(v_entry,v_equity,'Owner capital',0,p_amount_minor);
 perform public.assert_journal_balanced(v_entry);update public.journal_entries set status='posted',posted_at=now() where id=v_entry;
 return jsonb_build_object('journalEntryId',v_entry,'correlationId',v_corr);
end $$;

create or replace function public.get_management_accounts(p_period_start date,p_period_end date) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;v_result jsonb;
begin
 v_tenant:=public.ensure_finance_workspace();if p_period_end<p_period_start then raise exception 'INVALID_PERIOD';end if;
 with balances as (
   select a.code,a.name,a.account_type,sum(l.debit_minor-l.credit_minor) debit_net,sum(l.credit_minor-l.debit_minor) credit_net
   from public.journal_entries e join public.journal_lines l on l.journal_entry_id=e.id join public.gl_accounts a on a.id=l.account_id
   where e.tenant_id=v_tenant and e.status='posted' and e.entry_date<=p_period_end and (a.account_type in ('asset','liability','equity') or e.entry_date>=p_period_start) group by a.id
 ), totals as (
   select coalesce(sum(credit_net) filter(where account_type='revenue'),0) revenue,coalesce(sum(debit_net) filter(where account_type='expense'),0) expenses,
   coalesce(sum(debit_net) filter(where account_type='asset'),0) assets,coalesce(sum(credit_net) filter(where account_type='liability'),0) liabilities,coalesce(sum(credit_net) filter(where account_type='equity'),0) equity from balances
 ), jobs_data as (
   select l.job_id,j.job_number,j.title,coalesce(sum(l.credit_minor-l.debit_minor) filter(where a.account_type='revenue'),0) revenue,coalesce(sum(l.debit_minor-l.credit_minor) filter(where a.account_type='expense'),0) costs
   from public.journal_entries e join public.journal_lines l on l.journal_entry_id=e.id join public.gl_accounts a on a.id=l.account_id left join public.jobs j on j.id=l.job_id
   where e.tenant_id=v_tenant and e.status='posted' and e.entry_date between p_period_start and p_period_end and l.job_id is not null group by l.job_id,j.job_number,j.title
 )
 select jsonb_build_object('tenantId',v_tenant,'periodStart',p_period_start,'periodEnd',p_period_end,'currency','ZAR',
   'summary',jsonb_build_object('revenueMinor',revenue,'expensesMinor',expenses,'profitMinor',revenue-expenses,'assetsMinor',assets,'liabilitiesMinor',liabilities,'equityMinor',equity),
   'accounts',coalesce((select jsonb_agg(jsonb_build_object('code',code,'name',name,'type',account_type,'balanceMinor',case when account_type in ('asset','expense') then debit_net else credit_net end) order by code) from balances),'[]'::jsonb),
   'jobs',coalesce((select jsonb_agg(jsonb_build_object('jobId',job_id,'jobNumber',job_number,'title',title,'revenueMinor',revenue,'costsMinor',costs,'marginMinor',revenue-costs)) from jobs_data),'[]'::jsonb),
   'evidence',jsonb_build_object('postedEntries',(select count(*) from public.journal_entries where tenant_id=v_tenant and status='posted' and entry_date between p_period_start and p_period_end),'unreconciledEntries',(select count(*) from public.journal_entries where tenant_id=v_tenant and status='posted' and evidence_status not in ('bank_reconciled','accountant_reviewed','independently_assured') and entry_date between p_period_start and p_period_end)),
   'disclaimer','Platform-generated management accounts. Not audited or independently reviewed unless explicitly marked.') into v_result from totals;
 return v_result;
end $$;

create or replace function public.save_management_commentary(p_period_start date,p_period_end date,p_model text,p_prompt_version text,p_commentary jsonb,p_ledger_fingerprint text) returns uuid language plpgsql security definer set search_path=public as $$
declare v_tenant uuid;v_id uuid:=gen_random_uuid();
begin v_tenant:=public.ensure_finance_workspace();insert into public.management_commentaries(id,tenant_id,period_start,period_end,model,prompt_version,commentary,ledger_fingerprint,generated_by) values(v_id,v_tenant,p_period_start,p_period_end,p_model,p_prompt_version,p_commentary,p_ledger_fingerprint,auth.uid());return v_id;end $$;

alter table public.accounting_profiles enable row level security;alter table public.gl_accounts enable row level security;alter table public.journal_entries enable row level security;alter table public.journal_lines enable row level security;alter table public.finance_expenses enable row level security;alter table public.finance_payments enable row level security;alter table public.accounting_period_closes enable row level security;alter table public.management_commentaries enable row level security;
create policy "finance profile tenant" on public.accounting_profiles for select using(public.is_tenant_member(tenant_id));
create policy "chart tenant" on public.gl_accounts for select using(public.is_tenant_member(tenant_id));
create policy "journal tenant" on public.journal_entries for select using(public.is_tenant_member(tenant_id));
create policy "journal lines tenant" on public.journal_lines for select using(exists(select 1 from public.journal_entries e where e.id=journal_entry_id and public.is_tenant_member(e.tenant_id)));
create policy "expense tenant" on public.finance_expenses for select using(public.is_tenant_member(tenant_id));
create policy "payment tenant" on public.finance_payments for select using(public.is_tenant_member(tenant_id));
create policy "close tenant" on public.accounting_period_closes for select using(public.is_tenant_member(tenant_id));
create policy "commentary tenant" on public.management_commentaries for select using(public.is_tenant_member(tenant_id));
grant execute on function public.ensure_finance_workspace() to authenticated;grant execute on function public.record_sales_invoice(text,bigint,date,uuid,uuid) to authenticated;grant execute on function public.record_finance_expense(text,bigint,text,date,text,uuid,text) to authenticated;grant execute on function public.record_customer_payment(bigint,date,text,uuid,uuid) to authenticated;grant execute on function public.record_owner_contribution(bigint,date,text) to authenticated;grant execute on function public.get_management_accounts(date,date) to authenticated;grant execute on function public.save_management_commentary(date,date,text,text,jsonb,text) to authenticated;
