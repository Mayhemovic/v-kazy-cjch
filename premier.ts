import {days,hours,credited,kinds} from './time';
export function premierExport(data:any,month:string,company:string,settings:any){
 const errors:string[]=[],lines:string[][]=[];
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))errors.push('Neplatné období.');
 if(!company||company==='Nepřiřazeno')errors.push('Vyberte konkrétní firmu. PREMIER soubor neobsahuje sloupec Firma.');
 if(!settings?.confirmed)errors.push('Uložte a potvrďte mzdové kódy a způsob počítání směn od účetní.');
 const reports=(data.employees||[]).map((e:any)=>({e,rec:data.months?.[e.id+':'+month]})).filter((x:any)=>x.rec?.submitted);
 const selected=reports.map(({e,rec}:any)=>({e,entries:days(month,e.weekly,rec.rows).filter(d=>d.r?.type&&d.r.company===company)})).filter((x:any)=>x.entries.length);
 const seen=new Map<string,string>();
 const date=(day:number)=>String(day).padStart(2,'0')+'.'+month.slice(5)+'.'+month.slice(0,4);
 for(const {e,entries} of selected){
  const number=String(e.employeeNumber||'').trim();
  if(!/^\d+$/.test(number)){errors.push(e.name+': chybí číselné osobní číslo.');continue;}
  const normalized=number.replace(/^0+(?=\d)/,'');if(seen.has(normalized)){errors.push('Duplicitní osobní číslo '+number+': '+seen.get(normalized)+' a '+e.name+'.');continue;}seen.set(normalized,e.name);
  let group:any=null;
  function flush(){if(!group)return;lines.push([month.slice(0,4),month.slice(5),group.center,number,group.code,'',group.shifts.toFixed(1).replace('.',','),group.hours.toFixed(2).replace('.',','),'','','','',date(group.start),date(group.end),'']);group=null;}
  for(const d of entries){const r=d.r,rule=settings?.codes?.[r.type],code=String(rule?.code||'').trim(),center=String(settings?.centers?.[r.workplace]||'').trim();
   if(!/^[A-Za-z0-9_.-]{1,30}$/.test(code)){errors.push(e.name+': chybí nebo je neplatný kód pro '+(kinds[r.type]||r.type)+'.');flush();continue;}
   if(center&&!/^\d+$/.test(center)){errors.push('Středisko '+r.workplace+' musí být číslo.');flush();continue;}
   const h=r.type==='work'?hours(r):credited(r);
   if(!Number.isFinite(h)||h<0||h>24){errors.push(e.name+': neplatné hodiny '+d.day+'. dne.');flush();continue;}
   if(!['one','ratio','zero'].includes(rule?.shifts)){errors.push('Nastavte způsob počítání směn: '+kinds[r.type]+'.');flush();continue;}
   let shifts=rule.shifts==='one'?1:0;
   if(rule.shifts==='ratio'){if(!(Number(d.plan)>0)){errors.push(e.name+': pro podíl směny chybí plán '+d.day+'. dne.');flush();continue;}shifts=h/Number(d.plan);if(shifts>1){errors.push(e.name+': podíl směny je větší než 1 dne '+d.day+'.');flush();continue;}}
   const key=[r.type,code,center,r.workplace].join('|');
   if(group&&group.key===key&&group.end+1===d.day){group.end=d.day;group.hours+=h;group.shifts+=shifts;}
   else{flush();group={key,code,center,start:d.day,end:d.day,hours:h,shifts};}
  }flush();
 }
 if(!selected.length)errors.push('Pro vybranou firmu nejsou žádné odevzdané zápisy.');
 const safe=company.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]/g,'_');
 return {errors:[...new Set(errors)],lines:errors.length?[]:lines,text:errors.length?'':lines.map(r=>r.join(';')).join('\r\n')+'\r\n',filename:month.replace('-','')+'_mzdy_'+safe+'.txt',employees:selected.length};
}
