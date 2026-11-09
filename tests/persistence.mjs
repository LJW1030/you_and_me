import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL ?? 'http://localhost:3000';
async function account(name) {
 let cookie='',csrf;
 async function call(path,body,form=false) {
  const r=await fetch(base+'/api'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,...(body===undefined?{}:{[csrf.header]:csrf.token,'Content-Type':form?'application/x-www-form-urlencoded':'application/json'})},body:body===undefined?undefined:form?new URLSearchParams(body):JSON.stringify(body)});
  if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  return r;
 }
 csrf=await(await call('/csrf')).json();
 assert.equal((await call('/register',{login:name,password:'password123',nickname:name})).status,200);
 assert.equal((await call('/login',{username:name,password:'password123'},true)).status,204);
 csrf=await(await call('/csrf')).json();
 const id=(await(await call('/me')).json()).id;
 return {call,id};
}
export async function capture() {
 const time=Date.now(),a=await account('restarta'+time),b=await account('restartb'+time);
 await a.call('/friends',{id:b.id});
 const room=(await(await a.call('/rooms',{members:[b.id]})).json()).id;
 const msg=await(await a.call(`/rooms/${room}/messages`,{clientMessageId:crypto.randomUUID(),body:'서버 재시작 유지 검사'})).json();
 return async()=>{
  assert.equal((await(await a.call('/me')).json()).id,a.id);
  const rows=await(await b.call(`/rooms/${room}/messages`)).json();
  assert.equal(rows.find(m=>m.client_id===msg.client_id)?.body,msg.body);
  console.log('PASS server restart: both session cookie and saved message survive');
 };
}
