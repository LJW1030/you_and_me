import { chromium } from '../frontend/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const browser=await chromium.launch();
const a=await browser.newContext({viewport:{width:1280,height:900}});
const b=await browser.newContext({viewport:{width:360,height:800}});
const pa=await a.newPage(),pb=await b.newPage();
const stamp=Date.now(),users=['desk'+stamp,'mobile'+stamp];
async function signup(page,login){
 await page.goto('http://localhost:3000');
 await page.getByRole('button',{name:'처음이신가요? 회원가입'}).click();
 await page.getByLabel('아이디',{exact:true}).fill(login);
 await page.getByLabel('비밀번호',{exact:true}).fill('password123');
 await page.getByLabel('비밀번호 확인',{exact:true}).fill('password123');
 await page.getByLabel('닉네임',{exact:true}).fill(login);
 await page.getByRole('button',{name:'가입하고 시작'}).click();
 await page.getByRole('button',{name:'친구',exact:true}).waitFor();
}
async function post(page,path,body){return page.evaluate(async({path,body})=>{const t=await fetch('/api/csrf').then(r=>r.json());const r=await fetch('/api'+path,{method:'POST',headers:{'Content-Type':'application/json',[t.header]:t.token},body:JSON.stringify(body)});return {status:r.status,body:await r.text()};},{path,body});}
try{
 await signup(pa,users[0]);await signup(pb,users[1]);
 await pa.getByRole('button',{name:'친구',exact:true}).click();
 await pa.getByPlaceholder('정확한 아이디 검색').fill(users[1]);
 await pa.getByRole('button',{name:'검색',exact:true}).click();
 await pa.getByRole('button',{name:'추가',exact:true}).click();
 await pa.getByRole('button',{name:'대화',exact:true}).click();
 await pa.getByPlaceholder('메시지를 입력하세요').waitFor();
 await pb.goto(pa.url());await pb.getByPlaceholder('메시지를 입력하세요').waitFor();
 await pa.getByPlaceholder('메시지를 입력하세요').fill('한글 실시간 회귀 테스트');
 await pa.getByRole('button',{name:'전송',exact:true}).click();
 await pb.locator('.bubble').filter({hasText:'한글 실시간 회귀 테스트'}).waitFor();
 assert.equal(await pb.locator('.bubble').filter({hasText:'한글 실시간 회귀 테스트'}).count(),1);
 assert.ok(await pb.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await pb.reload();await pb.locator('.bubble').filter({hasText:'한글 실시간 회귀 테스트'}).waitFor();
 console.log('PASS desktop/mobile independent contexts: signup, friend, message, no duplicate, reload, width');
 if(process.env.TEST_RESTART==='1'){
  execFileSync('docker',['compose','-f','compose.yaml','-f','compose.tunnel.yaml','restart','backend'],{stdio:'inherit'});
  let healthy=false;for(let i=0;i<60;i++){try{if((await fetch('http://localhost:3000/api/csrf')).ok){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.ok(healthy);
  await pb.reload();await pb.getByPlaceholder('메시지를 입력하세요').waitFor();
  assert.equal((await pb.request.get('http://localhost:3000/api/me')).status(),200);
  console.log('PASS persisted login after backend restart');
 }
 const roomPath=new URL(pa.url()).pathname;
 await b.setOffline(true);
 for(let i=0;i<35;i++)assert.equal((await post(pa,roomPath+'/messages',{clientMessageId:crypto.randomUUID(),body:'복구 검증 '+i})).status,200);
 await b.setOffline(false);
 await pb.locator('.bubble').filter({hasText:'복구 검증 34'}).waitFor();
 assert.equal(await pb.locator('.bubble').filter({hasText:'복구 검증 '}).count(),35);
 let lost=false;
 await pa.route('**/api/rooms/*/messages',async route=>{if(route.request().method()==='POST'&&!lost){lost=true;await route.fetch();await route.abort();}else await route.continue();});
 await pa.getByPlaceholder('메시지를 입력하세요').fill('응답 유실 재시도');
 await pa.getByRole('button',{name:'전송',exact:true}).click();
 const retry=pa.getByRole('button',{name:'실패 · 재시도'});
 // The committed event can reconcile the pending message before retry is clicked.
 await pa.locator('.bubble').filter({hasText:'응답 유실 재시도'}).waitFor();
 if(await retry.count())await retry.click();
 await pb.locator('.bubble').filter({hasText:'응답 유실 재시도'}).waitFor();
 assert.equal(await pb.locator('.bubble').filter({hasText:'응답 유실 재시도'}).count(),1);
 console.log('PASS offline recovery of 35 messages and lost-response deduplication');
 let closed=false,opened=false;
 pb.on('websocket',socket=>{socket.on('framereceived',e=>{if(String(e.payload).startsWith('CONNECTED'))opened=true;});socket.on('close',()=>{closed=true;});});
 await pb.reload();for(let i=0;i<40&&!opened;i++)await pb.waitForTimeout(250);assert.ok(opened);
 const result=await post(pb,'/me/password',{currentPassword:'password123',password:'newPassword123'});
 assert.equal(result.status,200);for(let i=0;i<20&&!closed;i++)await pb.waitForTimeout(100);assert.ok(closed,'Existing WebSocket must close');
 assert.equal((await pb.request.get('http://localhost:3000/api/me')).status(),401);
 console.log('PASS password change closes live WebSocket and invalidates HTTP session');
}finally{await browser.close();}
