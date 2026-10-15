import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=dirname(fileURLToPath(import.meta.url));
class RequestError extends Error {constructor(status,message){super(message);this.status=status}}
async function readBody(req){let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>200_000)throw new RequestError(413,'This conversation is too large. Start a new chat.');parts.push(chunk)}try{const body=JSON.parse(Buffer.concat(parts).toString());if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body}catch{throw new RequestError(400,'Invalid request.')}}
const localModel=m=>m&&typeof m.name==='string'&&!m.remote_host&&!m.remote_model&&!/(?:^|[:/])cloud(?:$|[:/])/.test(m.name);
export function createApp({ollamaUrl=process.env.OLLAMA_URL||'http://127.0.0.1:11434',fetchImpl=fetch}={}){
 const upstream=new URL(ollamaUrl);if(!['localhost','127.0.0.1','[::1]'].includes(upstream.hostname)||upstream.protocol!=='http:'||upstream.username||upstream.password)throw Error('Ollama must use a local HTTP address.');
 async function models(){const response=await fetchImpl(new URL('/api/tags',upstream),{signal:AbortSignal.timeout(5000)});if(!response.ok)throw new RequestError(503,'Ollama could not list your models.');const data=await response.json();return(data.models||[]).filter(localModel).map(m=>({name:m.name,size:m.size,parameters:m.details?.parameter_size||'',family:m.details?.family||''}))}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
  try{
   const url=new URL(req.url,'http://localhost');
   if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw new RequestError(403,'Cross-origin requests are not allowed.');
   if(url.pathname==='/api/models'&&req.method==='GET')return json(200,{models:await models()});
   if(url.pathname==='/api/chat'&&req.method==='POST'){
    const data=await readBody(req);
    if(typeof data.model!=='string'||!Array.isArray(data.messages)||data.messages.length<1||data.messages.length>100)throw new RequestError(400,'Choose a model and write a message.');
    if(!data.messages.every(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=64000))throw new RequestError(400,'The conversation contains an invalid message.');
    if(data.messages.at(-1).role!=='user')throw new RequestError(400,'The last message must be from you.');
    if(typeof data.system!=='string'||data.system.length>4000)throw new RequestError(400,'Instructions must be under 4,000 characters.');
    if(typeof data.temperature!=='number'||!Number.isFinite(data.temperature)||data.temperature<0||data.temperature>1.5)throw new RequestError(400,'Temperature must be between 0 and 1.5.');
    const available=await models();if(!available.some(m=>m.name===data.model))throw new RequestError(400,'This local model is unavailable. Refresh the model list.');
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);res.on('close',()=>controller.abort());
    try{
     const response=await fetchImpl(new URL('/api/chat',upstream),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:data.model,messages:[...(data.system.trim()?[{role:'system',content:data.system.trim()}]:[]),...data.messages.slice(-30)],stream:true,keep_alive:'5m',options:{temperature:data.temperature,num_ctx:8192,num_predict:2048}}),signal:controller.signal});
     if(!response.ok){const error=await response.json().catch(()=>({}));throw new RequestError(502,error.error||'The model could not respond. Check Ollama and try again.')}
     res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','X-Accel-Buffering':'no'});
     for await(const chunk of response.body){if(controller.signal.aborted)break;res.write(chunk)}
     res.end();
    }finally{clearTimeout(timer)}
    return;
   }
   const files={'/':['index.html','text/html'],'/index.html':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml']};
   const file=files[url.pathname];if(!file||req.method!=='GET')throw new RequestError(404,'Not found.');res.writeHead(200,{'Content-Type':file[1]+'; charset=utf-8'});res.end(readFileSync(join(root,'public',file[0])));
  }catch(error){if(res.destroyed)return;let message=error.status?error.message:'Ollama is not responding. Open Ollama on this computer, then try again.';if(error.name==='AbortError'||error.name==='TimeoutError')message='The model took too long to respond. Try again or choose a smaller model.';if(res.headersSent)res.end(JSON.stringify({error:message})+'\n');else json(error.status||503,{error:message});}
 });return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT||4176);createApp().listen(port,'127.0.0.1',()=>console.log(`Local Chat: http://127.0.0.1:${port}`))}
