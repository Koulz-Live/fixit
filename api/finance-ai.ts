import{createHash}from"node:crypto";
import type{VercelRequest,VercelResponse}from"@vercel/node";
import{requireIdentity,statusFor}from"./_supabase.js";
import{enforceRequestPolicy,recordSecurityEvent}from"./_security.js";

function outputText(result:any){for(const item of result.output??[])for(const content of item.content??[])if(content.type==="output_text"&&content.text)return content.text;return""}
export default async function handler(request:VercelRequest,response:VercelResponse){
 const policy=enforceRequestPolicy(request,response,10);if(!policy.allowed)return;
 try{
  if(request.method!=="POST")return response.status(405).json({error:"Method not allowed",correlationId:policy.correlationId});
  const identity=await requireIdentity(request);const start=String(request.body?.start??"");const end=String(request.body?.end??"");if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end))return response.status(400).json({error:"Invalid reporting period"});
  if(!process.env.OPENAI_API_KEY)throw new Error("OPENAI_NOT_CONFIGURED");
  const{data:accounts,error:accountsError}=await identity.supabase.rpc("get_management_accounts",{p_period_start:start,p_period_end:end});if(accountsError)throw new Error(accountsError.message);
  const ledgerPayload=JSON.stringify({periodStart:start,periodEnd:end,currency:accounts.currency,summary:accounts.summary,jobs:accounts.jobs,evidence:accounts.evidence,disclaimer:accounts.disclaimer});const fingerprint=createHash("sha256").update(ledgerPayload).digest("hex");const model=process.env.OPENAI_MODEL??"gpt-5.6-terra";
  const openai=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({model,store:false,safety_identifier:createHash("sha256").update(identity.userId).digest("hex"),reasoning:{effort:"low"},instructions:"You are a management-accounting explainer for South African artisan businesses. Use only the supplied ledger aggregates. Never invent transactions, tax positions, assurance, or compliance claims. Explain profit versus cash plainly. State that the accounts are platform-generated and require accountant review. Return valid JSON matching the schema.",input:ledgerPayload,text:{verbosity:"low",format:{type:"json_schema",name:"management_commentary",strict:true,schema:{type:"object",additionalProperties:false,properties:{headline:{type:"string"},summary:{type:"string"},strengths:{type:"array",items:{type:"string"},maxItems:4},risks:{type:"array",items:{type:"string"},maxItems:4},actions:{type:"array",items:{type:"string"},maxItems:5},accountantReview:{type:"string"}},required:["headline","summary","strengths","risks","actions","accountantReview"]}}}})});
  if(!openai.ok)throw new Error(`OPENAI_${openai.status}`);const raw=await openai.json();const text=outputText(raw);const commentary=JSON.parse(text);
  const{data:commentaryId,error:saveError}=await identity.supabase.rpc("save_management_commentary",{p_period_start:start,p_period_end:end,p_model:model,p_prompt_version:"finance-commentary-v1",p_commentary:commentary,p_ledger_fingerprint:fingerprint});if(saveError)throw new Error(saveError.message);
  await recordSecurityEvent(identity,{...policy,category:"ai",action:"management_commentary.generated",outcome:"success",resourceType:"management_commentary",resourceId:String(commentaryId),metadata:{model,promptVersion:"finance-commentary-v1"}});
  return response.json({commentary,commentaryId,model,ledgerFingerprint:fingerprint,correlationId:policy.correlationId});
 }catch(error){const failure=statusFor(error);return response.status(failure.status).json({error:failure.message,correlationId:policy.correlationId});}
}
