import {test} from 'node:test';import assert from 'node:assert/strict';import {createApp} from '../server.mjs';
test('local model selection, chat streaming, and request validation',async()=>{
 let upstreamBody;const mock=async(url,options)=>{if(url.pathname==='/api/tags')return Response.json({models:[{name:'gemma3:4b',details:{parameter_size:'4B'}},{name:'remote:cloud',remote_host:'https://example.com'}]});upstreamBody=JSON.parse(options.body);return new Response(JSON.stringify({message:{role:'assistant',content:'Hello from the local model.'},done:false})+'\n'+JSON.stringify({done:true,eval_count:6})+'\n')};
 const server=createApp({fetchImpl:mock});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const input={model:'gemma3:4b',system:'Be concise.',temperature:.7,messages:[{role:'user',content:'Hello'}]};
 try{assert.deepEqual((await(await fetch(base+'/api/models')).json()).models.map(m=>m.name),['gemma3:4b']);const response=await fetch(base+'/api/chat',{method:'POST',body:JSON.stringify(input)});assert.equal(response.status,200);assert((await response.text()).includes('Hello from the local model.'));assert.equal(upstreamBody.messages[0].role,'system');assert.equal(upstreamBody.stream,true);
 for(const changed of [{model:'remote:cloud'},{messages:[{role:'system',content:'Invalid role'}]},{temperature:3},{system:5}]){const r=await fetch(base+'/api/chat',{method:'POST',body:JSON.stringify({...input,...changed})});assert.equal(r.status,400)}
 const blocked=await fetch(base+'/api/chat',{method:'POST',headers:{Origin:'https://example.com'},body:JSON.stringify(input)});assert.equal(blocked.status,403);
 assert.throws(()=>createApp({ollamaUrl:'https://example.com'}),/local HTTP/);
 }finally{await new Promise(r=>server.close(r))}
});
