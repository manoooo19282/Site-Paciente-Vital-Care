const CACHE='vitalcare-paciente-v5.2.1-logo-original';
const ASSETS=['./','./index.html','./login.html','./styles.css?v=5.2.1','./integration.css?v=5.2.1','./login.css?v=5.2.1','./config.js?v=5.2.1','./script.js?v=5.2.1','./login.js?v=5.2.1','./manifest.webmanifest','./assets/favicon.svg','./vitalcare-minha-fila-logo-521.png','./assets/vitalcare-minha-fila-logo-521.png'];
self.addEventListener('install',event=>{self.skipWaiting();event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);
  // Nunca intercepta Supabase, CDN ou origens externas. Dados privados jamais entram no cache PWA.
  if(url.origin!==self.location.origin)return;
  // HTML e scripts principais usam rede primeiro para impedir que versões antigas reapareçam.
  if(req.mode==='navigate'||/\.(?:js|css|png|webp|jpg|jpeg|svg)$/.test(url.pathname)){
    event.respondWith(fetch(req,{cache:'no-store'}).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return resp;}).catch(()=>caches.match(req).then(x=>x||caches.match('./login.html'))));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(resp=>{if(resp.ok){const copy=resp.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return resp;})));
});
