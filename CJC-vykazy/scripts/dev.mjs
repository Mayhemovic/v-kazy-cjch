import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {Readable} from 'node:stream';
import {createClient} from '@libsql/client';
import {databaseAdapter} from '../server/database.mjs';
import app from '../server/app.mjs';
const client=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN}),root=resolve('dist');
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:3000');
 if(url.pathname==='/api/data'){
  const request=new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Readable.toWeb(req),duplex:'half'}:{})});
  const response=await app.fetch(request,{...process.env,DB:databaseAdapter(client),APP_ENV:'local',CLIENT_IP:req.socket.remoteAddress});
  res.writeHead(response.status,{...Object.fromEntries(response.headers),'set-cookie':response.headers.getSetCookie()});res.end(Buffer.from(await response.arrayBuffer()));return;
 }
 let path=resolve(root,'.'+decodeURIComponent(url.pathname));if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403);res.end();return;}
 let bytes;try{bytes=await readFile(path)}catch{path=resolve(root,'index.html');bytes=await readFile(path)}
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png'})[extname(path)]||'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(500);res.end('Chyba místního serveru.');}}).listen(3000,'127.0.0.1',()=>console.log('Místní test: http://localhost:3000'));
