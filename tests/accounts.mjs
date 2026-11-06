import assert from 'node:assert/strict';
const base='http://localhost:3000/api';
function client(){let cookie='',csrf;return {async call(path,body,form=false){if(body&&!csrf)csrf=await(await this.call('/csrf')).json();const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Cookie:cookie,...(body?{[csrf.header]:csrf.token,'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{})},body:body?(form?new URLSearchParams(body):JSON.stringify(body)):undefined});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];return r;},async login(login,password){assert.equal((await this.call('/login',{username:login,password},true)).status,204);csrf=await(await this.call('/csrf')).json();}};}
const a=client(),b=client(),login='account'+Date.now(),password='password123';
assert.equal((await a.call('/register',{login,password:'가'.repeat(30),nickname:'검증'})).status,400);
assert.equal((await a.call('/register',{login,password,nickname:'검증'})).status,200);
assert.equal((await(await a.call('/accounts/availability?login='+login)).json()).available,false);
assert.equal((await a.call('/register',{login,password,nickname:'검증'})).status,409);
await a.login(login,password);await b.login(login,password);
assert.equal((await a.call('/me/profile',{nickname:'변경된 이름'})).status,200);
assert.equal((await(await b.call('/me')).json()).nickname,'변경된 이름');
assert.equal((await a.call('/me/password',{currentPassword:'incorrect',password:'newPassword123'})).status,400);
assert.equal((await a.call('/me/password',{currentPassword:password,password:'newPassword123'})).status,200);
assert.equal((await b.call('/me')).status,401);assert.equal((await a.call('/me')).status,401);
const c=client();await c.login(login,'newPassword123');
let limited=false;for(let i=0;i<25;i++){if((await c.call('/login',{username:login,password:'wrong'},true)).status===429){limited=true;break;}}assert.ok(limited);
console.log('PASS account validation, duplicate, profile, password, session revocation, rate limit');
