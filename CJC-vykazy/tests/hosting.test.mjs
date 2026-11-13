import test from 'node:test';import assert from 'node:assert/strict';import {createClient} from '@libsql/client';import {databaseAdapter} from '../server/database.mjs';import {migrate} from '../scripts/migration-lib.mjs';import app from '../server/app.mjs';import handler,{config} from '../netlify/functions/api.mjs';
test('Netlify routes API and refuses an unconfigured database',async()=>{
 const keys=['TURSO_DATABASE_URL','TURSO_AUTH_TOKEN'];
 const saved=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 try{
  for(const key of keys)delete process.env[key];
  assert.equal(config.path,'/api/data');
  const r=await handler(new Request('https://test.netlify.app/api/data'),{ip:'127.0.0.1'});
  assert.equal(r.status,503);
 }finally{
  for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}
 }
});
test('Turso libSQL migration, setup, atomic rollback, PIN login, bulk rows, submission and PREMIER settings',async()=>{
 const client=createClient({url:':memory:'});try{
 await migrate(client);await migrate(client);const DB=databaseAdapter(client),env={DB,APP_ENV:'production',CLIENT_IP:'127.0.0.1',AUTH_SECRET:'test-secret-only-12345678901234567890',SETUP_TOKEN:'installer-test'};
 const user=()=>{const jar={};return async(body,status=200)=>{const r=await app.fetch(new Request('https://test.netlify.app/api/data',{method:'POST',headers:{origin:'https://test.netlify.app','Content-Type':'application/json',cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join(';')},body:JSON.stringify(body)}),env);const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));for(const c of r.headers.getSetCookie()){const [k,v]=c.split(';')[0].split('=');jar[k]=v;}return j;}};
 const owner=user();await owner({action:'setup',setupToken:'installer-test',name:'Správce',login:'owner',password:'Long-test-password-123'});
 await assert.rejects(DB.batch([DB.prepare('INSERT INTO records VALUES(?,?)').bind('rollback','{}'),DB.prepare('INSERT INTO records VALUES(?,?)').bind('config','{}')]));assert.equal(await DB.prepare('SELECT * FROM records WHERE id=?').bind('rollback').first(),null);
 const c=await owner({action:'employee',name:'Jana',weekly:40,leave:200});const eid=(await owner({action:'state'})).employees[0].id;const staff=user();await staff({action:'activate',activation:c.activation});await staff({action:'login',pin:c.pin,company:'ANEST s.r.o.',workplace:'Hvězda'});
 const b={action:'rows',employee:eid,month:'2026-11',days:[7,8],row:{type:'work',company:'ANEST s.r.o.',workplace:'Hvězda',start:'07:00',end:'15:30',break:30,plan:8,credit:0,note:''}};
 await staff(b);await staff({...b,days:[8,9]},409);let state=await staff({action:'state'});assert.equal(state.months[eid+':2026-11'].rows[9],undefined);await staff({action:'submit',employee:eid,month:'2026-11'});await staff({...b,days:[10]},409);
 await owner({action:'premier-settings',company:'ANEST s.r.o.',settings:{confirmed:true,codes:{work:{code:'TEST',shifts:'one'}},centers:{Hvězda:'11'}}});state=await owner({action:'state'});assert.equal(state.premierSettings['ANEST s.r.o.'].centers.Hvězda,'11');
 }finally{client.close();}
});
