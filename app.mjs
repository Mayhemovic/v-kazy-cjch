import {random,sha,mac,equal,passwordHash,verifyPassword,cookies,cookie,rate} from './auth.mjs';
const defaultCompanies=['CJCH','ANEST s.r.o.','Gmed'];
const workplaces=['CJCH','Anest','Gmed','Trnová','Hvězda'];
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
const json=(data,status=200,extra={})=>Response.json(data,{status,headers:{...security,'Cache-Control':'no-store',...extra}});
const fail=(error,status=400)=>json({error},status);
async function get(db,id){const r=await db.prepare('SELECT data FROM records WHERE id=?').bind(id).first();return r?JSON.parse(r.data):null;}
async function put(db,id,data){return db.prepare('INSERT INTO records(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id,JSON.stringify(data)).run();}
async function audit(db,actor,action,target=''){await db.prepare('INSERT INTO audit(at,actor,action,target) VALUES(?,?,?,?)').bind(new Date().toISOString(),actor,action,target).run();}
async function sessionResponse(db,env,body,employee,account,workplace){const token=random();await db.prepare('INSERT INTO sessions(hash,employee,account,workplace,expires) VALUES(?,?,?,?,?)').bind(await sha(token),employee,account,workplace,Date.now()+8*3600000).run();return json(body,200,{'Set-Cookie':cookie('cjc_session',token,28800,env)});}
async function activation(db,eid){const token=random();await db.prepare('INSERT INTO activations(hash,employee,expires) VALUES(?,?,?)').bind(await sha(token),eid,Date.now()+86400000).run();return token;}
async function api(req,env){
 const db=env.DB;if(!db||!env.AUTH_SECRET||env.AUTH_SECRET.length<32)return fail('Aplikace čeká na dokončení nastavení serveru.',503);
 if(req.method!=='POST')return fail('Použijte POST.',405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return fail('Neplatný původ požadavku.',403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return fail('Neplatný formát požadavku.',415);
 const raw=await req.text();if(raw.length>16000)return fail('Příliš velký požadavek.',413);
 let b;try{b=JSON.parse(raw)}catch{return fail('Neplatný požadavek.')};if(!b||typeof b!=='object')return fail('Neplatný požadavek.');
 const ip=env.CLIENT_IP||(env.APP_ENV==='local'?'local':'unknown');
 if(!await rate(db,'api:'+await mac(ip,env.AUTH_SECRET),240,60000))return fail('Příliš mnoho požadavků. Zkuste to za chvíli.',429);
 const cfg=await get(db,'config'),cs=cookies(req),token=cs.cjc_session,deviceToken=cs.cjc_device;
 const device=deviceToken?await db.prepare('SELECT * FROM devices WHERE hash=? AND expires>?').bind(await sha(deviceToken),Date.now()).first():null;
 const session=token?await db.prepare('SELECT * FROM sessions WHERE hash=? AND expires>?').bind(await sha(token),Date.now()).first():null;
 const acc=session?.account?await db.prepare('SELECT * FROM accounts WHERE id=? AND active=1').bind(session.account).first():null;
 const profile=session?.employee?await get(db,'emp:'+session.employee):null;
 const logged=!!(acc||(profile?.active&&device?.employee===session?.employee));
 const admin=acc?.role==='admin',accountant=acc?.role==='accountant';
 const actor=acc?.id||profile?.id||'anonymous';
 if(b.action==='state'&&!logged){const e=device?await get(db,'emp:'+device.employee):null;return json({login:true,setup:!cfg,deviceReady:!!e?.active,deviceName:e?.active?e.name:null,companies:e?.companies||defaultCompanies,company:e?.preferredCompany});}
 if(b.action==='setup'){
  if(cfg)return fail('Správce již existuje.',409);
  if(!await rate(db,'setup:'+await sha(ip)))return fail('Příliš mnoho pokusů.',429);
  if(!env.SETUP_TOKEN||!equal(String(b.setupToken||''),env.SETUP_TOKEN))return fail('Neplatný instalační klíč.',403);
  if(typeof b.name!=='string'||!b.name.trim()||typeof b.login!=='string'||!/^[a-zA-Z0-9@._-]{3,100}$/.test(b.login)||typeof b.password!=='string'||b.password.length<12||b.password.length>128)return fail('Vyplňte jméno, přihlašovací jméno a heslo alespoň 12 znaků.');
  const id=crypto.randomUUID(),pass=await passwordHash(b.password),marker=crypto.randomUUID();
  await db.batch([db.prepare("INSERT OR IGNORE INTO records(id,data) VALUES('config',?)").bind(JSON.stringify({owner:id,name:b.name.trim(),marker})),db.prepare("INSERT INTO accounts(id,login,password,role,name) SELECT ?,?,?,'admin',? WHERE EXISTS(SELECT 1 FROM records WHERE id='config' AND json_extract(data,'$.marker')=?)").bind(id,b.login.toLowerCase(),pass,b.name.trim(),marker)]);
  if((await get(db,'config')).owner!==id)return fail('Správce již byl vytvořen.',409);
  await audit(db,id,'setup');return sessionResponse(db,env,{ok:true},null,id,'CJCH');
 }
 if(b.action==='activate'){
  if(!await rate(db,'activate:'+await sha(ip),10))return fail('Příliš mnoho pokusů.',429);
  if(!/^[a-f0-9]{64}$/.test(b.activation||''))return fail('Neplatný aktivační odkaz.');
  const found=await db.prepare('DELETE FROM activations WHERE hash=? AND expires>? RETURNING employee').bind(await sha(b.activation),Date.now()).first();
  const e=found?await get(db,'emp:'+found.employee):null;if(!e?.active)return fail('Odkaz není platný nebo již byl použit. Vyžádejte si nový u správce.');
  const t=random();await db.prepare('INSERT INTO devices(hash,employee,expires) VALUES(?,?,?)').bind(await sha(t),e.id,Date.now()+90*86400000).run();await audit(db,e.id,'activate-device');
  const response=json({ok:true});response.headers.append('Set-Cookie',cookie('cjc_device',t,90*86400,env));response.headers.append('Set-Cookie',cookie('cjc_session','',0,env));return response;
 }
 if(b.action==='login'){
  if(!workplaces.includes(b.workplace))return fail('Vyberte platné pracoviště.');
  if(!await rate(db,'auth-ip:'+await sha(ip),25))return fail('Příliš mnoho pokusů. Zkuste to za 15 minut.',429);
  if(b.mode==='staff-account'){
   const login=String(b.login||'').toLowerCase();if(!await rate(db,'account:'+await mac(login,env.AUTH_SECRET),5))return fail('Příliš mnoho pokusů. Zkuste to za 15 minut.',429);
   const a=await db.prepare('SELECT * FROM accounts WHERE login=? AND active=1').bind(login).first();
   if(!a||typeof b.password!=='string'||b.password.length>128||!await verifyPassword(b.password,a.password))return fail('Nesprávné přihlašovací údaje.',401);
   await db.prepare('DELETE FROM limits WHERE id=?').bind('account:'+await mac(login,env.AUTH_SECRET)).run();await audit(db,a.id,'login');return sessionResponse(db,env,{ok:true},null,a.id,b.workplace);
  }
  if(!device)return fail('Na tomto zařízení nejprve otevřete aktivační odkaz od správce.',401);
  if(!await rate(db,'pin:'+device.employee,5))return fail('Příliš mnoho pokusů. Zkuste to za 15 minut.',429);
  const e=await get(db,'emp:'+device.employee);
  if(!e?.active||!/^\d{4}$/.test(String(b.pin||''))||!equal(await mac(e.id+':'+b.pin,env.AUTH_SECRET),e.pin))return fail('Nesprávný nebo neaktivní kód.',401);
  if(b.company&&!(e.companies||defaultCompanies).includes(b.company))return fail('Firma není přiřazena zaměstnanci.',403);e.preferredCompany=b.company||e.preferredCompany||(e.companies||defaultCompanies)[0];await put(db,'emp:'+e.id,e);
  await db.prepare('DELETE FROM limits WHERE id=?').bind('pin:'+e.id).run();await audit(db,e.id,'login');return sessionResponse(db,env,{ok:true},e.id,null,b.workplace);
 }
 if(b.action==='logout'){
  if(token)await db.prepare('DELETE FROM sessions WHERE hash=?').bind(await sha(token)).run();return json({ok:true},200,{'Set-Cookie':cookie('cjc_session','',0,env)});
 }
 if(!logged)return fail('Přihlášení vypršelo. Přihlaste se znovu.',401);
 if(b.action==='change-password'){
  if(!acc)return fail('Tato funkce je určena správci a účetní.',403);
  if(!await rate(db,'password:'+acc.id,5))return fail('Příliš mnoho pokusů.',429);
  if(typeof b.password!=='string'||b.password.length<12||b.password.length>128||typeof b.currentPassword!=='string'||!await verifyPassword(b.currentPassword,acc.password))return fail('Zkontrolujte původní heslo; nové musí mít alespoň 12 znaků.');
  await db.prepare('UPDATE accounts SET password=? WHERE id=?').bind(await passwordHash(b.password),acc.id).run();await db.prepare('DELETE FROM sessions WHERE account=?').bind(acc.id).run();await audit(db,actor,'change-password');return json({ok:true},200,{'Set-Cookie':cookie('cjc_session','',0,env)});
 }
 if(b.action==='toggle-account'){
  if(!admin)return fail('Pouze správce.',403);const a=await db.prepare("SELECT * FROM accounts WHERE id=? AND role='accountant'").bind(String(b.account||'')).first();if(!a)return fail('Účet účetní neexistuje.');
  await db.prepare('UPDATE accounts SET active=? WHERE id=?').bind(a.active?0:1,a.id).run();await db.prepare('DELETE FROM sessions WHERE account=?').bind(a.id).run();await audit(db,actor,'toggle-account',a.id);return json({ok:true});
 }
 if(b.action==='premier-settings'){
 if(!admin&&!accountant)return fail('Pouze správce nebo účetní.',403);
 const company=String(b.company||'').trim(),input=b.settings;
 if(!company||company==='Nepřiřazeno'||company.length>100||!input||input.confirmed!==true)return fail('Vyberte firmu a potvrďte nastavení účetní.');
 const clean={codes:{},centers:{},confirmed:true};
 for(const kind of ['work','vacation','ocr','study','sick','ill','unpaid']){const rule=input.codes?.[kind],code=String(rule?.code||'').trim();if(!code)continue;if(!/^[A-Za-z0-9_.-]{1,30}$/.test(code)||!['one','ratio','zero'].includes(rule?.shifts))return fail('Zkontrolujte mzdové kódy a počítání směn.');clean.codes[kind]={code,shifts:rule.shifts};}
 if(!Object.keys(clean.codes).length)return fail('Vyplňte alespoň jeden mzdový kód.');
 for(const w of workplaces){const value=String(input.centers?.[w]||'').trim();if(value&&!/^\d{1,20}$/.test(value))return fail('Středisko musí být číselné.');clean.centers[w]=value;}
 await put(db,'premier:'+company,clean);return json({ok:true});
 }
 if(b.action==='company-profile'){if(!admin)return fail('Pouze správce.',403);const e=await get(db,'emp:'+String(b.employee||''));if(!e)return fail('Zaměstnanec neexistuje.');const companies=Array.isArray(b.companies)?[...new Set(b.companies.map(v=>String(v).trim()).filter(Boolean))]:[];if(!companies.length||companies.length>20||companies.some(v=>v.length>100))return fail('Zadejte 1 až 20 názvů firem.');e.companies=companies;e.preferredCompany=companies.includes(e.preferredCompany)?e.preferredCompany:companies[0];e.employeeNumber=String(b.employeeNumber||'').trim().slice(0,40);await put(db,'emp:'+e.id,e);await audit(db,actor,'company-profile',e.id);return json({ok:true});}
 if(b.action==='employee'){
  if(!admin)return fail('Pouze správce.',403);
  const name=String(b.name||'').trim(),weekly=Number(b.weekly),leave=Number(b.leave);
  if(!name||name.length>100||!Number.isFinite(weekly)||weekly<1||weekly>60||!Number.isFinite(leave)||leave<0||leave>400)return fail('Zkontrolujte jméno a úvazek.');
  if(b.accessRole==='accountant'){
   const id=crypto.randomUUID(),login='ucetni-'+random().slice(0,8),password=random().slice(0,24);
   await db.prepare("INSERT INTO accounts(id,login,password,role,name) VALUES(?,?,?,'accountant',?)").bind(id,login,await passwordHash(password),name).run();await audit(db,actor,'create-accountant',id);return json({ok:true,login,password});
  }
  const id=crypto.randomUUID();const n=crypto.getRandomValues(new Uint32Array(1))[0];const pin=String(n%10000).padStart(4,'0');
  await put(db,'emp:'+id,{id,name,role:String(b.role||'Zaměstnanec').slice(0,100),weekly,leave,accessRole:'employee',pin:await mac(id+':'+pin,env.AUTH_SECRET),active:true});await audit(db,actor,'create-employee',id);
  return json({ok:true,pin,activation:await activation(db,id)});
 }
 if(b.action==='device-link'||b.action==='reset-pin'||b.action==='disable-employee'){
  if(!admin)return fail('Pouze správce.',403);const e=await get(db,'emp:'+String(b.employee||''));if(!e)return fail('Zaměstnanec neexistuje.');
  if(b.action==='device-link'){await audit(db,actor,b.action,e.id);return json({activation:await activation(db,e.id)});}
  if(b.action==='disable-employee'){e.active=!e.active;await put(db,'emp:'+e.id,e);await db.batch([db.prepare('DELETE FROM sessions WHERE employee=?').bind(e.id),db.prepare('DELETE FROM devices WHERE employee=?').bind(e.id),db.prepare('DELETE FROM activations WHERE employee=?').bind(e.id)]);await audit(db,actor,b.action,e.id);return json({ok:true});}
  const pin=String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0');e.pin=await mac(e.id+':'+pin,env.AUTH_SECRET);await put(db,'emp:'+e.id,e);await db.prepare('DELETE FROM sessions WHERE employee=?').bind(e.id).run();await audit(db,actor,b.action,e.id);return json({pin});
 }
 if(b.action==='state'||b.action==='backup'){
  if(b.action==='backup'&&!admin)return fail('Pouze správce.',403);
  const employees=(await db.prepare("SELECT data FROM records WHERE id LIKE 'emp:%'").all()).results.map(x=>JSON.parse(x.data)).filter(e=>admin||accountant||e.id===profile?.id).map(({pin,...e})=>e);
  const months=(await db.prepare("SELECT id,data FROM records WHERE id LIKE 'month:%'").all()).results.filter(x=>admin||(accountant?JSON.parse(x.data).submitted:x.id.split(':')[1]===profile?.id)).map(x=>[x.id.slice(6),JSON.parse(x.data)]);
  if(b.action==='backup')return json({format:'cjc-vykazy-backup-v1',exportedAt:new Date().toISOString(),employees,months:Object.fromEntries(months)});
  const accounts=admin?(await db.prepare('SELECT id,login,role,name,active FROM accounts').all()).results:[];
  return json({premierSettings:(admin||accountant)?Object.fromEntries((await db.prepare("SELECT id,data FROM records WHERE id LIKE 'premier:%'").all()).results.map(x=>[x.id.slice(8),JSON.parse(x.data)])):{},companies:[...new Set([...defaultCompanies,...employees.flatMap(e=>e.companies||[])])],company:profile?.preferredCompany,admin,accountant,adminName:acc?.name,profileName:profile?.name||acc?.name,workplace:session.workplace,employees,accounts,months:Object.fromEntries(months)});
 }
 const eid=String(b.employee||'');if(!admin&&(accountant||profile?.id!==eid))return fail('Nemáte oprávnění upravovat tento výkaz.',403);
 if(!await get(db,'emp:'+eid)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month||''))return fail('Neplatný zaměstnanec nebo měsíc.');
 const key='month:'+eid+':'+b.month,month=await get(db,key)||{rows:{},locked:false};
 if(b.action==='submit'){
  if(month.locked)return fail('Výkaz je uzavřený.',409);if(!Object.values(month.rows).some(r=>r.type))return fail('Nejprve vyplňte alespoň jeden den.');
  await db.prepare("UPDATE records SET data=json_set(data,'$.locked',json('true'),'$.submitted',?) WHERE id=?").bind(new Date().toISOString(),key).run();await audit(db,actor,'submit',key);return json({ok:true});
 }
 if(b.action==='lock'){
  if(!admin)return fail('Pouze správce.',403);await db.prepare('INSERT OR IGNORE INTO records(id,data) VALUES(?,?)').bind(key,JSON.stringify(month)).run();await db.prepare("UPDATE records SET data=json_set(data,'$.locked',json(CASE WHEN json_extract(data,'$.locked')=1 THEN 'false' ELSE 'true' END),'$.submitted',NULL) WHERE id=?").bind(key).run();await audit(db,actor,'toggle-lock',key);return json({ok:true});
 }
 if(b.action==='row'||b.action==='rows'){
 if(accountant&&!admin)return fail('Účetní má pouze přístup ke čtení.',403);
 if(month.locked)return fail('Výkaz je uzavřený.',409);
 const employee=await get(db,'emp:'+eid),r=b.row,selected=b.action==='rows'?b.days:[b.day];
 const max=new Date(Number(b.month.slice(0,4)),Number(b.month.slice(5)),0).getDate();
 if(!Array.isArray(selected)||!selected.length||selected.length>31||selected.some((d)=>!Number.isInteger(d)||d<1||d>max)||new Set(selected).size!==selected.length)return fail('Vyberte platné dny.');
 if(!r||!['work','vacation','ocr','study','sick','ill','unpaid',''].includes(r.type)||!workplaces.includes(r.workplace))return fail('Zkontrolujte typ dne a pracoviště.');
 const company=r.company||employee.preferredCompany||(employee.companies||defaultCompanies)[0];
 if(!(employee.companies||defaultCompanies).includes(company))return fail('Firma není přiřazena zaměstnanci.',403);
 for(const [f,limit] of [['plan',24],['credit',24],['break',720]])if(typeof r[f]!=='number'||!Number.isFinite(r[f])||r[f]<0||r[f]>limit)return fail('Zkontrolujte hodiny a přestávku.');
 if(typeof r.note!=='string'||r.note.length>250)return fail('Neplatná poznámka.');
 if(r.type==='work'){const re=/^([01]\d|2[0-3]):[0-5]\d$/;if(!re.test(r.start)||!re.test(r.end)||r.start===r.end)return fail('Vyplňte začátek a konec směny.');const t=(v)=>Number(v.slice(0,2))*60+Number(v.slice(3));if(r.break>(t(r.end)-t(r.start)+1440)%1440)return fail('Přestávka je delší než směna.');}
 const clean={company,type:r.type,workplace:r.workplace,start:r.type==='work'?r.start:'',end:r.type==='work'?r.end:'',break:r.break,plan:r.plan,credit:r.credit,note:r.note};
 await db.prepare('INSERT OR IGNORE INTO records(id,data) VALUES(?,?)').bind(key,JSON.stringify({rows:{},locked:false})).run();
 const pairs=selected.map(()=>"?,json(?)").join(','),args=selected.flatMap((d)=>['$.rows.'+d,JSON.stringify(clean)]);
 const guard=b.action==='rows'&&b.overwrite!==true?selected.map(()=>" AND coalesce(json_extract(data,?), '')=''").join(''):'';
 const guardArgs=b.action==='rows'&&b.overwrite!==true?selected.map((d)=>'$.rows.'+d+'.type'):[];
 const result=await db.prepare("UPDATE records SET data=json_set(data,"+pairs+",'$.updated',?) WHERE id=? AND json_extract(data,'$.locked')=0"+guard).bind(...args,new Date().toISOString(),key,...guardArgs).run();
 if(!result.meta.changes)return fail('Výkaz je uzavřený nebo některý vybraný den již obsahuje zápis. Obnovte přehled.',409);
 await audit(db,actor,b.action==='rows'?'save-days':'save-day',key+':'+selected.join(','));
 return json({ok:true});
 }
 return fail('Neznámá akce.');
}
export default {async fetch(req,env){try{const url=new URL(req.url);if(url.pathname==='/api/data')return await api(req,env);return fail('Nenalezeno.',404);}catch(error){console.error('Request failed:',error?.name);return fail('Operaci se nepodařilo dokončit. Zkuste to znovu.',500);}}};
