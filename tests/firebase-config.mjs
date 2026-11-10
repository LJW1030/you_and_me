import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const dir=await mkdtemp(join(tmpdir(),'firebase-config-test-'));
const script=new URL('../mobile/scripts/check-firebase.cjs',import.meta.url);
const run=p=>spawnSync(process.execPath,[script.pathname,p],{encoding:'utf8'}).status;
try {
 assert.notEqual(run(join(dir,'missing.json')),0);
 const p=join(dir,'config.json');
 await writeFile(p,JSON.stringify({type:'service_account',private_key:'FAKE_TEST_VALUE'}));assert.notEqual(run(p),0);
 const c={project_info:{project_id:'test',project_number:'123'},client:[{client_info:{mobilesdk_app_id:'test',android_client_info:{package_name:'wrong.id'}},api_key:[{current_key:'fake'}]}]};
 await writeFile(p,JSON.stringify(c));assert.notEqual(run(p),0);
 c.client[0].client_info.android_client_info.package_name='kr.nirangnae.chat';
 await writeFile(p,JSON.stringify(c));assert.equal(run(p),0);
 console.log('PASS Firebase config: missing file, service-account key, wrong package rejected; matching client accepted.');
} finally {await rm(dir,{recursive:true,force:true});}
