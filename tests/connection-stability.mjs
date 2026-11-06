import {chromium} from '../frontend/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const browser=await chromium.launch();const page=await browser.newPage();
let closes=0,heartbeats=0,connected=0;
page.on('websocket',ws=>{ws.on('close',()=>closes++);ws.on('framereceived',e=>{const s=String(e.payload);if(s.startsWith('CONNECTED'))connected++;if(s.trim()==='')heartbeats++;});});
try{
 await page.goto(base);await page.getByRole('button',{name:'처음이신가요? 회원가입'}).click();
 await page.getByLabel('아이디',{exact:true}).fill('idle'+Date.now());await page.getByLabel('비밀번호',{exact:true}).fill('password123');await page.getByLabel('비밀번호 확인',{exact:true}).fill('password123');await page.getByLabel('닉네임',{exact:true}).fill('연결 유지 검증');await page.getByRole('button',{name:'가입하고 시작'}).click();
 await page.getByText('연결됨',{exact:true}).waitFor();await page.waitForTimeout(45000);
 assert.equal(connected,1);assert.equal(closes,0);assert.ok(heartbeats>=2);console.log('PASS 45s idle: one connection, zero reconnects, heartbeats='+heartbeats);
}finally{await browser.close();}
