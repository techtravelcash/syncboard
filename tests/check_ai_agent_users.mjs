// TC-459: execute real API handlers against isolated in-memory Cosmos fixtures.
// No production identities, network requests or records are touched.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const clone = x => JSON.parse(JSON.stringify(x));
function fixture(handler, initial = []) {
    const records = new Map(initial.map(x => [x.id, clone({...x,_etag:x._etag||'u1'})]));
    const writes=[];
    const container={items:{
        async create(value){value={...value,_etag:'created-v1'};assert.ok(!records.has(value.id));records.set(value.id,clone(value));writes.push(['create',clone(value)]);return {resource:clone(value)};},
        async upsert(value){records.set(value.id,clone(value));writes.push(['upsert',clone(value)]);},
        readAll(){return {async fetchAll(){return {resources:[...records.values()].map(clone)};}}}
    },item(id,partition){assert.equal(id,partition);return {
        async read(){return {resource:records.has(id)?clone(records.get(id)):undefined};},
        async replace(value){records.set(id,clone(value));writes.push(['replace',clone(value)]);return {resource:clone(value)};},
        async patch(operations){const value=records.get(id);assert.ok(value);for(const operation of operations)value[operation.path.slice(1)]=clone(operation.value);value._etag+='x';writes.push(['patch',clone(value)]);return {resource:clone(value)};},
        async delete(options){if(options?.accessCondition)assert.equal(options.accessCondition.condition,records.get(id)._etag);records.delete(id);writes.push(['delete',id]);}
    };}};
    const module={exports:{}};
    const CosmosClient=class {database(){return {container:name=>name==='Tasks'?{items:{query(spec,options){assert.equal(options.consistencyLevel,'Strong');return {async fetchAll(){return {resources:[]};}};}}}:container};}};
    vm.runInNewContext(read(`api/${handler}/index.js`),{module,require:name=>{if(name==='../shared/reviewerGuard')return require('../api/shared/reviewerGuard.js');assert.equal(name,'@azure/cosmos');return {CosmosClient};},process:{env:{}},Buffer});
    async function call(body,roles=['admin'],id='fixture@example.test') {
        const log=()=>{};log.error=()=>{};log.warn=()=>{};
        const context={bindingData:{id},log};
        const headers=roles===null?{}:{'x-ms-client-principal':Buffer.from(JSON.stringify({userRoles:roles,userDetails:'operator@example.test'})).toString('base64')};
        await module.exports(context,{headers,body});return clone(context.res);
    }
    return {records,writes,call};
}
const base={id:'fixture@example.test',email:'fixture@example.test',displayName:'Fixture',name:'Original',role:'QA',isAdmin:false,picture:''};
for(const isAdmin of [false,true]) for(const flag of [undefined,false,true,'true',1,null]) {
    const f=fixture('addUser');const body={email:base.email,displayName:base.displayName,isAdmin};
    if(flag!==undefined)body.isAiAgent=flag;
    const response=await f.call(body);
    assert.equal(response.body.isAiAgent,flag===true);assert.equal(response.body.isAdmin,isAdmin);
    assert.equal(f.records.get(base.id).isAiAgent,flag===true);
}
let cases=0;
for(const previous of [undefined,false,true])for(const next of [undefined,false,true,'true',null])for(const changeEmail of [false,true])for(const isAdmin of [false,true]) {
    const profile={...base};if(previous!==undefined)profile.isAiAgent=previous;
    const f=fixture('updateUser',[profile]);const body={...base,isAdmin,email:changeEmail?'renamed@example.test':base.email};
    if(next!==undefined)body.isAiAgent=next;
    const response=await f.call(body);assert.equal(response.status,undefined);
    const expected=next===undefined?previous===true:next===true;
    const expectedStored = next === undefined && !changeEmail ? previous : expected;
    assert.equal(response.body.isAiAgent,expectedStored);assert.equal(response.body.isAdmin,isAdmin);
    assert.equal(f.records.size,1);assert.equal(f.records.get(body.email).isAiAgent,expectedStored);
    assert.equal(f.records.get(body.email).name,'Original');cases++;
}
for(const handler of ['addUser','updateUser'])for(const roles of [null,[],['authenticated'],['travelcash_user']]) {
    const f=fixture(handler,[base]);const response=await f.call({...base,isAiAgent:true},roles);
    assert.equal(response.status,403);assert.equal(f.writes.length,0);
}
for(const flag of [false,true])for(const isAdmin of [false,true]) {
    const f=fixture('getRoles',[{...base,isAiAgent:flag,isAdmin}]);
    const response=await f.call({userDetails:base.email,claims:[]});
    assert.deepEqual(response.body.roles,isAdmin?['authenticated','travelcash_user','admin']:['authenticated','travelcash_user']);
    assert.equal(f.records.get(base.id).isAiAgent,flag);
}
const helpers=await import('data:text/javascript;base64,'+Buffer.from(read('app/js/people-v2.js')).toString('base64'));
for(const flag of [undefined,false,true,'true',1,null])for(const isAdmin of [false,true]){
    const card=helpers.personCard({...base,isAiAgent:flag,isAdmin},0);
    assert.equal(card.includes('Agente IA'),flag===true);
    assert.equal(card.includes('Administrador do sistema'),isAdmin);
}
const ui=read('app/js/ui.js');
assert.match(ui,/<label for="newUserIsAiAgent"><input type="checkbox" id="newUserIsAiAgent" aria-describedby="user-ai-agent-help"><span>Agente IA<\/span><\/label>/);
assert.match(ui,/id="user-ai-agent-help"/);
console.log(`PASS TC-459: create strict boolean defaults; ${cases} update combinations including rename/omission/unmark; admin-only writes; auth-role independence; literal badge and accessible checkbox. Mock API only.`);
