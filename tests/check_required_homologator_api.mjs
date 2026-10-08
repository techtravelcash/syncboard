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

const admin='admin@example.test', roles=['travelcash_user','admin'];
const recovery=(extra={})=>({homologationRecovery:true,homologador:{email:reviewer,name:'Forged'},expectedStatus:'homologation',expectedEtag:'v1',...extra});
const entry=(extra={})=>({status:'homologation',homologador:{email:reviewer,name:'Forged'},expectedStatus:'inprogress',expectedEtag:'v1',...extra});
for(const homologador of [undefined,null,'',{},'bad',{email:'bad'},'removed@example.test']) {
 const f=fixture({...base,status:'inprogress'});assert.equal((await f.call(entry({homologador}))).status,400);assert.equal(f.writes.length,0);assert.equal(f.notices.length,0);
}
for(const status of ['todo','stopped','inprogress','publication','done']) {
 const f=fixture({...base,status});assert.equal((await f.call(entry({expectedStatus:status,homologador:{email:' REVIEWER@EXAMPLE.TEST ',name:'Forged',isAdmin:true}}))).status,undefined);
 assert.deepEqual(f.task.homologador,{email:reviewer,name:'Reviewer',picture:''});assert.equal(f.task.status,'homologation');assert.equal(f.notices.length,1);
}
for(const extra of [{expectedEtag:undefined},{expectedEtag:'old'},{expectedStatus:'todo'}]) {const f=fixture({...base,status:'inprogress'});assert.equal((await f.call(entry(extra))).status,409);assert.equal(f.writes.length,0);}
for(const homologador of [null,{},'bad',{email:'removed@example.test'}]) {
 const original={...base,homologador,description:'keep',attachments:[{name:'keep'}],history:[{description:'prior'}],comments:[{text:'keep'}]};const f=fixture(original);
 assert.equal((await f.call(recovery(),admin,roles)).status,undefined);
 for(const key of Object.keys(original).filter(k=>!['homologador','history','_etag'].includes(k)))assert.deepEqual(f.task[key],original[key],key);
 assert.equal(f.task.history.length,2);assert.match(f.task.history[1].description,/recuperado por administrador/);assert.deepEqual(f.task.history[0],original.history[0]);assert.equal(f.notices.length,1);assert.equal(f.discord.length,0);
 assert.equal((await f.call(recovery({expectedEtag:f.task._etag}),admin,roles)).status,409);assert.equal(f.writes.length,1);
}
for(const [actor,userRoles] of [[other,['travelcash_user']],[admin,['travelcash_user']],['revoked@example.test',roles],[null,roles]]) {const f=fixture({...base,homologador:null});assert.equal((await f.call(recovery(),actor,userRoles)).status,403);assert.equal(f.writes.length,0);}
for(const extra of [{progress:100},{status:'publication'},{responsible:[]},{history:[]},{homologationAction:'approve'},{actorEmail:admin},{homologationRecovery:false}]) {const f=fixture({...base,homologador:null});assert.equal((await f.call(recovery(extra),admin,roles)).status,400);assert.equal(f.writes.length,0);}
for(const homologador of [null,'bad',{email:'removed@example.test'}]) {const f=fixture({...base,homologador:null});assert.equal((await f.call(recovery({homologador}),admin,roles)).status,400);assert.equal(f.writes.length,0);}
{const f=fixture();assert.equal((await f.call(recovery(),admin,roles)).status,409);assert.equal(f.writes.length,0);}
{const f=fixture({...base,homologador:null});assert.equal((await f.call({homologador:{email:reviewer}},admin,roles)).status,403);assert.equal((await f.call({title:'generic edit'},admin,roles)).status,400);assert.equal(f.writes.length,0);}
for(const expectedEtag of [undefined,'old']) {const f=fixture({...base,homologador:null});assert.equal((await f.call(recovery({expectedEtag}),admin,roles)).status,409);assert.equal(f.writes.length,0);}
{const f=fixture({...base,homologador:null});const out=await Promise.all([f.call(recovery(),admin,roles),f.call(recovery({homologador:{email:other}}),admin,roles)]);assert.equal(out.filter(r=>r.status===undefined).length,1);assert.equal(out.filter(r=>r.status===409).length,1);assert.equal(f.writes.length,1);assert.equal(f.notices.length,1);}
{const f=fixture({...base,status:'inprogress'});const out=await Promise.all([f.call(entry()),f.call(entry({homologador:{email:other}}))]);assert.equal(out.filter(r=>r.status===undefined).length,1);assert.equal(out.filter(r=>r.status===409).length,1);assert.equal(f.writes.length,1);}
for(const action of ['approve','reject','forward']) {const f=fixture({...base,homologador:null});await f.call(recovery(),admin,roles);assert.equal((await f.call({homologationAction:action,expectedStatus:'homologation',expectedEtag:f.task._etag,newResponsibleEmail:other},admin,roles)).status,403);assert.equal(f.writes.length,1);}
{const f=fixture({...base,homologador:{email:'removed@example.test'}});assert.equal((await f.call({homologationAction:'approve',expectedStatus:'homologation',expectedEtag:'v1'},'removed@example.test')).status,403);assert.equal(f.writes.length,0);}
console.log('PASS TC473 API: required registered reviewer, canonical selection, all entry statuses, removed profiles, forged payloads, isolated admin recovery, preservation, ETag races and reviewer-only decisions.');
