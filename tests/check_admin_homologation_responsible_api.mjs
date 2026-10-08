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
    const profiles=[{email:assignee,name:'New <script>',picture:'picture'},{email:reviewer,name:'Reviewer'},{email:'admin@example.test',name:'Admin',isAdmin:true},{email:'revoked@example.test',name:'Revoked',isAdmin:false},{email:other,name:'Old'}];
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

const admin='admin@example.test';
const roles=['authenticated','travelcash_user','admin'];
const request=(extra={})=>({expectedStatus:'homologation',expectedEtag:'v1',responsible:[{email:assignee,name:'Forged',isAdmin:true}],...extra});
const preserved={...base,history:[{description:'Prior entry'}],description:'Do not reset',comments:[{text:'keep'}],attachments:[{name:'keep'}],dueDate:'2027-01-01T12:00:00Z',customField:{keep:true}};
{
 const f=fixture(preserved);const response=await f.call(request(),admin,roles);
 assert.equal(response.status,undefined);assert.deepEqual(f.task.responsible,[{email:assignee,name:'New <script>',picture:'picture'}]);
 for(const key of Object.keys(preserved).filter(k=>!['responsible','history','_etag'].includes(k)))assert.deepEqual(f.task[key],preserved[key],key);
 assert.equal(f.task.history.length,2);assert.deepEqual(f.task.history[0],preserved.history[0]);assert.match(f.task.history[1].description,/admin@example.test/);assert.match(f.task.history[1].description,/New &lt;script&gt;/);
 assert.equal(f.writes.length,1);assert.equal(f.notices.length,0);assert.equal(f.discord.length,0);assert.equal(f.signals.length,1);assert.deepEqual(response.body,f.task);
 assert.equal((await f.call(request(),admin,roles)).status,409);assert.equal(f.writes.length,1);
}
for(const [actor,userRoles] of [[other,['travelcash_user']],[reviewer,['travelcash_user']],[admin,['admin']],[admin,['travelcash_user']],['revoked@example.test',roles],['missing@example.test',roles],[null,roles]]){
 const f=fixture();assert.equal((await f.call(request({actorEmail:admin,isAdmin:true}),actor,userRoles)).status,403);assert.equal(f.writes.length,0);
}
for(const responsible of [null,[],{},false,[{name:'No email'}],[{email:'bad'}],[{email:'missing@example.test'}],[{email:assignee},{email:' NEW@EXAMPLE.TEST '}]]){
 const f=fixture();assert.equal((await f.call(request({responsible}),admin,roles)).status,400);assert.equal(f.writes.length,0);
}
for(const status of ['todo','inprogress','stopped','publication','done']){
 const f=fixture({...base,status});assert.equal((await f.call(request(),admin,roles)).status,409);assert.equal(f.writes.length,0);
}
for(const expectedEtag of [undefined,null,'','v0']){const f=fixture();assert.equal((await f.call(request({expectedEtag}),admin,roles)).status,409);assert.equal(f.writes.length,0);}
for(const patch of [{status:'todo'},{status:'publication'},{homologador:null},{homologador:{email:admin}},{progress:100}]){
 const f=fixture();assert.equal((await f.call(request(patch),admin,roles)).status,403);assert.equal(f.writes.length,0);
}
{const f=fixture();assert.equal((await f.call(request({responsible:[{email:' NEW@EXAMPLE.TEST '},{email:reviewer}]}),admin,roles)).status,undefined);assert.deepEqual(f.task.responsible.map(u=>u.email),[assignee,reviewer]);}
{const f=fixture();const results=await Promise.all([f.call(request(),admin,roles),f.call(request({responsible:[{email:reviewer}]}),admin,roles)]);assert.equal(results.filter(r=>r.status===undefined).length,1);assert.equal(results.filter(r=>r.status===409).length,1);assert.equal(f.writes.length,1);assert.equal(f.signals.length,1);assert.equal(f.task.history.length,1);}
{const f=fixture();const results=await Promise.all([f.call(request(),admin,roles),f.call({homologationAction:'approve',expectedStatus:'homologation',expectedEtag:'v1'},reviewer)]);assert.equal(results.filter(r=>r.status===undefined).length,1);assert.equal(results.filter(r=>r.status===409).length,1);assert.equal(f.writes.length,1);assert.equal(f.task.history.length,1);}
for(const action of ['approve','reject','forward']){const f=fixture();assert.equal((await f.call({homologationAction:action,expectedStatus:'homologation',expectedEtag:'v1',newResponsibleEmail:assignee},admin,roles)).status,403);assert.equal(f.writes.length,0);}
{const f=fixture();f.failWrite=true;assert.equal((await f.call(request(),admin,roles)).status,500);assert.equal(f.writes.length,0);assert.equal(f.signals.length,0);f.failWrite=false;assert.equal((await f.call(request(),admin,roles)).status,undefined);}
{const f=fixture();f.loseResponse=true;assert.equal((await f.call(request(),admin,roles)).status,500);f.loseResponse=false;assert.equal((await f.call(request(),admin,roles)).status,409);assert.equal(f.writes.length,1);assert.equal(f.task.history.length,1);}
{const f=fixture(preserved);assert.equal((await f.call({expectedStatus:'homologation',expectedEtag:'v1',title:'Ordinary edit'},other)).status,undefined);assert.deepEqual(f.task.responsible,preserved.responsible);}
{const f=fixture();assert.equal((await f.call({responsible:[{email:assignee}]},admin,roles)).status,409);assert.equal(f.writes.length,0);}
console.log('PASS TC471 API: admin current profile, trusted roles, partial preservation, canonical profiles, invalid/duplicate assignees, phase/progress/reviewer protection, independent decision authority, ETag stale/races/retry, escaped audit, persisted response and zero false notifications.');
