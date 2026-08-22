export type IntegrationEvent={type:string;timestamp:string;actorId?:string;employeeId?:string;payload:Record<string,unknown>};
export type IntegrationProvider="webhook"|"github"|"n8n"|"make"|"zapier"|"power-automate"|"custom";
export interface IntegrationAdapter{provider:IntegrationProvider;name:string;enabled:boolean;send(event:IntegrationEvent):Promise<void>}
const configured=(import.meta.env.VITE_INTEGRATION_WEBHOOK_URL||"").trim();
const enabled=import.meta.env.VITE_INTEGRATIONS_ENABLED!=="false";
export const integrationConfig={enabled,providers:(import.meta.env.VITE_INTEGRATION_PROVIDERS||"webhook,github,n8n,make,zapier,power-automate").split(",").map(v=>v.trim()).filter(Boolean) as IntegrationProvider[]};
export async function emitIntegrationEvent(event:IntegrationEvent){if(!enabled||!configured)return;try{await fetch(configured,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({source:"hadir",version:1,event}),keepalive:true});}catch{/* integrations must never break attendance */}}
export function integrationHealth(){return {enabled:integrationConfig.enabled,webhookConfigured:Boolean(configured),providers:integrationConfig.providers};}
