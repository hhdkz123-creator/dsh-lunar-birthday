import { mkdir,readFile,writeFile,rename,open,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cleanBirthday } from './calendar.js';
export const DEFAULTS={version:1,enabled:false,birthday:null,timeZone:'Asia/Shanghai',quiet:{enabled:true,start:22,end:8},speak:false,animation:true};
export async function readJSON(path,fallback) {
  try { return JSON.parse(await readFile(path,'utf8')); } catch(e) { if(e.code==='ENOENT') return structuredClone(fallback); throw new Error('配置或提醒记录无法读取，请先恢复备份'); }
}
export async function atomicJSON(path,data) {
  const temp=path+'.'+randomUUID()+'.tmp';
  try { await writeFile(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await rename(temp,path); }
  finally { await unlink(temp).catch(()=>{}); }
}
export function validateConfig(value,previous=DEFAULTS) {
  if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('配置无效');
  const result={...previous};
  for(const key of ['enabled','speak','animation']) if(key in value){if(typeof value[key]!=='boolean')throw new Error('开关值无效');result[key]=value[key];}
  if('birthday' in value) result.birthday=value.birthday===null?null:cleanBirthday(value.birthday);
  if('timeZone' in value){new Intl.DateTimeFormat('en',{timeZone:value.timeZone});result.timeZone=value.timeZone;}
  if('quiet' in value){const q=value.quiet;if(!q || typeof q.enabled!=='boolean' || !Number.isInteger(q.start) || !Number.isInteger(q.end) || q.start<0 || q.start>23 || q.end<0 || q.end>23)throw new Error('免打扰时间无效');result.quiet={...previous.quiet,...q};}
  return result;
}
export class Store {
  constructor(root){this.root=root;this.queue=Promise.resolve();}
  serial(fn){const next=this.queue.then(fn,fn);this.queue=next.catch(()=>{});return next;}
  async lock(fn){
    await mkdir(this.root,{recursive:true,mode:0o700});
    const path=join(this.root,'.reminder.lock');let handle;
    for(let tries=0;tries<3;tries++) {
      try {handle=await open(path,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid}));break;}
      catch(e){
        if(e.code!=='EEXIST')throw e;
        let pid;try{pid=JSON.parse(await readFile(path,'utf8')).pid;}catch{throw new Error('提醒记录正被使用');}
        if(!Number.isInteger(pid) || pid<1)throw new Error('提醒锁无效');
        try{process.kill(pid,0);throw new Error('提醒记录正被使用');}catch(error){if(error.code!=='ESRCH')throw error;await unlink(path).catch(()=>{});}
      }
    }
    if(!handle) throw new Error('无法取得提醒锁');
    try{return await fn();}finally{await handle.close();await unlink(path).catch(()=>{});}
  }
  async config(){return validateConfig(await readJSON(join(this.root,'config.json'),DEFAULTS));}
  async saveConfig(value){return this.serial(()=>this.lock(async()=>{const raw=await readJSON(join(this.root,'config.json'),DEFAULTS);const next=validateConfig(value,raw);await atomicJSON(join(this.root,'config.json'),next);return next;}));}
  async receipts(){const state=await readJSON(join(this.root,'state.json'),{version:1,days:[]});if(!Array.isArray(state.days)||!state.days.every(d=>/^\d{4}-\d\d-\d\d$/.test(d)))throw new Error('提醒记录损坏，已暂停以避免重复');return state;}
  async once(day,deliver){return this.serial(()=>this.lock(async()=>{const state=await this.receipts();if(state.days.includes(day))return {delivered:false,reason:'already-reminded'};const result=await deliver();if(!result.delivered)return result;await atomicJSON(join(this.root,'state.json'),{...state,days:[...state.days,day].slice(-64)});return result;}));}
}
