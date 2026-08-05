import type{VercelRequest,VercelResponse}from"@vercel/node";
import{requireIdentity,statusFor}from"./_supabase.js";
import{enforceRequestPolicy}from"./_security.js";

const isoDate=(value:unknown)=>/^\d{4}-\d{2}-\d{2}$/.test(String(value??""))?String(value):null;
const uuidOrNull=(value:unknown)=>/^[0-9a-f-]{36}$/i.test(String(value??""))?String(value):null;

export default async function handler(request:VercelRequest,response:VercelResponse){
 const policy=enforceRequestPolicy(request,response,request.method==="POST"?40:120);if(!policy.allowed)return;
 try{
  const identity=await requireIdentity(request);
  if(request.method==="GET"){
   const start=isoDate(request.query.start)??`${new Date().getFullYear()}-01-01`;const end=isoDate(request.query.end)??new Date().toISOString().slice(0,10);
   const{data,error}=await identity.supabase.rpc("get_management_accounts",{p_period_start:start,p_period_end:end});if(error)throw new Error(error.message);
   const{data:profile}=await identity.supabase.from("accounting_profiles").select("legal_form,reporting_framework,reporting_currency,financial_year_end_month,vat_registered,review_status").eq("tenant_id",data.tenantId).single();
   const{data:expenses}=await identity.supabase.from("finance_expenses").select("id,expense_date,supplier_name,description,amount_minor,account_code,evidence_status").eq("tenant_id",data.tenantId).order("expense_date",{ascending:false}).limit(20);
   return response.json({...data,profile,expenses:expenses??[],correlationId:policy.correlationId});
  }
  if(request.method!=="POST")return response.status(405).json({error:"Method not allowed",correlationId:policy.correlationId});
  const body=request.body??{};const action=String(body.action??"");const amountMinor=Math.round(Number(body.amount??0)*100);const date=isoDate(body.date);if(!date||amountMinor<=0)return response.status(400).json({error:"A valid date and positive amount are required.",correlationId:policy.correlationId});
  let result:{data:unknown;error:unknown};
  if(action==="invoice")result=await identity.supabase.rpc("record_sales_invoice",{p_description:String(body.description??""),p_amount_ex_vat_minor:amountMinor,p_invoice_date:date,p_job_id:uuidOrNull(body.jobId),p_invoice_id:uuidOrNull(body.invoiceId)});
  else if(action==="expense")result=await identity.supabase.rpc("record_finance_expense",{p_description:String(body.description??""),p_amount_minor:amountMinor,p_account_code:String(body.accountCode??"6900"),p_expense_date:date,p_supplier_name:String(body.supplierName??"")||null,p_job_id:uuidOrNull(body.jobId),p_evidence_reference:String(body.evidenceReference??"")||null});
  else if(action==="payment")result=await identity.supabase.rpc("record_customer_payment",{p_amount_minor:amountMinor,p_payment_date:date,p_reference:String(body.reference??"")||null,p_invoice_id:uuidOrNull(body.invoiceId),p_job_id:uuidOrNull(body.jobId)});
  else if(action==="contribution")result=await identity.supabase.rpc("record_owner_contribution",{p_amount_minor:amountMinor,p_entry_date:date,p_reference:String(body.reference??"")||null});
  else return response.status(400).json({error:"Unsupported finance action",correlationId:policy.correlationId});
  if(result.error)throw new Error((result.error as{message?:string}).message??"Finance posting failed");return response.status(201).json({result:result.data,correlationId:policy.correlationId});
 }catch(error){const failure=statusFor(error);return response.status(failure.status).json({error:failure.message,correlationId:policy.correlationId});}
}
