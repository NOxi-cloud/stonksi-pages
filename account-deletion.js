// Self-service account deletion with server-side admin protection.
const supabase=()=>window.agentSupabaseClient;
const button=document.getElementById("delete-account");
const input=document.getElementById("delete-account-confirm");
const status=document.getElementById("delete-account-status");
const CONFIRM="POISTA TILINI";
let submitting=false;
const show=(message)=>{status.textContent=message};
const valid=()=>input.value.trim().toLocaleUpperCase("fi-FI")===CONFIRM;
function refresh(){
 const signedIn=document.body.classList.contains("auth-user");
 button.disabled=submitting||!signedIn||!valid();
 if(!submitting&&signedIn&&input.value.trim())show(valid()?"Vahvistus hyväksytty. Poisto on peruuttamaton.":"Kirjoita vahvistukseksi POISTA TILINI.");
}
input.addEventListener("input",refresh);
new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:["class"]});
refresh();
button.addEventListener("click",async()=>{
 if(submitting||!valid()||!document.body.classList.contains("auth-user"))return;
 if(!confirm("HUOMIO: Tämä poistaa kirjautuneen tilin ja sen pilvitiedot pysyvästi. Jatketaanko?"))return;
 submitting=true;button.textContent="Poistetaan…";refresh();show("Tarkistetaan kirjautuminen…");
 try{
  const client=supabase();
  if(!client)throw Error("Pilviyhteys ei ole valmis.");
  const {data:{session},error}=await client.auth.getSession();
  if(error||!session?.access_token||!session.user)throw Error("Istunto puuttuu. Kirjaudu uudelleen.");
  const response=await fetch("https://ywrnmfozoyniftkzcopt.supabase.co/functions/v1/delete-account",{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":"sb_publishable_7wcqNJq1vLpbM_RgkoEyQQ_2VLq9cqE","Authorization":"Bearer "+session.access_token},
   body:JSON.stringify({confirmation:CONFIRM}),
   cache:"no-store"
  });
  let result={};try{result=await response.json()}catch{}
  if(!response.ok||result.deleted!==true)throw Error(result.error||"Palvelin ei vahvistanut poistoa ("+response.status+").");
  show("Tili poistettu. Tyhjennetään tämän käyttäjän paikalliset tiedot…");
  const uid=session.user.id;
  // Do not clear data belonging to other accounts using this browser.
  for(const key of Object.keys(localStorage)){
   if((key.startsWith("oma-agentti-")||key.startsWith("oma-preview-"))&&key.endsWith("-"+uid))localStorage.removeItem(key);
  }
  try{await client.auth.signOut({scope:"local"})}catch{}
  // Supabase session storage is removed by signOut; do not remove other accounts' data.
  input.value="";
  show("Tili poistettu. Siirrytään kirjautumiseen.");
  window.location.reload();
 }catch(error){
  show("Poisto ei onnistunut: "+(error?.message||"Tuntematon virhe")+". Tarkista tarvittaessa Supabase Authin käyttäjäluettelo.");
 }finally{submitting=false;button.textContent="Poista tili ja pilvitiedot";refresh()}
});
