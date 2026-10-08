// TC473: deterministic adversarial schedules against the real Cosmos handlers.
// All data and effects are isolated in memory; no credentials or live services.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const guard = require('../api/shared/reviewerGuard.js');
const reviewer = 'reviewer@example.test', admin = 'admin@example.test';
const taskId = 'TC473-fixture', renamed = 'renamed@example.test';
const copy = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const failure = code => Object.assign(new Error(`Cosmos ${code}`), {code});
const principal = {'x-ms-client-principal': Buffer.from(JSON.stringify({userDetails:admin,userRoles:['authenticated','travelcash_user','admin']})).toString('base64')};

function fixture({pins = false, recovery = false} = {}) {
    let version = 10;
    const profiles = new Map([
        [reviewer,{id:reviewer,email:reviewer,name:'Reviewer',_etag:'u1',homologationReservations:pins?[{taskId,taskEtag:'t1'}]:[]}],
        [admin,{id:admin,email:admin,name:'Admin',isAdmin:true,_etag:'a1'}]
    ]);
    const records = new Map([[taskId,{id:taskId,title:'Fixture',status:recovery?'homologation':'inprogress',homologador:null,history:[{description:'preserve'}],attachments:[{name:'preserve'}],_etag:'t1'}]]);
    const hooks = new Map(), events = [], notices = [];
    async function event(key, data) {
        events.push(key);
        const hook = hooks.get(key);
        if (hook) { hooks.delete(key); return await hook(data); }
    }
    function container(name, map) {
        return {
            item(id, partition) {
                assert.equal(id,partition);
                const check = options => {
                    const current = map.get(id);
                    if (!current) throw failure(404);
                    if (options?.accessCondition) {
                        assert.equal(options.accessCondition.type,'IfMatch');
                        if (options.accessCondition.condition !== current._etag) throw failure(412);
                    }
                    return current;
                };
                return {
                    async read(options) {
                        await event(`${name}.read.before`,{id,options});
                        const snapshot = copy(map.get(id));
                        const override = await event(`${name}.read.after`,{id,snapshot,options});
                        return {resource:override === undefined ? snapshot : override};
                    },
                    async patch(operations, options) {
                        await event(`${name}.patch.before`,{id,operations,options});
                        const current = check(options);
                        for (const op of operations) { assert.equal(op.op,'set'); current[op.path.slice(1)] = copy(op.value); }
                        current._etag = `v${++version}`;
                        const resource = copy(current);
                        await event(`${name}.patch.after`,{id,resource});
                        return {resource};
                    },
                    async replace(value, options) {
                        await event(`${name}.replace.before`,{id,value,options});
                        assert.ok(options?.accessCondition, 'Every guarded replace must be conditional');
                        check(options);
                        map.set(id,{...copy(value),_etag:`v${++version}`});
                        await event(`${name}.replace.after`,{id});
                        return {resource:copy(map.get(id))};
                    },
                    async delete(options) {
                        await event(`${name}.delete.before`,{id,options});
                        assert.ok(options?.accessCondition, 'Profile deletion must be conditional');
                        check(options); map.delete(id);
                        await event(`${name}.delete.after`,{id});
                    }
                };
            },
            items: {
                query(spec, options) { return {async fetchAll() {
                    await event(`${name}.query.before`,{spec,options});
                    const selected = spec.parameters[0].value;
                    if (name === 'Tasks') {
                        assert.equal(options.consistencyLevel,'Strong');
                        assert.equal(options.bypassIntegratedCache,true);
                        const normalize = value => {
                            let result = String(value || '');
                            if (/TRIM\(/i.test(spec.query)) result = result.trim();
                            if (/LOWER\(/i.test(spec.query)) result = result.toLowerCase();
                            return result;
                        };
                        return {resources:[...map.values()].filter(t => t.status === 'homologation' && normalize(t.homologador?.email || t.homologador) === selected).map(t=>({id:t.id}))};
                    }
                    return {resources:copy([...map.values()].filter(p=>p.email.toLowerCase()===selected))};
                }}; },
                async create(value) {
                    await event(`${name}.create.before`,{value});
                    if (map.has(value.id)) throw failure(409);
                    const resource = {...copy(value),_etag:`v${++version}`};
                    map.set(value.id,copy(resource));
                    await event(`${name}.create.after`,{resource:copy(resource)});
                    return {resource:copy(resource)};
                },
                async upsert() { assert.fail('Users upsert can resurrect or overwrite reservations'); }
            }
        };
    }
    const users=container('Users',profiles), tasks=container('Tasks',records);
    const containers={Users:users,Tasks:tasks,Notifications:{items:{async create(value){notices.push(copy(value));}}}};
    const handlers={};
    for (const name of ['updateTask','deleteUser','getRoles','updateUser']) {
        const module={exports:{}};
        vm.runInNewContext(readFileSync(new URL(`../api/${name}/index.js`,import.meta.url),'utf8'),{
            module,Buffer,console,process:{env:{}},require(spec) {
                if (spec==='@azure/cosmos') return {CosmosClient:class {database(){return {container:n=>containers[n]};}}};
                if (spec==='axios') return {post:async()=>assert.fail('No external HTTP')};
                if (spec==='crypto') return {randomUUID:()=>`notice-${notices.length}`};
                if (spec.startsWith('../shared/')) return require(`../api/shared/${spec.split('/').at(-1)}.js`);
                throw new Error(`Unexpected dependency ${spec}`);
            }
        });
        handlers[name]=module.exports;
    }
    async function call(name, body, id=reviewer) {
        const log=()=>{}; log.error=()=>{}; log.warn=()=>{};
        const context={bindingData:{id},bindings:{},log};
        await handlers[name](context,{headers:principal,body});
        return copy(context.res);
    }
    return {
        profiles,records,users,tasks,events,notices,call,
        once:(key,hook)=>hooks.set(key,hook),
        assign:()=>call('updateTask',recovery?{homologationRecovery:true,homologador:reviewer,expectedStatus:'homologation',expectedEtag:'t1'}:{status:'homologation',homologador:reviewer,expectedStatus:'inprogress',expectedEtag:'t1'},taskId),
        remove:()=>call('deleteUser',undefined),
        login:()=>call('getRoles',{userDetails:reviewer,claims:[{typ:'name',val:'Updated Name'}]}),
        edit:(email=reviewer)=>call('updateUser',{email,displayName:'Edited',role:'Tester',isAdmin:false}),
        assertSafe() {
            const task=records.get(taskId);
            if(task?.status==='homologation' && task.homologador) assert.ok(profiles.has(task.homologador.email || task.homologador),'An assigned reviewer must exist');
        }
    };
}
let count=0;
async function test(name,run) { await run(); count++; console.log(`PASS ${name}`); }
const conflict = error => error.httpStatus === 409;

for (const recovery of [false,true]) {
    const mode=recovery?'recovery':'entry';
    await test(`${mode}: deletion wins after durable reservation, fences suspended replace`,async()=>{
        const f=fixture({recovery});
        f.once('Tasks.replace.before',async()=>assert.equal((await f.remove()).status,204));
        assert.equal((await f.assign()).status,409);
        assert.equal(f.profiles.has(reviewer),false); assert.equal(f.notices.length,0); f.assertSafe();
    });
    await test(`${mode}: assignment wins, pending reviewer deletion is blocked`,async()=>{
        const f=fixture({recovery,pins:true});
        f.once('Tasks.replace.before',async()=>assert.equal((await f.assign()).status,undefined));
        assert.equal((await f.remove()).status,409); f.assertSafe();
        assert.equal(f.notices.length,1);
    });
    await test(`${mode}: deletion before reservation cannot leave an assignment`,async()=>{
        const f=fixture({recovery});
        f.once('Users.replace.before',async()=>assert.equal((await f.remove()).status,204));
        assert.equal((await f.assign()).status,409); assert.equal(f.notices.length,0); f.assertSafe();
    });
}
await test('Reservation response lost after commit: retry reuses durable pin',async()=>{
    const f=fixture(); f.once('Users.replace.after',()=>{throw failure(503);});
    assert.equal((await f.assign()).status,500);
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,1);
    assert.equal((await f.assign()).status,undefined);
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,1); f.assertSafe();
});
await test('Fence response lost after commit: safe retry and no task payload changes',async()=>{
    const f=fixture({pins:true}), original=copy(f.records.get(taskId));
    f.once('Tasks.replace.after',()=>{throw failure(503);});
    assert.equal((await f.remove()).status,500); assert.ok(f.profiles.has(reviewer));
    assert.notEqual(f.records.get(taskId)._etag,original._etag);
    assert.equal((await f.remove()).status,204);
    const actual=copy(f.records.get(taskId)); delete actual._etag; delete original._etag;
    assert.deepEqual(actual,original);
});
for(const absent of ['missing','missing-etag','stale']) await test(`Reserved task ${absent} fails closed`,async()=>{
    const f=fixture({pins:true});
    f.once('Tasks.read.after',({snapshot})=>{
        if(absent==='missing') return null;
        if(absent==='missing-etag') {delete snapshot._etag; return snapshot;}
        f.records.get(taskId)._etag='newer'; return snapshot;
    });
    assert.equal((await f.remove()).status,409); assert.ok(f.profiles.has(reviewer));
});
await test('Strong 404 releases a deleted task reservation without resurrecting it',async()=>{
    const f=fixture({pins:true}), snapshot=copy(f.records.get(taskId));
    f.once('Tasks.read.before',({options})=>{
        assert.equal(options.consistencyLevel,'Strong'); assert.equal(options.bypassIntegratedCache,true);
        f.records.delete(taskId); throw failure(404);
    });
    assert.equal((await f.remove()).status,204);
    await assert.rejects(f.tasks.item(taskId,taskId).replace({...snapshot,status:'homologation',homologador:reviewer},{accessCondition:{type:'IfMatch',condition:snapshot._etag}}),e=>e.code===404);
    assert.equal(f.records.has(taskId),false);
});
for(const code of [400,503]) await test(`Strong task read error ${code} cannot authorize deletion`,async()=>{
    const f=fixture({pins:true}); f.once('Tasks.read.before',({options})=>{
        assert.equal(options.consistencyLevel,'Strong'); assert.equal(options.bypassIntegratedCache,true); throw failure(code);
    });
    assert.equal((await f.remove()).status,500); assert.ok(f.profiles.has(reviewer));
});
await test('404 from fence replace is a conflict, not proof of safe removal',async()=>{
    const f=fixture({pins:true}); f.once('Tasks.replace.before',()=>{throw failure(404);});
    assert.equal((await f.remove()).status,409); assert.ok(f.profiles.has(reviewer));
});
await test('Strong legacy query unavailable prevents deletion and rename',async()=>{
    for(const action of ['remove','edit']) {
        const f=fixture(); f.once('Tasks.query.before',()=>{throw failure(400);});
        assert.equal((await (action==='remove'?f.remove():f.edit(renamed))).status,409);
        assert.ok(f.profiles.has(reviewer)); assert.equal(f.profiles.has(renamed),false);
    }
});
await test('Legacy pending task without reservations blocks removal',async()=>{
    const f=fixture(); Object.assign(f.records.get(taskId),{status:'homologation',homologador:{email:reviewer}});
    assert.equal((await f.remove()).status,409); f.assertSafe();
});
await test('New reservation after removal snapshot invalidates Users final delete',async()=>{
    const f=fixture();
    f.once('Users.delete.before',async()=>{await guard.reserveReviewer(f.users,f.records.get(taskId),reviewer);});
    assert.equal((await f.remove()).status,409); assert.ok(f.profiles.has(reviewer));
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,1);
});
await test('Login field patch preserves a reservation appended after login read',async()=>{
    const f=fixture(); f.once('Users.patch.before',async()=>{await guard.reserveReviewer(f.users,f.records.get(taskId),reviewer);});
    const response=await f.login(); assert.equal(response.status,undefined);
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,1);
    assert.equal(f.profiles.get(reviewer).name,'Updated Name');
});
await test('Login cannot resurrect profile deleted after login read',async()=>{
    const f=fixture(); f.once('Users.patch.before',async()=>assert.equal((await f.remove()).status,204));
    const response=await f.login(); assert.equal(response.status,500);
    assert.deepEqual(response.body.roles,['authenticated']); assert.equal(f.profiles.has(reviewer),false);
});
await test('Same-email edit preserves a concurrently appended reservation',async()=>{
    const f=fixture(); f.once('Users.patch.before',async()=>{await guard.reserveReviewer(f.users,f.records.get(taskId),reviewer);});
    assert.equal((await f.edit()).status,undefined);
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,1);
    assert.equal(f.profiles.get(reviewer).displayName,'Edited');
});
for (const changeDestination of [false,true]) await test(`Rename stale source rollback ${changeDestination?'preserves independently edited destination':'removes exact created destination'}`,async()=>{
    const f=fixture();
    f.once('Users.create.after',async()=>{
        await guard.reserveReviewer(f.users,f.records.get(taskId),reviewer);
        if(changeDestination) await f.users.item(renamed,renamed).patch([{op:'set',path:'/displayName',value:'Independent edit'}]);
    });
    const response=await f.edit(renamed);
    assert.equal(response.status,409); assert.ok(f.profiles.has(reviewer));
    if(changeDestination) assert.match(response.body,/preservados/);
    assert.equal(f.profiles.has(renamed),changeDestination);
    if(changeDestination) assert.equal(f.profiles.get(renamed).displayName,'Independent edit');
});
await test('Rename destination conflict never removes existing destination or source',async()=>{
    const f=fixture(); const original={id:renamed,email:renamed,_etag:'existing',name:'Other'}; f.profiles.set(renamed,copy(original));
    assert.equal((await f.edit(renamed)).status,409); assert.ok(f.profiles.has(reviewer)); assert.deepEqual(f.profiles.get(renamed),original);
});
await test('Rename rejects a profile changed between initial read and removal preflight',async()=>{
    const f=fixture();
    f.once('Users.read.after',async()=>{
        await f.users.item(reviewer,reviewer).patch([
            {op:'set',path:'/name',value:'Concurrent Name'},
            {op:'set',path:'/picture',value:'concurrent-picture'},
            {op:'set',path:'/isAiAgent',value:true}
        ]);
    });
    const response=await f.edit(renamed);
    assert.equal(response.status,409); assert.match(response.body,/mudou/);
    assert.equal(f.profiles.has(renamed),false);
    assert.equal(f.events.includes('Users.create.before'),false);
    assert.equal(f.profiles.get(reviewer).name,'Concurrent Name');
    assert.equal(f.profiles.get(reviewer).picture,'concurrent-picture');
    assert.equal(f.profiles.get(reviewer).isAiAgent,true);
});
await test('Rename source delete committed with lost response preserves destination',async()=>{
    const f=fixture(); f.once('Users.delete.after',()=>{throw failure(503);});
    const response=await f.edit(renamed);
    assert.equal(response.status,409); assert.match(response.body,/confirmar.*remoção/);
    assert.match(response.body,/novo cadastro foi preservado/);
    assert.equal(f.profiles.has(reviewer),false);
    assert.equal(f.profiles.has(renamed),true);
    assert.equal(f.profiles.get(renamed).name,'Reviewer');
    assert.equal(f.events.filter(e=>e==='Users.delete.before').length,1,'No compensating destination delete after uncertain source outcome');
});
await test('Rename destination create committed with lost response preserves both profiles',async()=>{
    const f=fixture(); f.once('Users.create.after',()=>{throw failure(503);});
    const response=await f.edit(renamed);
    assert.equal(response.status,409); assert.match(response.body,/confirmar.*criação/);
    assert.match(response.body,/antigo foi preservado/);
    assert.ok(f.profiles.has(reviewer)); assert.ok(f.profiles.has(renamed));
    assert.equal(f.events.includes('Users.delete.before'),false,'Uncertain create cannot authorize either profile deletion');
});
await test('Successful fence invalidates the pinned snapshot even without a handler',async()=>{
    const f=fixture({pins:true}), snapshot=copy(f.records.get(taskId));
    await guard.deleteReviewer(f.users,f.tasks,reviewer);
    await assert.rejects(f.tasks.item(taskId,taskId).replace({...snapshot,status:'homologation',homologador:reviewer},{accessCondition:{type:'IfMatch',condition:snapshot._etag}}),e=>e.code===412);
    f.assertSafe();
});
await test('Existing pin retry remains fenced when deletion wins after the profile read',async()=>{
    const f=fixture({pins:true}), snapshot=copy(f.records.get(taskId));
    f.once('Users.read.after',async()=>{await guard.deleteReviewer(f.users,f.tasks,reviewer);});
    // Even identical-token reuse must conditionally touch the profile.
    await assert.rejects(guard.reserveReviewer(f.users,snapshot,reviewer),conflict);
    await assert.rejects(f.tasks.item(taskId,taskId).replace({...snapshot,status:'homologation',homologador:reviewer},{accessCondition:{type:'IfMatch',condition:snapshot._etag}}),e=>e.code===412);
    f.assertSafe();
});
await test('Competing reservation invalidates stale Users append and preserves first pin',async()=>{
    const f=fixture(), snapshot=copy(f.records.get(taskId));
    f.once('Users.replace.before',async()=>{await guard.reserveReviewer(f.users,{id:'other-task',_etag:'other-etag'},reviewer);});
    await assert.rejects(guard.reserveReviewer(f.users,snapshot,reviewer),conflict);
    assert.deepEqual(f.profiles.get(reviewer).homologationReservations,[{taskId:'other-task',taskEtag:'other-etag'}]);
    await guard.reserveReviewer(f.users,snapshot,reviewer);
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,2);
});
await test('Same-email edit cannot resurrect a deleted profile',async()=>{
    const f=fixture(); f.once('Users.patch.before',async()=>assert.equal((await f.remove()).status,204));
    assert.equal((await f.edit()).status,500); assert.equal(f.profiles.has(reviewer),false);
});
await test('Repeated identical-token reservations each advance profile CAS without growing pins',async()=>{
    const f=fixture({pins:true}), snapshot=copy(f.records.get(taskId));
    let etag=f.profiles.get(reviewer)._etag;
    for(let attempt=0;attempt<3;attempt++) {
        await guard.reserveReviewer(f.users,snapshot,reviewer);
        assert.notEqual(f.profiles.get(reviewer)._etag,etag);
        etag=f.profiles.get(reviewer)._etag;
        assert.deepEqual(f.profiles.get(reviewer).homologationReservations,[{taskId,taskEtag:'t1'}]);
    }
    assert.equal(f.events.filter(e=>e==='Users.replace.after').length,3);
});
await test('Older attempt may replace newer pin but task ID fencing protects both snapshots',async()=>{
    const f=fixture(), oldSnapshot=copy(f.records.get(taskId));
    f.records.get(taskId)._etag='t2'; const newSnapshot=copy(f.records.get(taskId));
    await guard.reserveReviewer(f.users,newSnapshot,reviewer);
    await guard.reserveReviewer(f.users,oldSnapshot,reviewer);
    assert.deepEqual(f.profiles.get(reviewer).homologationReservations,[{taskId,taskEtag:'t1'}]);
    assert.equal((await f.remove()).status,204);
    for(const snapshot of [oldSnapshot,newSnapshot]) {
        await assert.rejects(f.tasks.item(taskId,taskId).replace({...snapshot,status:'homologation',homologador:reviewer},{accessCondition:{type:'IfMatch',condition:snapshot._etag}}),e=>e.code===412);
    }
    f.assertSafe();
});
for(const value of [' REVIEWER@EXAMPLE.TEST ',{email:' REVIEWER@EXAMPLE.TEST '}]) await test(`Legacy ${typeof value} reviewer normalization blocks removal without pins`,async()=>{
    const f=fixture(); Object.assign(f.records.get(taskId),{status:'homologation',homologador:value});
    let actualQuery;
    f.once('Tasks.query.before',({spec})=>{actualQuery=spec.query;});
    assert.equal((await f.remove()).status,409); assert.ok(f.profiles.has(reviewer));
    assert.match(actualQuery,/LOWER\(TRIM\(c\.homologador\.email\)\)/i);
    assert.match(actualQuery,/LOWER\(TRIM\(c\.homologador\)\)/i);
});
await test('Missing reservation token and capacity overflow fail closed',async()=>{
    const f=fixture(); await assert.rejects(guard.reserveReviewer(f.users,{id:taskId},reviewer),conflict);
    f.profiles.get(reviewer).homologationReservations=Array.from({length:4096},(_,i)=>({taskId:`other-${i}`,taskEtag:'x'}));
    await assert.rejects(guard.reserveReviewer(f.users,f.records.get(taskId),reviewer),conflict);
    assert.equal(f.profiles.get(reviewer).homologationReservations.length,4096);
});
await test('Omitted AI flag preserves a concurrent profile update',async()=>{
    const f=fixture(); f.profiles.get(reviewer).isAiAgent=false;
    f.once('Users.patch.before',()=>{f.profiles.get(reviewer).isAiAgent=true;f.profiles.get(reviewer)._etag='new-ai-flag';});
    const response=await f.edit();
    assert.equal(response.status,undefined); assert.equal(response.body.isAiAgent,true);
    assert.equal(f.profiles.get(reviewer).isAiAgent,true);
});
console.log(`PASS TC473 reviewer coordination: ${count} adversarial scenarios against real handlers/shared helper.`);
