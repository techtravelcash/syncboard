// TC-462: execute real handler with isolated Cosmos, identity and side-effect mocks.
// No live requests, credentials, databases or notifications.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const helpers = require('../api/shared/homologation.js');
const source = readFileSync(new URL('../api/updateTask/index.js', import.meta.url), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const reviewer = 'reviewer@example.test';
const other = 'other@example.test';
const assignee = 'new@example.test';
const base = {id:'TC-462', title:'Fixture', status:'homologation', progress:63, _etag:'v1', homologador:{email:reviewer, name:'Reviewer'}, responsible:[{email:other,name:'Old'}], history:[]};
function fixture(initial=base) {
    let task = clone(initial), version = 1, failWrite = false, loseResponse = false;
    const writes=[], notices=[], discord=[], signals=[];
    const profiles=[{email:assignee,name:'New <script>',picture:'picture'},{email:reviewer,name:'Reviewer'},{email:other,name:'Old'}];
    const tasks={item(id, partition){assert.equal(id,base.id);assert.equal(partition,base.id);return {
        async read(){return {resource:clone(task)};},
        async replace(value,options){
            assert.deepEqual(clone(options),{accessCondition:{type:'IfMatch',condition:value._etag}});
            if(failWrite)throw Object.assign(new Error('network failure'),{code:503});
            if(options.accessCondition.condition!==task._etag)throw Object.assign(new Error('precondition'),{code:412});
            task={...clone(value),_etag:`v${++version}`};writes.push(clone(task));if(loseResponse)throw Object.assign(new Error('response lost after commit'),{code:503});return {resource:clone(task)};
        }
    };}};
    const users={items:{query(spec){assert.equal(spec.parameters[0].name,'@email');return {async fetchAll(){return {resources:profiles.filter(p=>p.email.toLowerCase()===spec.parameters[0].value)};}};}}};
    users.item=(id)=>({async read(){const profile=profiles.find(p=>p.email===id);return {resource:profile?clone({...profile,_etag:profile._etag||'user-v1'}):null};},async replace(value,options){const profile=profiles.find(p=>p.email===id);if(!profile)throw Object.assign(new Error('missing'),{code:404});if(options.accessCondition.condition!==(profile._etag||'user-v1'))throw Object.assign(new Error('stale'),{code:412});Object.assign(profile,clone(value));profile._etag=(profile._etag||'user-v1')+'x';return {resource:clone(profile)};}});
    const notifications={items:{async create(value){notices.push(clone(value));}}};
    const CosmosClient=class{database(){return {container(name){return {Tasks:tasks,Users:users,Notifications:notifications}[name];}};}};
    const module={exports:{}};
    vm.runInNewContext(source,{module,require(name){if(name==='@azure/cosmos')return {CosmosClient};if(name==='axios')return {async post(url,payload){discord.push(payload);}};if(name==='crypto')return {randomUUID:()=>String(notices.length+1)};if(name==='../shared/homologation')return helpers;if(name==='../shared/reviewerGuard')return require('../api/shared/reviewerGuard.js');throw new Error(name);},process:{env:{DISCORD_WEBHOOK_URL:'mock://discord'}},console});
    async function call(body,actor=reviewer,roles=['authenticated','travelcash_user']) {
        const log=()=>{};log.error=()=>{};
        const context={bindingData:{id:base.id},bindings:{},log};
        const headers=actor===null?{}:{'x-ms-client-principal':Buffer.from(JSON.stringify({userDetails:actor,userRoles:roles})).toString('base64')};
        await module.exports(context,{body,headers});
        if(context.bindings.signalRMessage)signals.push(clone(context.bindings.signalRMessage));
        return clone(context.res);
    }
    return {call,writes,notices,discord,signals,get task(){return task;},set failWrite(value){failWrite=value;},set loseResponse(value){loseResponse=value;},setTask(value){task=clone(value);}};
}
const request=(action,extra={})=>({homologationAction:action,expectedStatus:'homologation',expectedEtag:'v1',...extra});
for(const action of ['approve','reject','forward']) {
    const f=fixture();const response=await f.call(request(action,{newResponsibleEmail:' NEW@EXAMPLE.TEST ',status:'done',progress:0,homologador:{email:other},responsible:[{email:'forged@example.test'}],history:[{description:'forged'}],actorEmail:other}));
    assert.equal(response.status,undefined);assert.equal(f.task.status,{approve:'publication',reject:'inprogress',forward:'todo'}[action]);
    assert.equal(f.task.progress,action==='approve'?100:63);assert.deepEqual(f.task.homologador,action==='approve'?base.homologador:null);
    assert.equal(f.task.history.length,1);assert.match(f.task.history[0].description,new RegExp(reviewer.replaceAll('.','\\.')));
    assert.equal(f.writes.length,1);assert.equal(f.discord.length,1);assert.equal(f.signals.length,1);assert.equal(f.notices.length,0);
    if(action==='forward'){assert.equal(f.task.responsible.length,1);assert.equal(f.task.responsible[0].email,assignee);assert.match(f.task.history[0].description,/New &lt;script&gt;/);assert.ok(!f.task.history[0].description.includes('<script>'));}
    else assert.deepEqual(f.task.responsible,base.responsible);
    const duplicate=await f.call(request(action,{newResponsibleEmail:assignee}));assert.equal(duplicate.status,409);assert.equal(f.task.history.length,1);assert.equal(f.writes.length,1);assert.equal(f.discord.length,1);assert.equal(f.signals.length,1);
}
for(const action of ['approve','reject','forward']) for(const actor of [null,other]) {
    const f=fixture();const response=await f.call(request(action,{newResponsibleEmail:assignee,actorEmail:reviewer}),actor,['admin','travelcash_user']);
    assert.equal(response.status,actor===null?401:403);assert.equal(f.writes.length,0);assert.equal(f.discord.length,0);
}
for(const homologador of [null,undefined,'Reviewer',{name:'Reviewer'}, {email:other}]) {
    const f=fixture({...base,homologador});assert.equal((await f.call(request('approve'))).status,403);assert.equal(f.writes.length,0);
}
for(const homologador of [' REVIEWER@EXAMPLE.TEST ',{email:' REVIEWER@EXAMPLE.TEST '}]) {
    const f=fixture({...base,homologador});assert.equal((await f.call(request('approve'),' REVIEWER@EXAMPLE.TEST ')).status,undefined);
}
for(const expectedEtag of [undefined,null,'v0']){const f=fixture();assert.equal((await f.call(request('reject',{expectedEtag}))).status,409);assert.equal(f.writes.length,0);}
for(const expectedStatus of [undefined,'todo']){const f=fixture();assert.equal((await f.call(request('reject',{expectedStatus}))).status,400);}
for(const newResponsibleEmail of [undefined,'','Name','absent@example.test',other]){const f=fixture();assert.equal((await f.call(request('forward',{newResponsibleEmail}))).status,400);assert.equal(f.writes.length,0);}
{const f=fixture();assert.equal((await f.call(request('forward',{newResponsibleEmail:reviewer}))).status,undefined);assert.equal(f.task.responsible[0].email,reviewer);}
{const f=fixture({...base,responsible:[...base.responsible,{email:assignee}]});assert.equal((await f.call(request('forward',{newResponsibleEmail:other}))).status,undefined);assert.equal(f.task.responsible.length,1);}
for(const patch of [{status:'publication'},{status:'todo'},{status:'inprogress'},{homologador:{email:other}},{homologador:null},{progress:100},{responsible:[{email:reviewer}]}]) {
    const f=fixture();assert.equal((await f.call(patch,other,['admin'])).status,403);assert.equal(f.writes.length,0);
}
{const f=fixture();const response=await f.call({...base,title:'Allowed edit',history:[],actorEmail:other,_etag:'forged'},other);assert.equal(response.status,undefined);assert.equal(f.task.title,'Allowed edit');assert.equal(f.task.homologador.email,reviewer);assert.equal(f.task.actorEmail,undefined);assert.equal(f.task.history.length,1);}
{const f=fixture();const responses=await Promise.all([f.call(request('approve')),f.call(request('reject')),f.call(request('forward',{newResponsibleEmail:assignee}))]);assert.equal(responses.filter(x=>x.status===undefined).length,1);assert.equal(responses.filter(x=>x.status===409).length,2);assert.equal(f.writes.length,1);assert.equal(f.task.history.length,1);assert.equal(f.discord.length,1);assert.equal(f.signals.length,1);}
{const f=fixture();await f.call(request('reject'));f.setTask({...f.task,status:'homologation',homologador:base.homologador,_etag:'v3'});assert.equal((await f.call(request('approve'))).status,409);assert.equal(f.writes.length,1);}
{const f=fixture();f.failWrite=true;assert.equal((await f.call(request('reject'))).status,500);assert.equal(f.writes.length,0);assert.equal(f.task.status,'homologation');assert.equal(f.task.history.length,0);assert.equal(f.discord.length,0);assert.equal(f.signals.length,0);f.failWrite=false;assert.equal((await f.call(request('reject'))).status,undefined);assert.equal(f.writes.length,1);}
{const f=fixture();assert.equal((await f.call(request('cancel'))).status,400);assert.equal(f.writes.length,0);}
{const f=fixture();f.loseResponse=true;assert.equal((await f.call(request('approve'))).status,500);f.loseResponse=false;assert.equal((await f.call(request('approve'))).status,409);assert.equal(f.writes.length,1);assert.equal(f.task.history.length,1);assert.equal(f.notices.length,0);assert.equal(f.discord.length,0);}
{const f=fixture({...base,status:'inprogress',homologador:null});assert.equal((await f.call({status:'homologation',homologador:{email:reviewer,name:'Reviewer'},expectedStatus:'inprogress',expectedEtag:'v1'})).status,undefined);assert.equal(f.notices.length,1);assert.equal(f.signals.length,1);assert.equal(f.discord.length,1);assert.equal(f.task.history.length,1);}
for(const invalid of [null,[],false,'invalid']){const f=fixture();assert.equal((await f.call(invalid)).status,400);assert.equal(f.writes.length,0);}
assert.equal(helpers.actorEmail({headers:{'x-ms-client-principal':'malformed'}}),null);
for(const roles of [[],['authenticated'],['admin']]) {const f=fixture();assert.equal((await f.call(request('approve'),reviewer,roles)).status,401);assert.equal(f.writes.length,0);}
const identity = principal => helpers.actorEmail({headers:{'x-ms-client-principal':Buffer.from(JSON.stringify(principal)).toString('base64')}});
for(const typ of ['email','emails','http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']) {
    assert.equal(identity({userRoles:['travelcash_user'],userDetails:'Reviewer',claims:[{typ,val:' REVIEWER@EXAMPLE.TEST '}]}),reviewer);
}
assert.equal(identity({userRoles:['travelcash_user'],userDetails:other,claims:[{typ:'email',val:reviewer}]}),other);
assert.equal(identity({userRoles:['travelcash_user'],userDetails:'Reviewer',claims:[{typ:'name',val:reviewer}]}),null);


console.log('PASS TC-462 API: authoritative approve/reject/forward; actual normalized homologator only; spoof/admin/missing rejection; registered sole assignee and self forwarding; generic bypass guards; escaped history; ETag stale/ABA/race/retry protection; one audit and side effects per winner. Isolated mocks only.');

// Every remaining full-document Tasks writer must reject an intervening decision.
for (const handler of ['addComment','deleteComment','editComment','signalResponsible','dismissAlert']) {
    for (const scenario of ['normal', 'concurrent', ...(handler === 'addComment' ? ['notification-failure'] : [])]) {
        const concurrentDecision = scenario === 'concurrent';
        let stored={...clone(base), comments:[{id:'comment-1',text:'Original',author:reviewer}], pendingAlerts:[reviewer]};
        const original=clone(stored), writes=[], alerts=[], external=[];
        const tasks={item(id,partition){assert.equal(id,base.id);assert.equal(partition,base.id);return {
            async read(){return {resource:clone(stored)};},
            async replace(snapshot,options){
                assert.deepEqual(clone(options),{accessCondition:{type:'IfMatch',condition:'v1'}});
                if(concurrentDecision) stored={...stored,status:'publication',progress:100,_etag:'v2',history:[{description:'Approved by assigned reviewer'}]};
                if(options.accessCondition.condition!==stored._etag)throw Object.assign(new Error('stale'),{code:412});
                stored={...clone(snapshot),_etag:'v2'};writes.push(clone(stored));return {resource:clone(stored)};
            }
        };}};
        const users={item(){return {async read(){return {resource:{email:reviewer,name:reviewer}};}};},items:{readAll(){return {async fetchAll(){return {resources:[{email:other,name:'Old'}]};}};}}};
        users.item=(id)=>({async read(){const profile=profiles.find(p=>p.email===id);return {resource:profile?clone({...profile,_etag:profile._etag||'user-v1'}):null};},async replace(value,options){const profile=profiles.find(p=>p.email===id);if(!profile)throw Object.assign(new Error('missing'),{code:404});if(options.accessCondition.condition!==(profile._etag||'user-v1'))throw Object.assign(new Error('stale'),{code:412});Object.assign(profile,clone(value));profile._etag=(profile._etag||'user-v1')+'x';return {resource:clone(profile)};}});
    const notifications={items:{async create(value){if (scenario === 'notification-failure') throw new Error('notification unavailable');alerts.push(clone(value));}}};
        const CosmosClient=class{database(){return {containers:{async createIfNotExists(){}},container(name){return {Tasks:tasks,Users:users,Notifications:notifications}[name];}};}};
        const module={exports:{}};
        vm.runInNewContext(readFileSync(new URL(`../api/${handler}/index.js`,import.meta.url),'utf8'),{module,Buffer,console,process:{env:{DISCORD_WEBHOOK_URL:'mock://discord'}},require(name){if(name==='@azure/cosmos')return {CosmosClient};if(name==='axios')return {async post(...args){external.push(args);}};if(name==='uuid')return {v4:()=>`uuid-${alerts.length}`};throw new Error(name);}});
        const log=()=>{};log.error=()=>{};log.warn=()=>{};
        const context={bindingData:{id:base.id,taskId:base.id,commentId:'comment-1'},bindings:{},log};
        const body={index:0,text:`Hello <span data-email="${other}">@Old</span>`,author:reviewer,targets:['Old']};
        await module.exports(context,{body,headers:{'x-ms-client-principal':Buffer.from(JSON.stringify({userDetails:reviewer,userId:'fixture',userRoles:['travelcash_user']})).toString('base64')}},clone(original));
        assert.equal(context.bindings.outputDocument,undefined);
        if(concurrentDecision){
            assert.equal(context.res.status,409,handler);assert.equal(writes.length,0,handler);assert.equal(stored.status,'publication',handler);assert.equal(stored.progress,100,handler);assert.equal(stored.history.length,1,handler);assert.deepEqual(stored.comments,original.comments,handler);assert.equal(alerts.length,0,handler);assert.equal(external.length,0,handler);assert.equal(context.bindings.signalRMessage,undefined,handler);
        }else{
            assert.equal(context.res.status,undefined,handler);assert.equal(writes.length,1,handler);assert.equal(stored.status,'homologation',handler);assert.equal(stored.history.length,0,handler);assert.ok(context.bindings.signalRMessage,handler);
            if (scenario === 'notification-failure') {assert.equal(stored.comments.length,2);assert.equal(external.length,1);assert.equal(alerts.length,0);assert.equal(context.res.body.comments.length,2);}
        }
    }
}
const editBindings=JSON.parse(readFileSync(new URL('../api/editComment/function.json',import.meta.url),'utf8')).bindings;
assert.ok(!editBindings.some(binding=>binding.type==='cosmosDB'&&binding.direction==='out'));
console.log('PASS TC-462 cross-endpoint races: add/edit/delete comment and signal/dismiss alert use IfMatch, return409 on stale snapshots, preserve newer decision/history and emit no loser notifications. Field-only patch writers and Users untouched.');
