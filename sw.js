const CACHE_NAME="oma-agentti-preview-shell-v75";
const APP_SHELL=["./","./index.html","./styles.css","./app.js","./cloud.js","./research-sync.js","./stock-sync.js","./stock-workspace.js","./stock-chart.js","./stock-chart-utils.mjs","./approval-sync.js","./ai-research.js","./ai-data-quality.mjs","./privacy.md","./account-deletion.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||!url.pathname.startsWith(new URL("./",self.registration.scope).pathname))return;
 const fresh=url.pathname.endsWith(".js")||url.pathname.endsWith(".html")||event.request.mode==="navigate";
 if(fresh){
  event.respondWith(fetch(event.request).then(response=>{
   if(response.ok){const copy=response.clone();void caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
   return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match("./index.html"))));
 }else{
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
   if(response.ok&&response.type==="basic"){const copy=response.clone();void caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}
   return response;
  })));
 }
});