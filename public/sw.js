const CACHE="hadir-shell-v3";
const BASE=new URL("./",self.registration.scope).pathname;
const APP_SHELL=[new URL("./",self.registration.scope).href,new URL("./employee",self.registration.scope).href,new URL("./manifest.webmanifest",self.registration.scope).href];

self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
  const r=e.request;
  if(r.method!=="GET")return;
  const u=new URL(r.url);
  if(u.origin!==self.location.origin||!u.pathname.startsWith(BASE))return;
  e.respondWith(fetch(r).catch(()=>caches.match(r).then(c=>c||caches.match(new URL("./",self.registration.scope).href))));
});

function resolveNotificationUrl(value){
  const fallback=new URL("./",self.registration.scope).href;
  try{
    const target=new URL(String(value||""),self.registration.scope);
    if(target.origin!==self.location.origin)return fallback;
    if(!target.pathname.startsWith(BASE))return fallback;
    return target.href;
  }catch{return fallback;}
}

self.addEventListener("push",e=>e.waitUntil((async()=>{
  let d={};
  try{d=e.data?e.data.json():{}}catch{d={body:e.data?.text()||"لديك إشعار جديد في Hadir"};}
  const title=String(d.title||"إشعار جديد");
  const body=String(d.body||d.message||"لديك إشعار جديد في Hadir");
  const url=resolveNotificationUrl(d.url||d.path||"/");
  const icon=new URL("./favicon.svg",self.registration.scope).href;
  await self.registration.showNotification(title,{
    body,
    icon,
    badge:icon,
    dir:"rtl",
    lang:"ar",
    tag:String(d.tag||`hadir-${d.type||"notification"}`),
    renotify:true,
    data:{url,type:String(d.type||"info"),notificationId:String(d.notificationId||d.id||"")}
  });
})());

self.addEventListener("notificationclick",e=>{
  e.notification.close();
  e.waitUntil((async()=>{
    const target=resolveNotificationUrl(e.notification.data?.url||e.notification.data?.path||"");
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if("navigate" in client){
        try{await client.navigate(target);await client.focus();return;}catch{}
      }
      if("focus" in client){
        try{await client.focus();return;}catch{}
      }
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});
