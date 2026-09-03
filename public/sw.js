const BUILD_VERSION="__HADIR_BUILD_VERSION__";
const CACHE=`hadir-shell-${BUILD_VERSION}`;
const BASE=new URL("./",self.registration.scope).pathname;
const APP_SHELL=[
  new URL("./",self.registration.scope).href,
  new URL("./manifest.webmanifest",self.registration.scope).href,
  new URL("./favicon.svg",self.registration.scope).href
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.all(APP_SHELL.map(url=>cache.add(url).catch(()=>undefined)));
    const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    clients.forEach(client=>client.postMessage({type:"HADIR_SW_UPDATE_AVAILABLE"}));
  })());
});

self.addEventListener("activate",event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key.startsWith("hadir-shell-")&&key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener("message",event=>{
  if(event.data?.type==="SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;

  event.respondWith(
    fetch(request)
      .then(response=>response)
      .catch(()=>caches.match(request).then(cached=>cached||caches.match(new URL("./",self.registration.scope).href)))
  );
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

self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let data={};
    try{
      data=event.data?event.data.json():{};
    }catch{
      data={body:event.data?.text()||"لديك إشعار جديد في Hadir"};
    }
    const title=String(data.title||"إشعار جديد");
    const body=String(data.body||data.message||"لديك إشعار جديد في Hadir");
    const url=resolveNotificationUrl(data.url||data.path||"/");
    const icon=new URL("./favicon.svg",self.registration.scope).href;
    await self.registration.showNotification(title,{body,icon,badge:icon,dir:"rtl",lang:"ar",tag:String(data.tag||`hadir-${data.type||"notification"}`),renotify:true,data:{url,type:String(data.type||"info"),notificationId:String(data.notificationId||data.id||"")}});
  })());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const target=resolveNotificationUrl(event.notification.data?.url||event.notification.data?.path||"");
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    for(const client of windows){
      if("navigate" in client){try{await client.navigate(target);await client.focus();return;}catch{}}
      if("focus" in client){try{await client.focus();return;}catch{}}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target);
  })());
});