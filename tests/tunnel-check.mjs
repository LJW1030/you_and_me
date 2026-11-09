const base='https://updated-collectibles-convicted-evidence.trycloudflare.com';
const page=await fetch(base); console.log('Page',page.status);
let cookie='';
async function req(path,body,form=false){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json',[csrf.header]:csrf.token}:{})},body:body?(form?new URLSearchParams(body):JSON.stringify(body)):undefined});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return r;}
let csrf=await(await req('/api/csrf')).json();
const login='mobilecheck'+Date.now();const password=crypto.randomUUID();
console.log('Register',(await req('/api/register',{login,password,nickname:'연결 확인'})).status);
console.log('Login',(await req('/api/login',{username:login,password},true)).status);
csrf=await(await req('/api/csrf')).json();
const {WebSocket}=await import('undici');
const ws=new WebSocket(base.replace('https:','wss:')+'/ws',{headers:{Cookie:cookie,Origin:base}});
const timer=setTimeout(()=>{console.error('WebSocket timeout');process.exit(1)},15000);
ws.addEventListener('open',()=>ws.send(`CONNECT\naccept-version:1.2\nhost:${new URL(base).host}\n${csrf.header}:${csrf.token}\n\n\0`));
ws.addEventListener('message',async e=>{const data=String(e.data);console.log(data.split('\n')[0]);if(data.startsWith('CONNECTED'))ws.send('SUBSCRIBE\nid:check\ndestination:/user/queue/events\nreceipt:ready\n\n\0');if(data.startsWith('CONNECTED')) { const other='peer'+Date.now(); await req('/api/register',{login:other,password:crypto.randomUUID(),nickname:'연결 상대'}); const users=await(await req('/api/users?login='+other)).json(); await req('/api/friends',{id:users[0].id}); await req('/api/rooms',{members:[users[0].id]}); } if(data.startsWith('MESSAGE')){clearTimeout(timer);ws.close();console.log('PASS public HTTPS session + STOMP subscription');}if(data.startsWith('ERROR')){console.error(data);process.exit(1)}});
