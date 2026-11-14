import { localDate,isBirthday,isQuiet,birthdayLabel,nextBirthday } from './calendar.js';
export const BIRTHDAY_TEXT='生日快乐！愿你新的一岁平安顺遂，天天开心。';
export class BirthdayEngine {
  constructor({store,pet,now=()=>new Date()}){this.store=store;this.pet=pet;this.now=now;this.lastHeartbeat=0;this.lastResult={reason:'starting'};this.queue=Promise.resolve();this.deliveredMemory=new Set();}
  heartbeat(){this.lastHeartbeat=Date.now();}
  async status(){const config=await this.store.config();const today=localDate(this.now(),config.timeZone);return {ok:true,version:'0.1.0',config,label:birthdayLabel(config.birthday),nextSolar:nextBirthday(config.birthday,today),today:today.iso,remindedDays:(await this.store.receipts()).days,result:this.lastResult};}
  check(){const pending=this.queue.then(()=>this.run(false));this.queue=pending.catch(()=>{});return pending;}
  preview(){const pending=this.queue.then(()=>this.run(true));this.queue=pending.catch(()=>{});return pending;}
  async run(preview){
    const config=await this.store.config(),today=localDate(this.now(),config.timeZone);
    const done=result=>(this.lastResult=result,result);
    if(!preview && (!config.enabled || !config.birthday))return done({delivered:false,reason:'disabled'});
    if(!preview && !isBirthday(today,config.birthday))return done({delivered:false,reason:'not-today'});
    if(!preview && isQuiet(config,today))return done({delivered:false,reason:'quiet-hours'});
    if(!preview && this.deliveredMemory.has(today.iso))return done({delivered:false,reason:'already-reminded'});
    const deliver=async()=>{
      const cfg=await this.pet.request('/config'),state=await this.pet.request('/state');
      for(const entry of Object.values(cfg))for(const pet of entry?.pets??[]){
        const id=String(pet.id??''),display=String(pet.display??'none'),leaves=state.pets?.[id];
        if(!id || display==='none' || !['web','desktop','both'].includes(display))continue;
        if(leaves?.sleep?.data?.sleeping || (leaves?.lock?.data?.locked && leaves.lock.data.expiresAt>Date.now()))continue;
        let surface=display==='desktop'?'desktop':'web';
        let animated=false;
        const webOnline=Date.now()-this.lastHeartbeat<90000 && this.lastHeartbeat!==0;
        if(!webOnline || display==='desktop'){
          // Public playback acknowledgments confirm a desktop is actually rendering.
          // No lock is acquired: the host's sleep/occupancy gates remain authoritative.
          if(display==='web' || !config.animation)continue;
          const name=entry.animations?.events?.workStatus?.[4];
          if(typeof name!=='string')continue;
          const accepted=await this.pet.request(`/anim?pet=${encodeURIComponent(id)}&surface=desktop`,{name});
          if(!accepted.ok || !accepted.playbackId)continue;
          const receipt=await this.pet.request(`/playback/${encodeURIComponent(accepted.playbackId)}?wait=playing,ended&timeout=3000`);
          if(!['playing','ended'].includes(receipt.status))continue;
          surface='desktop';animated=true;
        }
        const result=await this.pet.request(`/broadcast?pet=${encodeURIComponent(id)}&surface=${surface}`,{text:preview?'生日祝福预览：'+BIRTHDAY_TEXT:BIRTHDAY_TEXT,duration:15000,anim:config.animation&&!animated,speak:config.speak});
        if(!result.ok)continue;
        // Once accepted, retain an in-memory receipt even if the disk write fails.
        if(!preview)this.deliveredMemory.add(today.iso);
        return {delivered:true,reason:preview?'preview':'delivered',petId:id,surface,day:today.iso};
      }
      return {delivered:false,reason:'pet-unavailable'};
    };
    return done(preview?await deliver():await this.store.once(today.iso,deliver));
  }
}
