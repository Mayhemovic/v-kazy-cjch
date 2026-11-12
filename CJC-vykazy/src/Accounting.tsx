import Premier from './Premier';
import {useState} from 'react';
import {Download,CalendarDays,FileCheck2} from 'lucide-react';
import {submittedReports,reportFiles,zipFiles,combinedRows,csvText} from './exports';
import {fmt} from './time';
export default function Accounting({data,month,setMonth,refresh}:any){
 const [company,setCompany]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const reports=submittedReports(data,month,company), employees=data.employees.filter((e:any)=>e.accessRole!=='accountant'||reports.some((r:any)=>r.employee.id===e.id));
 function downloadCSV(){const rows=combinedRows(data,month,company);if(rows.length<2)return;const url=URL.createObjectURL(new Blob([csvText(rows)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Dochazka_'+month+'_'+(company||'vsechny_firmy').replace(/[^\p{L}\p{N}]/gu,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('Společný CSV soubor byl připraven ke stažení.');}
 async function downloadAll(){setBusy(true);setMessage('');try{
 const files=reportFiles(data,month,company);if(!files.length){setMessage('Za tento měsíc ještě nikdo výkaz neodevzdal.');return;}
 const bytes=zipFiles(files),url=URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer],{type:'application/zip'}));
 const a=document.createElement('a');a.href=url;a.download=`Vykazy_${month}.zip`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 setMessage(`Balíček ke stažení obsahuje ${reports.length} výkazů a souhrn pro účetní.`);
 }catch{setMessage('Balíček se nepodařilo připravit. Zkuste stažení znovu.');}finally{setBusy(false);}}
 return <section className="panel accounting"><div className="accountinghead"><div><span className="eyebrow">PODKLADY PRO ÚČETNÍ</span><h2>Docházka celého týmu v jednom CSV</h2><p>Jeden řádek za den a zaměstnance. Vyberte všechny firmy nebo konkrétní firmu. ZIP s jednotlivými výkazy zůstává dostupný.</p></div><label className="accountingmonth"><CalendarDays size={20}/>Měsíc výkazů<input aria-label="Měsíc pro hromadné stažení" type="month" value={month} onChange={e=>{if(e.target.value){setMonth(e.target.value);setMessage('')}}}/></label></div>
 <div className="accountingfilters" style={{padding:'0 28px 20px'}}><label>Firma <select aria-label="Firma pro export" value={company} onChange={e=>{setCompany(e.target.value);setMessage('')}}><option value="">Všechny firmy</option>{Array.from(new Set([...(data.companies||[]),...Object.values(data.months||{}).flatMap((m:any)=>Object.values(m.rows||{}).map((r:any)=>r.company||'Nepřiřazeno'))])).map((c:any)=><option key={c}>{c}</option>)}</select></label></div><div className="accountingdownload"><div><b>{reports.length} z {employees.length} výkazů odevzdáno</b><p>Stahují se pouze odevzdané výkazy za vybraný měsíc, včetně víkendových směn a absencí. Při filtrování firmy se počítají pouze dny přiřazené této firmě.</p></div><div className="exportbuttons"><button className="primary" disabled={busy||!reports.length} onClick={downloadCSV}><Download size={18}/>Stáhnout společný CSV</button><button className="secondary" disabled={busy||!reports.length} onClick={downloadAll}><Download size={18}/>{busy?'Připravuji…':'Jednotlivé výkazy v ZIP'}</button></div></div>
 <p style={{padding:'0 28px'}}>Starší záznamy bez firmy jsou označeny „Nepřiřazeno“. Pro import do PREMIERu použijte samostatný TXT export níže.</p>{message&&<p role="status" className="entryhint">{message}</p>}
 <div className="tablescroll"><table><thead><tr><th>ZAMĚSTNANEC</th><th>STAV</th><th>PRÁCE</th><th>ABSENCE</th><th>SALDO</th></tr></thead><tbody>{employees.map((e:any)=>{const r=reports.find((r:any)=>r.employee.id===e.id);return <tr key={e.id}><td><b>{e.name}</b></td><td><span className={'badge '+(r?'green':'')}>{r?'Odevzdáno':data.months[e.id+':'+month]?.submitted?'Bez zápisů pro firmu':'Čeká na odevzdání'}</span></td><td>{r?fmt(r.work)+' h':'—'}</td><td>{r?fmt(r.absence)+' h':'—'}</td><td>{r?fmt(r.balance)+' h':'—'}</td></tr>})}</tbody></table></div>
 {!employees.length&&<div className="empty"><FileCheck2/><p>Zatím nejsou přidáni zaměstnanci.</p></div>}
 <Premier data={data} month={month} company={company} refresh={refresh}/>
 </section>;
}
