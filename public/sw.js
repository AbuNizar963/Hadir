const CACHE="hadir-shell-v10";
const BASE=new URL("./",self.registration.scope).pathname;
const APP_SHELL=[new URL("./",self.registration.scope).href,new URL("./manifest.webmanifest",self.registration.scope).href];

self.addEventListener("install",e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(APP_SHELL);await self.skipWaiting();})()));

self.addEventListener("activate",e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith("hadir-shell-")&&k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
  const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  for(const client of windows)client.postMessage({type:"HADIR_SW_UPDATED"});
})()));

self.addEventListener("message",e=>{if(e.data?.type==="HADIR_SKIP_WAITING")void self.skipWaiting();});

self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  const u=new URL(r.url);if(u.origin!==self.location.origin||!u.pathname.startsWith(BASE))return;
  if(u.pathname.startsWith(`${BASE}api/`))return;
  if(r.mode==="navigate"){
    e.respondWith(fetch(r,{cache:"no-store",redirect:"follow"}).then(response=>{
      if(response.ok){const copy=response.clone();void caches.open(CACHE).then(c=>c.put(new URL("./",self.registration.scope).href,copy));}
      return response;
    }).catch(()=>caches.match(new URL("./",self.registration.scope).href)));
    return;
  }
  e.respondWith(fetch(r,{cache:"no-store"}).then(response=>{
    if(response.ok&&u.pathname.endsWith("/manifest.webmanifest")){const copy=response.clone();void caches.open(CACHE).then(c=>c.put(u.href,copy));}
    return response;
  }).catch(()=>caches.match(r).then(c=>c||caches.match(new URL("./",self.registration.scope).href))));
});

function resolveNotificationUrl(value){const fallback=new URL("./",self.registration.scope).href;try{const target=new URL(String(value||""),self.registration.scope);if(target.origin!==self.location.origin||!target.pathname.startsWith(BASE))return fallback;return target.href;}catch{return fallback;}}

self.addEventListener("push",e=>e.waitUntil((async()=>{let d={};try{d=e.data?e.data.json():{body:e.data?.text()||"لديك إشعار جديد في Hadir"};}catch{d={body:e.data?.text()||"لديك إشعار جديد في Hadir"};}const title=String(d.title||"إشعار جديد");const body=String(d.body||d.message||"لديك إشعار جديد في Hadir");const url=resolveNotificationUrl(d.url||d.path||"/");const icon=new URL("./favicon.svg",self.registration.scope).href;await self.registration.showNotification(title,{body,icon,badge:icon,dir:"rtl",lang:"ar",tag:String(d.tag||`hadir-${d.type||"notification"}`),renotify:true,data:{url,type:String(d.type||"info"),notificationId:String(d.notificationId||d.id||"")}});})());

self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil((async()=>{const target=resolveNotificationUrl(e.notification.data?.url||e.notification.data?.path||"");const list=await clients.matchAll({type:"window",includeUncontrolled:true});for(const client of list){if("focus" in client){await client.focus();if("navigate" in client)await client.navigate(target);return;}}if(self.clients.openWindow)await self.clients.openWindow(target);})());});
