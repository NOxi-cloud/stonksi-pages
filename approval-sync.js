const db=window.agentSupabaseClient;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const key=(u,s)=>"oma-preview-approvals-"+s+"-"+u;
let owner=null,version=0,busy=false,active=false,original=null;
const pending=u=>read(key(u,"queue"),[]);
function merge(rows,changes){const m=new Map(rows.map(x=>[x.id,x]));for(const c of changes)m.set(c.item.id,c.item);return [...m.values()]}
function show(items){window.agentApprovalBridge?.set(items)}
async function flush(){
 if(!owner||busy||!navigator.onLine)return;
 const uid=owner;busy=true;
 try{while(owner===uid&&navigator.onLine){
 const q=pending(uid);if(!q.length)break;const c=q[0];
 const result=await db.from("approval_sync").upsert({id:c.item.id,user_id:uid,title:c.item.title,detail:c.item.detail||"",status:c.item.status,created_at:new Date(c.item.created).toISOString()});
 if(result.error)throw result.error;
 const latest=pending(uid);
 if(latest.find(x=>x.item.id===c.item.id)?.stamp===c.stamp)localStorage.setItem(key(uid,"queue"),JSON.stringify(latest.filter(x=>x.item.id!==c.item.id)));
 }}catch(e){console.warn("Hyväksyntöjen synkronointivirhe:",e.message)}
 finally{busy=false}
}
async function session(){
 const v=++version,{data}=await db.auth.getSession();
 if(v!==version)return;
 const uid=data.session?.user?.id||null;
 if(!uid){owner=null;if(active&&original)show(original);active=false;return}
 if(!active)original=window.agentApprovalBridge?.get()||[];
 active=true;owner=uid;
 const cache=read(key(uid,"cache"),null);
 if(cache!==null)show(merge(cache,pending(uid)));
 else if(pending(uid).length)show(merge([],pending(uid)));
 if(navigator.onLine){
 const result=await db.from("approval_sync").select("id,title,detail,status,created_at").eq("user_id",uid);
 if(v!==version||owner!==uid)return;
 if(!result.error){const remote=result.data.map(x=>({id:x.id,title:x.title,detail:x.detail,status:x.status,created:Date.parse(x.created_at)}));const items=merge(remote,pending(uid));localStorage.setItem(key(uid,"cache"),JSON.stringify(items));show(items);
 // Import an existing local decision only when the server has no matching request.
 const local=(original||[]).filter(x=>x.id==="a1"&&x.status!=="pending");
 for(const item of local){if(!remote.some(x=>x.id===item.id)&&!pending(uid).some(x=>x.item.id===item.id)){
 const change={item,stamp:crypto.randomUUID()};localStorage.setItem(key(uid,"queue"),JSON.stringify([...pending(uid),change]));show(merge(items,[change]));
 }}
 }
 }
 await flush();
}
document.addEventListener("agent:approval-change",e=>{
 if(!owner)return;
 const uid=owner,item=e.detail.item;
 const change={item,stamp:crypto.randomUUID()};
 localStorage.setItem(key(uid,"queue"),JSON.stringify([...pending(uid).filter(x=>x.item.id!==item.id),change]));
 localStorage.setItem(key(uid,"cache"),JSON.stringify(merge(read(key(uid,"cache"),[]),[change])));
 flush();
});
window.addEventListener("online",session);
window.addEventListener("focus",flush);
db.auth.onAuthStateChange(()=>setTimeout(session,0));
await session();
