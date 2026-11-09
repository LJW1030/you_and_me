import {chromium} from '../frontend/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const browser=await chromium.launch();
async function user(name){
 const ctx=await browser.newContext();const request=ctx.request;
 async function post(path,body,form=false){const csrf=await(await request.get(base+'/api/csrf')).json();return request.post(base+'/api'+path,{headers:{[csrf.header]:csrf.token},...(form?{form:body}:{data:body})});}
 assert.equal((await post('/register',{login:name,nickname:name,password:'password123'})).status(),200);
 assert.equal((await post('/login',{username:name,password:'password123'},true)).status(),204);
 const id=(await(await request.get(base+'/api/me')).json()).id;
 return {ctx,post,id};
}
try{
 const t=Date.now(),a=await user('switcha'+t),b=await user('switchb'+t),c=await user('switchc'+t);
 await a.post('/friends',{id:b.id});await a.post('/friends',{id:c.id});
 const first=(await(await a.post('/rooms',{members:[b.id]})).json()).id;
 const second=(await(await a.post('/rooms',{members:[c.id]})).json()).id;
 const page=await a.ctx.newPage();await page.goto(base+'/rooms/'+first);
 await page.getByPlaceholder('메시지를 입력하세요').waitFor();
 let release, captured;
 const hold=new Promise(r=>release=r), saved=new Promise(r=>captured=r);
 await page.route('**/api/rooms/'+first+'/messages',async route=>{
  if(route.request().method()!=='POST'){await route.continue();return;}
  const response=await route.fetch();captured();await hold;await route.fulfill({response});
 });
 await page.getByPlaceholder('메시지를 입력하세요').fill('이 메시지는 첫 번째 방에만 있어야 함');
 await page.getByRole('button',{name:'전송',exact:true}).click();await saved;
 const membersLoaded=page.waitForResponse(r=>r.url().endsWith('/rooms/'+second+'/members'));
 await page.evaluate(room=>{history.pushState({},'', '/rooms/'+room);window.dispatchEvent(new PopStateEvent('popstate'));},second);
 await page.waitForURL('**/rooms/'+second);release();
 await membersLoaded;
 await page.waitForTimeout(500);
 assert.equal(await page.locator('.bubble').filter({hasText:'이 메시지는 첫 번째 방에만 있어야 함'}).count(),0);
 console.log('PASS late send response does not leak into another conversation');
}finally{await browser.close();}
