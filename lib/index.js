import { join } from 'node:path';
import { homedir } from 'node:os';
import { Store } from './store.js';
import { BirthdayEngine } from './engine.js';
export const name='dsh-lunar-birthday-local';
export const inject=['webServer','connection'];
export function rejected(ctx,req){
  try{
    const check=ctx.connection?.requestRejection;
    if(typeof check!=='function')return 503;
    const code=check.call(ctx.connection,req);
    if(code!==undefined && code!==null)return code===401?401:403;
    if(req.headers['sec-fetch-site']==='cross-site')return 403;
    const origin=req.headers.origin;
    if(origin && !/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(origin))return 403;
    return 0;
  }catch{return 503;}
}
async function bodyOf(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>8192)throw new Error('请求过大');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
export function apply(ctx){
  const root=join(process.env.DSH_HOME||join(homedir(),'.dsh'),'dsh-lunar-birthday');
  const store=new Store(root);
  const pet={async request(path,body){
    const port=ctx.webServer.port;
    if(!port)throw new Error('DSH 服务尚未启动');
    if(ctx.webServer.protocol!=='http:')throw new Error('此本地适配器当前只支持 HTTP 宿主');
    const response=await fetch(`http://127.0.0.1:${port}/dsh-pet-7340${path}`,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(6000),redirect:'error'});
    if(!response.ok)throw new Error('大肥鱼接口暂不可用');
    return response.json();
  }};
  const engine=new BirthdayEngine({store,pet});
  const json=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
  ctx.effect(()=>ctx.webServer.register({kind:'prefix',path:'/dsh-lunar-birthday',handler:async(req,res)=>{
    const denied=rejected(ctx,req);if(denied){json(res,denied,{ok:false,error:'访问未授权'});return;}
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      if(path==='/dsh-lunar-birthday/status' && req.method==='GET')return json(res,200,await engine.status());
      if(path==='/dsh-lunar-birthday/config' && req.method==='PUT'){await store.saveConfig(await bodyOf(req));return json(res,200,await engine.status());}
      if(path==='/dsh-lunar-birthday/heartbeat' && req.method==='POST'){engine.heartbeat();return json(res,200,{ok:true});}
      if(path==='/dsh-lunar-birthday/preview' && req.method==='POST')return json(res,200,{ok:true,...await engine.preview()});
      json(res,404,{ok:false,error:'接口不存在'});
    }catch(error){ctx.logger?.warn?.('[农历生日] '+error.message);json(res,400,{ok:false,error:error.message});}
  }}),'农历生日：设置与状态接口');
  ctx.effect(()=>{
    let stopped=false,timer;
    const run=async()=>{try{await engine.check();}catch(error){ctx.logger?.warn?.('[农历生日] '+error.message);}if(!stopped)timer=setTimeout(run,30000);};
    void run();
    return ()=>{stopped=true;clearTimeout(timer);};
  },'农历生日：启动补报及每日巡检');
  ctx.logger?.info?.('[农历生日] 插件 0.1.0 已加载，离线历法就绪');
}
