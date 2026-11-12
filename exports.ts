import {days,hours,credited,kinds} from './time';
export function submittedReports(data:any,month:string,company=''){
 return data.employees.filter((e:any)=>data.months[e.id+':'+month]?.submitted).map((employee:any)=>{
 const record=data.months[employee.id+':'+month], entries=days(month,employee.weekly,record.rows).filter(d=>!company||(d.r?.company||'Nepřiřazeno')===company);
 const work=entries.reduce((s,d)=>s+hours(d.r),0), absence=entries.reduce((s,d)=>s+credited(d.r),0), plan=entries.reduce((s,d)=>s+Number(d.plan),0);
 return {employee,record,entries,work,absence,plan,balance:work+absence-plan};
 }).filter((r:any)=>!company||r.entries.length);
}
export function csvText(rows:any[][]){return '\ufeff'+rows.map(row=>row.map(value=>{
 let text=typeof value==='number'?value.toLocaleString('cs-CZ',{maximumFractionDigits:2,useGrouping:false}):String(value??'');
 if(typeof value!=='number'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}).join(';')).join('\r\n');}
export function reportFiles(data:any,month:string,company=''){
 const reports=submittedReports(data,month,company);if(!reports.length)return [];
 const summary:any[][]=[['Osobní číslo','Zaměstnanec','Firma','Pracoviště','Měsíc','Úvazek h/týden','Fond h','Práce h','Absence h','Dovolená h','OČR h','Studijní volno h','Sick day h','Nemoc h','Neplacené volno h','Saldo h','Odevzdáno']];
 const files=reports.map((r:any,index:number)=>{
 const {employee:e,entries:ds}=r;
 summary.push([e.employeeNumber||e.id,e.name,[...new Set(ds.map((d:any)=>d.r?.company||'Nepřiřazeno'))].join(', '),[...new Set(ds.filter((d:any)=>d.r?.type).map((d:any)=>d.r.workplace||'Neuvedeno'))].join(', '),month,e.weekly,r.plan,r.work,r.absence,...['vacation','ocr','study','sick','ill','unpaid'].map(k=>ds.reduce((s:number,d:any)=>s+(d.r?.type===k?credited(d.r):0),0)),r.balance,new Date(r.record.submitted).toLocaleString('cs-CZ',{timeZone:'Europe/Prague'})]);
 const rows:any[][]=[['Osobní číslo','Zaměstnanec','Firma','Pracoviště','Datum','Typ','Příchod','Odchod','Přestávka min','Plán h','Práce h','Absence h','Poznámka'],...ds.map((d:any)=>[e.employeeNumber||e.id,e.name,d.r?.company||'Nepřiřazeno',d.r?.workplace||'',month+'-'+String(d.day).padStart(2,'0'),kinds[d.r?.type]||'',d.r?.type==='work'?d.r.start:'',d.r?.type==='work'?d.r.end:'',d.r?.type==='work'?d.r.break:'',Number(d.plan),hours(d.r),credited(d.r),d.r?.note||''])];
 rows.push(['Celkem','','','','','','','','',r.plan,r.work,r.absence,'Saldo: '+r.balance.toLocaleString('cs-CZ')+' h']);
 const name=e.name.normalize('NFC').replace(/[^\p{L}\p{N}_-]/gu,'_').slice(0,80)||'Zamestnanec';
 return {name:`${String(index+1).padStart(3,'0')}_${name}_${month}.csv`,text:csvText(rows)};
 });return [{name:`Souhrn_${month}.csv`,text:csvText(summary)},...files];
}
// ZIP store format: UTF-8 names, CRC32, no external runtime dependency.
export function zipFiles(files:{name:string,text:string}[]){
 const encoder=new TextEncoder(), chunks:Uint8Array[]=[], directory:Uint8Array[]=[];let offset=0;
 function header(size:number){const bytes=new Uint8Array(size);return {bytes,view:new DataView(bytes.buffer)};}
 for(const file of files){const name=encoder.encode(file.name),body=encoder.encode(file.text);let crc=0xffffffff;
 for(const b of body){crc^=b;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const local=header(30);local.view.setUint32(0,0x04034b50,true);local.view.setUint16(4,20,true);local.view.setUint16(6,0x800,true);local.view.setUint16(12,33,true);local.view.setUint32(14,crc,true);local.view.setUint32(18,body.length,true);local.view.setUint32(22,body.length,true);local.view.setUint16(26,name.length,true);
 const central=header(46);central.view.setUint32(0,0x02014b50,true);central.view.setUint16(4,20,true);central.view.setUint16(6,20,true);central.view.setUint16(8,0x800,true);central.view.setUint16(14,33,true);central.view.setUint32(16,crc,true);central.view.setUint32(20,body.length,true);central.view.setUint32(24,body.length,true);central.view.setUint16(28,name.length,true);central.view.setUint32(42,offset,true);
 chunks.push(local.bytes,name,body);directory.push(central.bytes,name);offset+=30+name.length+body.length;
 }
 const dirSize=directory.reduce((n,b)=>n+b.length,0),end=header(22);end.view.setUint32(0,0x06054b50,true);end.view.setUint16(8,files.length,true);end.view.setUint16(10,files.length,true);end.view.setUint32(12,dirSize,true);end.view.setUint32(16,offset,true);
 const result=new Uint8Array(offset+dirSize+22);let cursor=0;for(const b of [...chunks,...directory,end.bytes]){result.set(b,cursor);cursor+=b.length;}return result;
}

export function combinedRows(data:any,month:string,company=''){
 const rows:any[][]=[['Osobní číslo','Zaměstnanec','Firma','Pracoviště','Datum','Typ','Příchod','Odchod','Přestávka min','Plán h','Práce h','Absence h','Poznámka']];
 for(const r of submittedReports(data,month,company))for(const d of r.entries)rows.push([r.employee.employeeNumber||r.employee.id,r.employee.name,d.r?.company||'Nepřiřazeno',d.r?.workplace||'',month+'-'+String(d.day).padStart(2,'0'),kinds[d.r?.type]||'',d.r?.type==='work'?d.r.start:'',d.r?.type==='work'?d.r.end:'',d.r?.type==='work'?d.r.break:'',Number(d.plan),hours(d.r),credited(d.r),d.r?.note||'']);
 return rows;
}
