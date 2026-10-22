const db=window.agentSupabaseClient;
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const key=(u,s)=>"oma-preview-research-"+s+"-"+u;
let owner=null,version=0,working=false,original=null,active=false,loading=false;
const queued=u=>get(key(u,"queue"),[]);
function merge(rows,changes){const m=new Map(rows.map(x=>[x.id,x]));for(const c of changes){if(c.action==="delete")m.delete(c.id);else m.set(c.id,c.item)}return [...m.values()]}
function show(rows){window.agentResearchBridge?.set(rows)}
function indicator(){document.dispatchEvent(new CustomEvent("agent:research-sync-status",{detail:{pending:owner?queued(owner).length:0}}))}
async function flush(){
 if(!owner||working||!navigator.onLine)return;
 const u=owner;working=true;
 try{while(owner===u&&navigator.onLine){
 const q=queued(u);if(!q.length)break;const c=q[0];
 const result=c.action==="delete"
 ?await db.from("research_sync").delete().eq("id",c.id).eq("user_id",u)
 :await db.from("research_sync").upsert({id:c.item.id,user_id:u,query:c.item.query,created_at:new Date(c.item.created).toISOString()});
 if(result.error)throw result.error;
 const latest=queued(u);
 if(latest.find(x=>x.id===c.id)?.stamp===c.stamp)localStorage.setItem(key(u,"queue"),JSON.stringify(latest.filter(x=>x.id!==c.id)));
 indicator();
 }}catch(e){console.warn("Research sync:",e.message)}
 finally{working=false;indicator()}
}
async function session(){
 const v=++version;
 const {data}=await db.auth.getSession();
 if(v!==version)return;
 const u=data.session?.user?.id||null;
 if(!u){owner=null;if(active&&original)show(original);active=false;indicator();return}
 if(!active)original=window.agentResearchBridge?.get()||[];
 active=true;owner=u;
 const cached=get(key(u,"cache"),null);
 if(cached!==null)show(merge(cached,queued(u)));
 else if(queued(u).length)show(merge([],queued(u)));
 indicator();
 if(navigator.onLine){
 const res=await db.from("research_sync").select("id,query,created_at").eq("user_id",u);
 if(v!==version||owner!==u)return;
 if(!res.error){const remote=res.data.map(x=>({id:x.id,query:x.query,created:Date.parse(x.created_at)}));const rows=merge(remote,queued(u));localStorage.setItem(key(u,"cache"),JSON.stringify(rows));show(rows)}
 }
 await flush();
}
document.addEventListener("agent:research-change",e=>{
 if(!owner)return;
 const u=owner,{action,item,id}=e.detail;
 const c={action,item,id:id||item?.id,stamp:crypto.randomUUID()};
 localStorage.setItem(key(u,"queue"),JSON.stringify([...queued(u).filter(x=>x.id!==c.id),c]));
 localStorage.setItem(key(u,"cache"),JSON.stringify(merge(get(key(u,"cache"),[]),[c])));
 indicator();flush();
});
window.addEventListener("online",()=>{flush();session()});
window.addEventListener("focus",flush);
db.auth.onAuthStateChange(()=>setTimeout(session,0));
await session();
