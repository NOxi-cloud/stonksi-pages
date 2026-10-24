const db=window.agentSupabaseClient;
const read=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const key=(u,s)=>"oma-preview-stocks-"+s+"-"+u;
let owner=null,version=0,busy=false,active=false,original=null;
window.agentStockSyncState={owner:null,ready:false};
const pending=u=>read(key(u,"queue"),[]);
function merge(rows,changes){const m=new Map(rows.map(x=>[x.id,x]));for(const c of changes){if(c.action==="delete")m.delete(c.id);else m.set(c.id,c.item)}return [...m.values()]}
function show(items){window.agentStockBridge?.set(items);document.dispatchEvent(new Event("agent:stocks-loaded"))}
async function flush(){
 if(!owner||busy||!navigator.onLine)return;
 const uid=owner;busy=true;
 try{while(owner===uid&&navigator.onLine){
 const q=pending(uid);if(!q.length)break;const c=q[0];
 const result=c.action==="delete"?await db.from("stock_sync").delete().eq("id",c.id).eq("user_id",uid):await db.from("stock_sync").upsert({id:c.item.id,user_id:uid,name:c.item.name,ticker:c.item.ticker,exchange:c.item.exchange,quantity:c.item.quantity??null,average_cost:c.item.average_cost??null,price:c.item.price??null,currency:c.item.currency??null,price_time:c.item.price_time??null,quote_source:c.item.quote_source??null,change:c.item.change??null,change_percent:c.item.change_percent??null});
 if(result.error)throw result.error;
 const latest=pending(uid);
 if(latest.find(x=>x.id===c.id)?.stamp===c.stamp)localStorage.setItem(key(uid,"queue"),JSON.stringify(latest.filter(x=>x.id!==c.id)));
 }}catch(e){console.warn("Osakeseurannan synkronointivirhe:",e.message)}
 finally{busy=false}
}
async function session(){
 const v=++version;window.agentStockSyncState={owner:null,ready:false};document.dispatchEvent(new Event("agent:stocks-loaded"));
 const {data}=await db.auth.getSession();
 if(v!==version)return;
 const uid=data.session?.user?.id||null;
 if(!uid){owner=null;if(active&&original)show(original);active=false;return}
 if(!active)original=window.agentStockBridge?.get()||[];
 active=true;owner=uid;
 const cache=read(key(uid,"cache"),null);
 if(cache!==null){window.agentStockSyncState={owner:uid,ready:true};show(merge(cache,pending(uid)))}
 else if(pending(uid).length){window.agentStockSyncState={owner:uid,ready:true};show(merge([],pending(uid)))}
 if(navigator.onLine){
 const result=await db.from("stock_sync").select("id,name,ticker,exchange,quantity,average_cost,price,currency,price_time,quote_source,change,change_percent").eq("user_id",uid);
 if(v!==version||owner!==uid)return;
 if(!result.error){const items=merge(result.data,pending(uid));localStorage.setItem(key(uid,"cache"),JSON.stringify(items));window.agentStockSyncState={owner:uid,ready:true};show(items)}
 }
 await flush();
}
document.addEventListener("agent:stock-change",e=>{
 if(!owner)return;
 const uid=owner,{action,item,id}=e.detail;
 const change={action,item,id:id||item?.id,stamp:crypto.randomUUID()};
 localStorage.setItem(key(uid,"queue"),JSON.stringify([...pending(uid).filter(x=>x.id!==change.id),change]));
 localStorage.setItem(key(uid,"cache"),JSON.stringify(merge(read(key(uid,"cache"),[]),[change])));
 flush();
});
window.addEventListener("online",session);
window.addEventListener("focus",flush);
db.auth.onAuthStateChange(()=>setTimeout(session,0));
await session();
