import {createClient} from '@libsql/client';
import {migrate} from './migration-lib.mjs';
if(!process.env.TURSO_DATABASE_URL)throw new Error('Chybí TURSO_DATABASE_URL v .env');
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
try{await migrate(client);console.log('Databáze je připravena.');}finally{client.close();}
