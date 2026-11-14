import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanBirthday,isBirthday,nextBirthday,localDate,birthdayLabel,isQuiet } from '../lib/calendar.js';
import { Store,DEFAULTS } from '../lib/store.js';
import { BirthdayEngine } from '../lib/engine.js';
const B={calendar:'lunar',month:4,day:1,leap:false};
for(const [year,month,day] of [[2026,5,17],[2027,5,6]]) {
  test(`${year} lunar 4/1 conversion and neighboring days`,()=>{
    const expected=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    assert.equal(nextBirthday(B,{year,month:1,day:1,iso:`${year}-01-01`}),expected);
    assert.equal(isBirthday({year,month,day},B),true);
    assert.equal(isBirthday({year,month,day:day-1},B),false);
    assert.equal(isBirthday({year,month,day:day+1},B),false);
  });
}
test('solar compatibility, leap days and invalid dates',()=>{
  const s={calendar:'solar',month:2,day:29,leap:false};
  assert.equal(isBirthday({year:2028,month:2,day:29},s),true);
  assert.equal(nextBirthday(s,{year:2026,iso:'2026-01-01'}),'2028-02-29');
  assert.throws(()=>cleanBirthday({...s,month:2,day:30}));
  assert.throws(()=>cleanBirthday({...B,month:true}));
  assert.throws(()=>cleanBirthday({...B,day:31}));
});
test('lunar leap month is distinct and absent leap year skipped',()=>{
  assert.equal(isBirthday({year:2026,month:5,day:17},{...B,leap:true}),false);
  const next=nextBirthday({...B,leap:true},{year:2026,iso:'2026-01-01'});
  assert.notEqual(next,'2026-05-17');assert.ok(next);
});
test('zone and crossing-midnight quiet hours',()=>{
  assert.equal(localDate(new Date('2026-05-16T16:00:00Z')).iso,'2026-05-17');
  assert.equal(isQuiet(DEFAULTS,{hour:23,minute:0}),true);
  assert.equal(isQuiet(DEFAULTS,{hour:7,minute:59}),true);
  assert.equal(isQuiet(DEFAULTS,{hour:8,minute:0}),false);
  assert.equal(birthdayLabel(B),'农历四月初一');
});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'dsh-bday-'));const store=new Store(dir);await store.saveConfig({...DEFAULTS,enabled:true,birthday:B,quiet:{enabled:false,start:22,end:8}});return {dir,store};}
function transport({sleep=false,locked=false,online=true,fail=false}={}){
  const calls=[];
  return {calls,async request(path,body){calls.push({path,body});
    if(path==='/config')return {main:{pets:[{id:'main',display:'both'}],animations:{events:{workStatus:['a','b','c','d','celebrate']}}}};
    if(path==='/state')return {pets:{main:{sleep:{data:{sleeping:sleep}},lock:{data:{locked,expiresAt:Date.now()+100000}}}}};
    if(path.startsWith('/anim?'))return {ok:true,playbackId:'test'};
    if(path.startsWith('/playback/'))return {status:online?'playing':'accepted'};
    if(path.startsWith('/broadcast?'))return {ok:!fail,reason:'sleeping'};
    return {ok:true};}};
}
for(const reason of ['sleep','locked','offline','rejected'])test(`postpones when ${reason}`,async()=>{
  const {store}=await fixture();const pet=transport({sleep:reason==='sleep',locked:reason==='locked',online:reason!=='offline',fail:reason==='rejected'});
  const engine=new BirthdayEngine({store,pet,now:()=>new Date('2026-05-17T04:00:00Z')});
  if(reason!=='offline')engine.heartbeat();
  assert.equal((await engine.check()).delivered,false);
  assert.deepEqual((await store.receipts()).days,[]);
  assert.equal(pet.calls.some(c=>c.path.startsWith('/lock')),false);
});
test('startup catch-up, same-day restart and concurrent stores deduplicate',async()=>{
  const {dir,store}=await fixture();const pet=transport();
  const a=new BirthdayEngine({store,pet,now:()=>new Date('2027-05-06T04:00:00Z')});a.heartbeat();
  const b=new BirthdayEngine({store:new Store(dir),pet,now:()=>new Date('2027-05-06T05:00:00Z')});b.heartbeat();
  await Promise.allSettled([a.check(),b.check(),a.check()]);
  assert.equal(pet.calls.filter(c=>c.path.startsWith('/broadcast?')).length,1);
  assert.equal((await b.check()).reason,'already-reminded');
});
test('nonbirthday and quiet time do not call pet API',async()=>{
  const {store}=await fixture();const pet=transport();const engine=new BirthdayEngine({store,pet,now:()=>new Date('2026-05-16T04:00:00Z')});engine.heartbeat();
  assert.equal((await engine.check()).reason,'not-today');
  await store.saveConfig({quiet:{enabled:true,start:22,end:8}});engine.now=()=>new Date('2026-05-16T17:00:00Z');
  assert.equal((await engine.check()).reason,'quiet-hours');assert.equal(pet.calls.length,0);
});
test('namespace writes preserve unknown data and corrupt receipts fail closed',async()=>{
  const {store,dir}=await fixture();const path=join(dir,'config.json');
  const raw=JSON.parse(await readFile(path));raw.other={keep:true};await writeFile(path,JSON.stringify(raw));
  await store.saveConfig({speak:true});assert.deepEqual(JSON.parse(await readFile(path)).other,{keep:true});
  await writeFile(join(dir,'state.json'),'broken');await assert.rejects(()=>store.once('2026-05-17',async()=>({delivered:true})));
});
test('manual preview does not consume birthday receipt',async()=>{
  const {store}=await fixture();const pet=transport();const engine=new BirthdayEngine({store,pet,now:()=>new Date('2026-11-15T04:00:00Z')});engine.heartbeat();
  assert.equal((await engine.preview()).delivered,true);assert.deepEqual((await store.receipts()).days,[]);
});

