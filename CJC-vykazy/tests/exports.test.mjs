import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
const load=(path)=>ts.transpile(readFileSync(new URL(path,import.meta.url),'utf8'),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
const timeUrl='data:text/javascript;base64,'+Buffer.from(load('../src/time.ts')).toString('base64');
const source=load('../src/exports.ts').replace("'./time'",JSON.stringify(timeUrl));
const {reportFiles,submittedReports,zipFiles,csvText,combinedRows}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const row={type:'work',workplace:'CJCH',start:'22:00',end:'06:30',break:30,plan:8,note:'=SUM(1,2)'};
const data={employees:[{id:'1',name:'Žďárský / Jan',weekly:40},{id:'2',name:'Žďárský / Jan',weekly:20},{id:'3',name:'Neodevzdaný',weekly:40}],months:{'1:2026-11':{submitted:'2026-11-30T10:00:00Z',rows:{7:row,8:{type:'vacation',credit:8,plan:8,workplace:'Anest'}}},'2:2026-11':{submitted:'2026-11-30T10:00:00Z',rows:{1:{...row,workplace:'Gmed'}}},'3:2026-11':{rows:{1:row}}}};
test('Export obsahuje všechny odevzdané výkazy, víkendy, absence a souhrn',()=>{
 const r=submittedReports(data,'2026-11');assert.equal(r.length,2);assert.equal(r[0].work,8);assert.equal(r[0].absence,8);
 const files=reportFiles(data,'2026-11');assert.equal(files.length,3);assert.equal(new Set(files.map(f=>f.name)).size,3);assert.ok(files.every(f=>!f.name.includes('/')));
 assert.ok(files[1].text.includes('2026-11-07'));assert.ok(files[1].text.includes('Dovolená'));assert.ok(files[1].text.includes("'=SUM"));assert.ok(files[0].text.includes('Gmed'));assert.ok(!files[0].text.includes('Neodevzdaný'));
 assert.deepEqual(reportFiles(data,'2026-10'),[]);
 const zip=zipFiles(files);assert.equal(new DataView(zip.buffer).getUint32(0,true),0x04034b50);assert.equal(new DataView(zip.buffer).getUint16(zip.length-12,true),3);
 if(process.env.EXPORT_TEST_ZIP)writeFileSync(process.env.EXPORT_TEST_ZIP,zip);
});
test('CSV chrání textové vzorce, zachovává záporná čísla a uvozovky',()=>{const s=csvText([['  =1+1',-8,'řádek\n"text"']]);assert.ok(s.startsWith('\ufeff'));assert.ok(s.includes("'  =1+1"));assert.ok(s.includes('"-8"'));assert.ok(s.includes('""text""'));});

test('Společný CSV odděluje firmy, zachovává čísla a neexportuje rozpracované měsíce',()=>{
 const d=structuredClone(data);d.employees[0].employeeNumber='0017';d.months['1:2026-11'].rows[7].company='ANEST s.r.o.';d.months['1:2026-11'].rows[8].company='Gmed';
 const all=combinedRows(d,'2026-11');assert.equal(all.length,61);const anest=combinedRows(d,'2026-11','ANEST s.r.o.');assert.equal(anest.length,2);assert.equal(anest[1][0],'0017');assert.equal(anest[1][2],'ANEST s.r.o.');assert.equal(anest[1][4],'2026-11-07');assert.equal(anest[1][10],8);assert.equal(combinedRows(d,'2026-11','Neexistuje').length,1);assert.equal(submittedReports(d,'2026-11','Gmed')[0].absence,8);
});
