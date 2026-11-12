import {createClient} from '@libsql/client/web';
import app from '../../server/app.mjs';
import {databaseAdapter} from '../../server/database.mjs';
let client;
export default async function handler(request,context){
 const {TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,AUTH_SECRET,SETUP_TOKEN}=process.env;
 if(!TURSO_DATABASE_URL||!TURSO_AUTH_TOKEN)return Response.json({error:'Správce musí dokončit připojení databáze.'},{status:503,headers:{'Cache-Control':'no-store'}});
 client??=createClient({url:TURSO_DATABASE_URL,authToken:TURSO_AUTH_TOKEN});
 return app.fetch(request,{DB:databaseAdapter(client),AUTH_SECRET,SETUP_TOKEN,APP_ENV:'production',CLIENT_IP:context.ip||'unknown'});
}
export const config={path:'/api/data'};
