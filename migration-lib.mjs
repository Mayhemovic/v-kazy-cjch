import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export async function migrate(client){
 await client.execute('CREATE TABLE IF NOT EXISTS schema_migrations(name TEXT PRIMARY KEY, hash TEXT NOT NULL)');
 const dir=new URL('../migrations/',import.meta.url);
 for(const name of (await readdir(dir)).filter(x=>x.endsWith('.sql')).sort()){
  const sql=await readFile(new URL(name,dir),'utf8'),hash=createHash('sha256').update(sql).digest('hex');
  const existing=await client.execute({sql:'SELECT hash FROM schema_migrations WHERE name=?',args:[name]});
  if(existing.rows.length){if(existing.rows[0].hash!==hash)throw new Error('Již použitá migrace byla změněna: '+name);continue;}
  const tx=await client.transaction('write');try{
   await tx.executeMultiple(sql);await tx.execute({sql:'INSERT INTO schema_migrations(name,hash) VALUES(?,?)',args:[name,hash]});await tx.commit();
  }catch(e){await tx.rollback();throw e;}finally{tx.close();}
 }
}
