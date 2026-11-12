// SQL compatibility layer shared by hosted API and migration tests.
export function databaseAdapter(client){
 const prepare=(sql,args=[])=>({sql,args,bind(...values){return prepare(sql,values)},async first(){return (await client.execute({sql,args})).rows[0]||null},async all(){return {results:(await client.execute({sql,args})).rows}},async run(){const r=await client.execute({sql,args});return {meta:{changes:r.rowsAffected}}}});
 return {prepare,async batch(statements){const results=await client.batch(statements.map(s=>({sql:s.sql,args:s.args})), 'write');return results.map(r=>({meta:{changes:r.rowsAffected}}));}};
}
