import type { VercelRequest,VercelResponse } from "@vercel/node";
import { requireIdentity,statusFor } from "./_supabase.js";
import { enforceRequestPolicy,recordSecurityEvent } from "./_security.js";

export default async function handler(request:VercelRequest,response:VercelResponse){
  const policy=enforceRequestPolicy(request,response,60); if(!policy.allowed)return;
  try{
    if(request.method!=="GET")return response.status(405).json({error:"Method not allowed",correlationId:policy.correlationId});
    const identity=await requireIdentity(request); const {data,error}=await identity.supabase.rpc("get_security_overview");
    if(error){await recordSecurityEvent(identity,{...policy,category:"authorization",action:"security.overview.read",severity:"medium",outcome:"denied",reasonCode:error.message});throw new Error(error.message);}
    await recordSecurityEvent(identity,{...policy,category:"security_operations",action:"security.overview.read",outcome:"success"});
    return response.json({...data,correlationId:policy.correlationId});
  }catch(error){const failure=statusFor(error);return response.status(failure.status).json({error:failure.message,correlationId:policy.correlationId});}
}
