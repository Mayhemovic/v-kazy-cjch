import {writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
await mkdir('data',{recursive:true});
try{await writeFile('.env','TURSO_DATABASE_URL=file:data/local.sqlite\nTURSO_AUTH_TOKEN=\nAUTH_SECRET='+randomBytes(32).toString('hex')+'\nSETUP_TOKEN='+randomBytes(32).toString('hex')+'\n',{flag:'wx',mode:0o600});console.log('Vytvořen soukromý soubor .env. Existující klíče nikdy nepřepisujte.');}catch(e){if(e.code==='EEXIST')console.log('.env již existuje, ponechán beze změny.');else throw e;}
