const enc=new TextEncoder();
export const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export async function sha(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))),n=>n.toString(16).padStart(2,'0')).join('');}
export async function mac(s,secret){const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(s))),n=>n.toString(16).padStart(2,'0')).join('');}
export function equal(a,b){if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
export async function passwordHash(password,salt=random()){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);const bytes=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);return salt+':'+Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
export async function verifyPassword(password,stored){return equal(await passwordHash(password,stored.split(':')[0]),stored);}
export function cookies(request){return Object.fromEntries((request.headers.get('cookie')||'').split(';').map(x=>x.trim().split('=' )).filter(x=>x.length===2));}
export function cookie(name,value,maxAge,env){return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${env.APP_ENV==='local'?'':'; Secure'}`;}
export async function rate(db,id,max=5,period=900000){const now=Date.now();const row=await db.prepare('INSERT INTO limits(id,count,reset) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=CASE WHEN reset<=? THEN 1 ELSE count+1 END,reset=CASE WHEN reset<=? THEN excluded.reset ELSE reset END RETURNING count,reset').bind(id,now+period,now,now).first();return row.count<=max;}
