import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL ?? 'http://localhost:3000';
assert.equal((await fetch(base+'/healthz')).status,200);
assert.equal((await fetch(base+'/')).status,200);
assert.equal((await fetch(base+'/rooms/123')).status,200); // Shell only; data stays private.
assert.equal((await fetch(base+'/api/rooms/123/messages')).status,401);
assert.equal((await fetch(base+'/api/push/status')).status,401);
console.log('PASS public shell/health and protected room/push APIs');