test('management routes fail closed and reject cross-site requests',async()=>{
  const {rejected}=await import('../lib/index.js');
  const req={headers:{}};
  assert.equal(rejected({},req),503);
  assert.equal(rejected({connection:{requestRejection:()=>401}},req),401);
  assert.equal(rejected({connection:{requestRejection:()=>undefined}},{headers:{origin:'https://evil.example'}}),403);
  assert.equal(rejected({connection:{requestRejection:()=>undefined}},{headers:{'sec-fetch-site':'cross-site'}}),403);
  assert.equal(rejected({connection:{requestRejection:()=>undefined}},{headers:{origin:'http://127.0.0.1:3080'}}),0);
});
test('desktop playback acknowledgment precedes birthday broadcast',async()=>{
  const {store}=await fixture();const pet=transport();const engine=new BirthdayEngine({store,pet,now:()=>new Date('2026-05-17T04:00:00Z')});
  const result=await engine.check();assert.equal(result.delivered,true);assert.equal(result.surface,'desktop');
  const paths=pet.calls.map(c=>c.path);assert.ok(paths.findIndex(p=>p.startsWith('/playback/'))<paths.findIndex(p=>p.startsWith('/broadcast?')));
});


test('real independent processes serialize daily receipt',async()=>{
  const {fork}=await import('node:child_process');
  const {dir,store}=await fixture();
  const worker=new URL('./receipt-worker.mjs',import.meta.url);
  const children=[fork(worker,[dir],{stdio:['ignore','ignore','pipe','ipc']}),fork(worker,[dir],{stdio:['ignore','ignore','pipe','ipc']})];
  const finished=children.map(child=>new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('worker failed')));}));
  await Promise.all(children.map(child=>new Promise(resolve=>child.once('message',resolve))));
  children.forEach(child=>child.send('go'));
  await Promise.all(finished);
  assert.equal((await readFile(join(dir,'deliveries.txt'),'utf8')).trim(),'delivered');
  assert.deepEqual((await store.receipts()).days,['2027-05-06']);
});
