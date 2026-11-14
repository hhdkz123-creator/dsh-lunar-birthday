window.__ModuleLoader__.load({id:'dsh-lunar-birthday-local',factory:require=>{
  const React=require('react'),h=React.createElement;
  const B=new URL('.',document.baseURI).pathname.replace(/\/$/,'')+'/dsh-lunar-birthday';
  const months=['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
  const days=['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
  async function api(path,method='GET',body){const r=await fetch(B+path,{method,credentials:'same-origin',cache:'no-store',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok||data.ok===false)throw new Error(data.error||'暂时无法连接，请重试');return data;}
  const box={border:'1px solid var(--dsw-alias-border-primary,#d9dde4)',borderRadius:16,padding:20,maxWidth:720,background:'var(--dsw-alias-background-primary,transparent)'};
  const control={font:'inherit',padding:'8px 12px',border:'1px solid var(--dsw-alias-border-primary,#cbd0d8)',borderRadius:8,color:'inherit',background:'var(--dsw-alias-background-primary,transparent)'};
  const row={display:'flex',alignItems:'center',gap:12,flexWrap:'wrap',marginTop:16};
  function Page(){
    const [status,setStatus]=React.useState(null),[cfg,setCfg]=React.useState(null),[message,setMessage]=React.useState(''),[busy,setBusy]=React.useState(false),[dirty,setDirty]=React.useState(false);
    const load=async()=>{try{const s=await api('/status');setStatus(s);setCfg(s.config);setDirty(false);}catch(e){setMessage(e.message);}};
    React.useEffect(()=>{void load();},[]);
    if(!cfg)return h('div',{style:box},h('h3',null,'我的生日'),h('p',{role:'status'},message||'正在读取生日设置…'),h('button',{style:control,onClick:load},'重新读取'));
    const b=cfg.birthday||{calendar:'solar',month:4,day:1,leap:false};
    const update=value=>{setCfg({...cfg,...value});setDirty(true);setMessage('');};
    const setBirthday=value=>update({birthday:{...b,...value}});
    const toggle=(title,key)=>h('label',{style:row},h('input',{type:'checkbox',checked:cfg[key],onChange:e=>update({[key]:e.target.checked})}),title);
    const select=(label,value,options,onChange)=>h('label',{style:{display:'flex',alignItems:'center',gap:8}},label,h('select',{style:control,'aria-label':label,value,onChange:e=>onChange(e.target.value)},...options.map(([v,text])=>h('option',{key:v,value:v},text))));
    const save=async()=>{setBusy(true);try{const s=await api('/config','PUT',cfg);setStatus(s);setCfg(s.config);setDirty(false);setMessage('已保存，重启 DSH 后仍然保留。');}catch(e){setMessage(e.message);}finally{setBusy(false);}};
    const preview=async()=>{setBusy(true);try{const r=await api('/preview','POST',{});setMessage(r.delivered?'已发送预览，不计入生日提醒次数。':'桌宠暂不可用：请确认已显示、醒着且未被占用。');}catch(e){setMessage(e.message);}finally{setBusy(false);}};
    return h('section',{style:box,'aria-label':'农历生日设置'},
      h('h3',{style:{marginTop:0}},'我的生日'),h('p',null,'农历生日插件 · 已安装'),
      h('p',null,'生日当天祝福一次；支持启动补报，并沿用大肥鱼气泡、动画和语音。'),
      toggle('开启生日提醒','enabled'),
      h('div',{style:row},select('生日类型',b.calendar,[['solar','公历生日'],['lunar','农历生日']],calendar=>setBirthday({calendar,leap:false,day:Math.min(b.day,calendar==='lunar'?30:31)}))),
      h('div',{style:row},select('月份',b.month,Array.from({length:12},(_,i)=>[i+1,b.calendar==='lunar'?months[i]:`${i+1}月`]),v=>setBirthday({month:+v})),select('日期',b.day,Array.from({length:b.calendar==='lunar'?30:31},(_,i)=>[i+1,b.calendar==='lunar'?days[i]:`${i+1}日`]),v=>setBirthday({day:+v})),b.calendar==='lunar'?h('label',null,h('input',{type:'checkbox',checked:b.leap,onChange:e=>setBirthday({leap:e.target.checked})}),' 闰月'):null),
      h('p',{style:{lineHeight:1.8}},dirty?'修改后请保存，以计算下一次日期。':`${status.label} · 下一次公历生日：${status.nextSolar||'暂无法计算'}`),
      h('p',{style:{opacity:.7}},'无对应闰月或日期的年份跳过；睡眠、隐藏或被占用时不打扰。'),
      toggle('播放祝福动画','animation'),toggle('语音播报（遵守大肥鱼语音总开关）','speak'),
      h('label',{style:row},h('input',{type:'checkbox',checked:cfg.quiet.enabled,onChange:e=>update({quiet:{...cfg.quiet,enabled:e.target.checked}})}),'免打扰时间'),
      cfg.quiet.enabled?h('div',{style:row},select('开始',cfg.quiet.start,Array.from({length:24},(_,i)=>[i,`${i}:00`]),v=>update({quiet:{...cfg.quiet,start:+v}})),select('结束',cfg.quiet.end,Array.from({length:24},(_,i)=>[i,`${i}:00`]),v=>update({quiet:{...cfg.quiet,end:+v}})),h('span',null,'中国标准时间')):null,
      h('div',{style:row},h('button',{style:control,disabled:busy,onClick:save},busy?'处理中…':'保存生日'),h('button',{style:control,disabled:busy||dirty,onClick:preview},'预览祝福（不计次数）')),
      h('p',{role:'status','aria-live':'polite'},message));
  }
  return {inject:['slots'],apply(ctx){
    const slots=ctx.get('slots');
    slots.inject('settings.section',()=>slots.register({name:'settings.section',id:'lunar-birthday',order:65,label:'农历生日'},Page));
    ctx.effect(()=>{const beat=()=>api('/heartbeat','POST',{}).catch(()=>{});void beat();const timer=setInterval(beat,30000);return()=>clearInterval(timer);},'农历生日：页面在线状态');
  }};
}});
