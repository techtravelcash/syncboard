// TC-452: execute real renderers and callbacks in synthetic DOM/API fixtures only.
// This is not browser layout, permission, delivery, SSO or backend validation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('app/js/ui.js'), main = read('app/js/main.js');
const helpers = await import('data:text/javascript;base64,' + Buffer.from(read('app/js/people-v2.js')).toString('base64'));
const {personCard, notificationCard, peopleAvatar, escapePeopleText} = helpers;
const checks=[];
const decode = value => String(value).replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&gt;/g,'>').replace(/&lt;/g,'<').replace(/&amp;/g,'&');
function element(classes='') {
    const set = new Set(classes.split(/\s+/).filter(Boolean));
    return {style:{}, dataset:{}, attrs:{}, textContent:'', innerHTML:'', value:'', checked:false, disabled:false, listeners:{},
        classList:{add(...v){v.forEach(x=>set.add(x));},remove(...v){v.forEach(x=>set.delete(x));},contains:v=>set.has(v),toggle(v,on){if(on ?? !set.has(v))set.add(v);else set.delete(v);}},
        setAttribute(k,v){this.attrs[k]=v;}, addEventListener(type,fn){(this.listeners[type] ||= []).push(fn);},
        async fire(type,event={}){for(const fn of this.listeners[type] || [])await fn(event);},
        async click(event={}){if(this.disabled)return;await this.fire('click',event);if(this.onclick)await this.onclick(event);},
        cloneNode(){const copy=element([...set].join(' '));copy.innerHTML=this.innerHTML;copy.disabled=this.disabled;return copy;},
        querySelector(){return this.child ||= element();}
    };
}
function fixture(ids=[]) {
    const els=Object.fromEntries(ids.map(id=>[id,element()]));const timers=[];
    const doc={getElementById:id=>els[id] || null,querySelectorAll:()=>[],documentElement:element()};
    const context={document:doc,state:{users:[],tasks:[]},...helpers,console:{error(){}},lucide:{createIcons(){}},window:{lucide:true},
        requestAnimationFrame:fn=>fn(),setTimeout(fn){timers.push(fn);return timers.length;},Promise};
    for(const id of ids)els[id].parentNode={replaceChild(next){els[id]=next;next.parentNode=this;}};
    return {els,doc,context,timers,flush(){while(timers.length)timers.shift()();}};
}
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert.ok(a>=0&&b>a,`Missing ${start}`);return text.slice(a,b);}
const stateCopy = x => JSON.parse(JSON.stringify(x));
// Literal data is presented intact, with no remote avatar invented for missing photos.
const longName='Ana de Teste com um Nome Muito Comprido & "Válido" <literal>';
const user={id:'fixture-1',name:'Ana',displayName:longName,email:'long-address-for-fixture@example.test',role:'Coordenação <literal>',isAdmin:true};
const card=personCard(user,2);
assert.ok(card.includes('Cargo: Coordenação &lt;literal&gt;'));
assert.ok(card.includes(escapePeopleText(longName)));
assert.ok(card.includes('Administrador do sistema'));
assert.ok(card.includes('data-user-email="long-address-for-fixture@example.test"'));
assert.ok(card.includes('data-user-id="fixture-1"'));
assert.ok(card.includes('sb-person-initial'));
assert.ok(!card.includes('<img'));
assert.ok(!personCard({...user,isAdmin:false},0).includes('Administrador do sistema'));
assert.ok(!peopleAvatar('','').includes('http'));
assert.ok(peopleAvatar('Ana','https://fixture.invalid/image?x="quoted"').includes('&quot;quoted&quot;'));
assert.ok(notificationCard({id:'n',taskId:'T',isRead:true,message:'<event>',commentPreview:null},'Hoje').includes('Lida'));
assert.ok(!notificationCard({id:'n',taskId:'T',isRead:false,message:'<event>',commentPreview:null},'Hoje').includes('undefined'));
for(const value of [undefined,null,'',0,'name & \"quoted\"']) {
    assert.ok(notificationCard({id:value,taskId:value},'').includes(`data-task-id="${escapePeopleText(String(value))}"`));
    assert.ok(personCard({email:value},0).includes(`data-user-email="${escapePeopleText(String(value))}"`));
}
assert.ok(personCard({email:'unnamed@example.test'},0).includes('unnamed@example.test'));
assert.ok(personCard({},0).includes('Nome não informado'));
checks.push('Pure renderers: full names, roles, emails, literal escaping, missing photos and distinct read states');
// Run the actual people renderer, including filtering and count semantics.
{
    const f=fixture(['userManagementView','userSearchInput','no-users-found']);
    const cards=[element(),element()];cards[0].textContent='Ana exemplo@example.test';cards[1].textContent='Bia outro@example.test';
    f.doc.querySelectorAll=selector=>selector==='.user-card-item'?cards:[];
    f.context.state.users=[{...user},{name:'DEFINIR',email:'system@example.test'},{name:'Bia',email:'other@example.test'}];
    f.context.state.tasks=[{id:'a',status:'todo',responsible:['Ana']},{id:'b',status:'publication',responsible:[{name:'Ana'}]},{id:'c',status:'done',responsible:['Ana']}];
    const before=stateCopy(f.context.state);
    vm.runInNewContext(section(source,'export function renderUserManagementView()','// --- ROTEADOR UI').replace('export function','function'),f.context);
    f.context.renderUserManagementView();
    assert.ok(!f.els.userManagementView.innerHTML.includes('system@example.test'));
    assert.ok(f.els.userManagementView.innerHTML.includes('<strong>2</strong>'));
    assert.ok(f.els.userManagementView.innerHTML.indexOf('long-address-for-fixture')<f.els.userManagementView.innerHTML.indexOf('other@example.test'));
    await f.els.userSearchInput.fire('input',{target:{value:' ANA '}});
    assert.equal(cards[0].style.display,'flex');assert.equal(cards[1].style.display,'none');
    await f.els.userSearchInput.fire('input',{target:{value:'missing'}});assert.ok(f.els['no-users-found'].classList.contains('flex'));
    await f.els.userSearchInput.fire('input',{target:{value:''}});assert.ok(f.els['no-users-found'].classList.contains('hidden'));
    assert.deepEqual(stateCopy(f.context.state),before);
    f.context.state.users=[];f.context.renderUserManagementView();assert.ok(f.els.userManagementView.innerHTML.includes('Nenhum membro disponível'));
    checks.push('Actual people renderer: system exclusion, name sort, task counts, search/no match/reset, empty data and no state mutation');
}
// The real delegated admin form callbacks, with all writes replaced by in-memory mocks.
{
    const f=fixture(['main-content','addUserForm','editUserId','user-form-title','user-form-subtitle','submitUserBtn','userFormModal','userFormModalContent','newUserName','newUserEmail','newUserRole','newUserIsAdmin']);
    f.context.state.users=[user];const calls=[];
    f.els.addUserForm.reset=()=>{for(const id of ['editUserId','newUserName','newUserEmail','newUserRole'])f.els[id].value='';f.els.newUserIsAdmin.checked=false;};
    f.context.ui={showToast:(text,type)=>calls.push(['toast',type]),renderUserManagementView:()=>calls.push(['render']),showDestructiveConfirmModal:()=>calls.push(['confirm'])};
    f.context.api={updateUser:async(id,payload)=>calls.push(['update',id,stateCopy(payload)]),addUser:async payload=>calls.push(['add',stateCopy(payload)]),fetchUsers:async()=>[user]};
    f.context.updateUserProfileUI=()=>calls.push(['profile']);
    const adminBody=section(main,'        // 1. ABRIR MODAL: NOVO MEMBRO','    // ==========================================\n    // DELEGAÇÃO DO SUBMIT');
    vm.runInNewContext('async function adminClick(e) {'+adminBody.slice(0,adminBody.lastIndexOf('    });'))+'}',f.context);
    const trigger=selector=>({stopPropagation(){},target:{closest:s=>s===selector?{dataset:{userEmail:user.email}}:null}});
    await f.context.adminClick(trigger('.edit-user-btn'));
    assert.equal(f.els.newUserName.value,longName);assert.equal(f.els.newUserEmail.value,user.email);assert.equal(f.els.newUserRole.value,user.role);assert.equal(f.els.newUserIsAdmin.checked,true);
    await f.context.adminClick(trigger('.close-user-modal'));f.flush();assert.ok(f.els.userFormModal.classList.contains('hidden'));assert.equal(calls.length,0);
    await f.context.adminClick(trigger('#openNewUserModalBtn'));assert.equal(f.els.editUserId.value,'');assert.equal(f.els.newUserIsAdmin.checked,false);
    await f.context.adminClick(trigger('.edit-user-btn'));
    vm.runInNewContext(section(main,"    document.getElementById('main-content').addEventListener('submit'","    const fileInput = document.getElementById('task-attachment-input');"),f.context);
    await f.els['main-content'].fire('submit',{target:{id:'addUserForm'},preventDefault(){}});
    assert.deepEqual(calls.find(c=>c[0]==='update'),['update','fixture-1',{displayName:longName,email:user.email,role:user.role,isAdmin:true}]);
    checks.push('Actual admin callbacks: edit fields, cancel without writes, new form reset and exact update payload (mock only)');
}
// Preserve profile resolution and the existing photo persistence callback (mock only).
for(const role of ['member','admin'])for(const photo of [null,'https://fixture.invalid/avatar.png']){
    const f=fixture(['user-name-display','user-role-display','user-avatar-menu','orb-avatar-container']);const calls=[];
    f.context.state={users:[user],currentUser:{userDetails:user.email,userRoles:[role],claims:photo?[{typ:'picture',val:photo}]:[]}};
    f.context.api={updateUserPhoto(url){calls.push(url);return Promise.resolve();}};
    vm.runInNewContext(section(main,'function updateUserProfileUI()','// --- DRAG AND DROP'),f.context);f.context.updateUserProfileUI();
    assert.equal(f.els['user-name-display'].textContent,longName);assert.equal(f.els['user-role-display'].textContent,user.role);
    assert.equal(f.els['user-avatar-menu'].innerHTML,f.els['orb-avatar-container'].innerHTML);
    assert.deepEqual(calls,photo?[photo]:[]);
}
checks.push('Actual profile callback: admin/member, same DB resolution, provider photo persistence call parity, missing photo fallback');
// Notification callbacks. Synthetic DOM parsing preserves dataset values and class-based read hook.
async function notificationFixture(notifs,tasks=[]){
    const f=fixture(['notification-badge-orb','orb-notif-count','notification-orb-badge','orb-avatar-container','modal-notifications-list','notificationsModal']);
    f.context.state.tasks=tasks;const calls=[];let nodes=[];
    const list=f.els['modal-notifications-list'];let html='';
    Object.defineProperty(list,'innerHTML',{get:()=>html,set(value){html=value;nodes=[...value.matchAll(/<div class="([^"]+)" role="button" tabindex="0" data-notif-id="([^"]*)" data-task-id="([^"]*)">/g)].map(([,classes,id,taskId])=>Object.assign(element(classes),{dataset:{notifId:decode(id),taskId:decode(taskId)}}));}});
    list.querySelectorAll=()=>nodes;
    Object.assign(f.context,{fetchNotifications:async()=>notifs,markNotificationRead:async id=>{calls.push(['read',id]);},formatDateTime:()=> '07/10/2026 12:00',highlightTask:id=>calls.push(['highlight',id]),renderTaskHistory:(id,from)=>calls.push(['history',id,from]),showToast:(message,type)=>calls.push(['toast',type])});
    vm.runInNewContext(section(source,'export async function updateNotificationBadge()','// --- AUTOCOMPLETE E INPUTS').replace('export async function','async function'),f.context);
    await f.context.updateNotificationBadge();return {...f,calls,get nodes(){return nodes;}};
}
{
    const empty=await notificationFixture([]);assert.ok(empty.els['orb-notif-count'].classList.contains('hidden'));assert.ok(empty.els['modal-notifications-list'].innerHTML.includes('Nenhuma notificação disponível'));
    const many=await notificationFixture(Array.from({length:40},(_,i)=>({id:`N${i}`,taskId:`T${i}`,message:'Evento',isRead:i>=20})));
    assert.equal(many.nodes.length,40);assert.equal(many.els['orb-notif-count'].textContent,'9+');
    for(const isRead of [false,true])for(const present of [false,true]){
        const f=await notificationFixture([{id:'N1',taskId:'T1',message:'Evento',isRead}],present?[{id:'T1'}]:[]);
        await f.nodes[0].click();await Promise.resolve();f.flush();
        assert.equal(f.calls.filter(c=>c[0]==='read').length,isRead?0:1);
        assert.ok(f.calls.some(c=>c[0]===(present?'history':'toast')));
        if(present)assert.deepEqual(f.calls.find(c=>c[0]==='history'),['history','T1',true]);
        assert.ok(f.els.notificationsModal.classList.contains('hidden'));
    }
    for(const key of ['Enter',' ','Escape']){
        const f=await notificationFixture([{id:'N2',taskId:'T2',message:'Evento',isRead:true}],[{id:'T2'}]);let prevented=0;
        await f.nodes[0].fire('keydown',{key,preventDefault(){prevented++;}});f.flush();
        assert.equal(prevented,key==='Escape'?0:1);assert.equal(f.calls.filter(c=>c[0]==='history').length,key==='Escape'?0:1);
    }
    // Repeat click parity is intentionally preserved: no new dedupe, suppression or delivery changes.
    const f=await notificationFixture([{id:'NR',taskId:'TR',message:'Evento',isRead:false}],[{id:'TR'}]);const old=f.nodes[0];
    await old.click();await old.click();f.flush();assert.equal(f.calls.filter(c=>c[0]==='read').length,2);
    checks.push('Actual notification callback: zero/40, capped badge, read/unread, present/missing task, keyboard, repeat-click parity');
}
// Keep the actual modal open/close behavior, including its known close/reopen timer race.
{
    const f=fixture(['orb-notif-btn','notificationsModal','closeNotificationsBtn']);
    f.context.closeShellPanels=()=>{};
    vm.runInNewContext(section(main,"    const notifBtn = document.getElementById('orb-notif-btn');","    const themeToggleBtn = document.getElementById('theme-toggle');"),f.context);
    f.els.notificationsModal.classList.add('hidden');
    await f.els['orb-notif-btn'].click({stopPropagation(){}});assert.ok(f.els.notificationsModal.classList.contains('show'));
    await f.els.closeNotificationsBtn.click();f.flush();assert.ok(f.els.notificationsModal.classList.contains('hidden'));
    await f.els['orb-notif-btn'].click({stopPropagation(){}});
    await f.els.notificationsModal.click({target:f.els.notificationsModal});
    await f.els['orb-notif-btn'].click({stopPropagation(){}});f.flush();
    assert.ok(f.els.notificationsModal.classList.contains('hidden'),'Known PF-58 rapid close/reopen timer behavior is unchanged');
    checks.push('Actual notification modal: open/close/backdrop; existing rapid close/reopen timer limitation reproduced, not fixed');
}
// Existing API explicitly conflates non-OK responses with an empty list; network rejection still rejects.
{
    const code=section(read('app/js/api.js'),'export async function fetchNotifications()','export async function markNotificationRead(').replace('export async function','async function');
    const context={fetch:async()=>({ok:false})};vm.runInNewContext(code,context);
    assert.deepEqual(Array.from(await context.fetchNotifications()),[]);
    context.fetch=async()=>{throw new Error('Synthetic network interruption');};
    await assert.rejects(context.fetchNotifications(),/Synthetic network interruption/);
    checks.push('PF-34 existing failure contract reproduced: HTTP failure returns empty; network interruption rejects');
}
// Real signal recipient selection handler, with local mock callbacks.
{
    const f=fixture(['modal-signal-btn','signalConfirmModal','confirmSignalBtn','cancelSignalBtn','signal-targets-container']);
    let boxes=[],html='',reject=false;const calls=[];
    f.context.state={lastInteractedTaskId:'T1',tasks:[{id:'T1',responsible:['Ana & "A"',{name:longName},...Array.from({length:18},(_,i)=>`Pessoa ${i}`)]}]};
    const target=f.els['signal-targets-container'];
    Object.defineProperty(target,'innerHTML',{get:()=>html,set(value){html=value;boxes=[...value.matchAll(/<input type="checkbox" value="([^"]*)" class="target-checkbox" (checked)?>/g)].map(([,value,checked])=>({value:decode(value),checked:!!checked}));}});
    target.querySelectorAll=()=>boxes.filter(x=>x.checked);
    f.context.ui={showToast:(m,type)=>calls.push(['toast',type])};f.context.api={signalResponsible:async(id,selected)=>{calls.push(['signal',id,Array.from(selected)]);if(reject)throw new Error('fixture');}};
    vm.runInNewContext(section(main,"    const signalBtn = document.getElementById('modal-signal-btn');","    document.getElementById('add-comment-btn')"),f.context);
    await f.els['modal-signal-btn'].click();assert.equal(boxes.length,20);assert.deepEqual(boxes.filter(x=>x.checked).map(x=>x.value),['Ana & "A"']);
    await f.els.cancelSignalBtn.click();f.flush();assert.ok(!calls.some(c=>c[0]==='signal'));
    await f.els['modal-signal-btn'].click();boxes.forEach(x=>x.checked=false);await f.els.confirmSignalBtn.click();assert.ok(!calls.some(c=>c[0]==='signal'));
    boxes[1].checked=true;await f.els.confirmSignalBtn.click();f.flush();assert.deepEqual(calls.find(c=>c[0]==='signal'),['signal','T1',[longName]]);
    await f.els['modal-signal-btn'].click();await f.els['modal-signal-btn'].click();await f.els.confirmSignalBtn.click();f.flush();assert.equal(calls.filter(c=>c[0]==='signal').length,2);
    await f.els['modal-signal-btn'].click();reject=true;await f.els.confirmSignalBtn.click();f.flush();assert.equal(f.els.confirmSignalBtn.disabled,false);assert.ok(f.els.signalConfirmModal.classList.contains('hidden'));assert.ok(calls.some(c=>c[0]==='toast'&&c[1]==='error'));
    reject=false;
    for(const value of [undefined,null,'',0]) {
        f.context.state.tasks[0].responsible=[{name:value}];
        await f.els['modal-signal-btn'].click();
        assert.equal(boxes[0].value,String(value));
        await f.els.confirmSignalBtn.click();f.flush();
        assert.deepEqual(calls.filter(c=>c[0]==='signal').at(-1),['signal','T1',[String(value)]]);
    }
    checks.push('Actual signal handler: 20 recipients, exact values, default principal, cancel, none selected, selected payload, reopen/repeat, failure reset');
}
// Real attention queue recognition/dismissal, no real recipients or API.
{
    const f=fixture(['alertModal','alert-task-id','alert-task-title','alert-queue-count','alert-signaled-by','dismissAlertBtn']);const calls=[];let reject=false;
    f.context.state={currentUser:{userDetails:'ana@example.test',userId:'auth-id',claims:[]},users:[{name:'Ana',email:'ana@example.test'}]};
    f.context.alertQueue=[];f.context.isAlertModalOpen=false;
    f.context.api={dismissAlert:async id=>{calls.push(['dismiss',id]);if(reject)throw new Error('fixture');}};
    f.context.ui={updateNotificationBadge:()=>calls.push(['badge']),highlightTask:id=>calls.push(['highlight',id]),renderTaskHistory:id=>calls.push(['history',id])};
    vm.runInNewContext(section(main,'function checkAndQueueAlerts(tasks)','// --- OBSERVADOR DE FLUXO DE ALERTAS'),f.context);
    const tasks=[{id:'T1',title:'Título extenso',pendingAlerts:[{targetUser:'ana@example.test',signaledBy:longName}]},{id:'T2',title:'Outra',pendingAlerts:['Ana']},{id:'T3',title:'Outro alvo',pendingAlerts:['Outro']}];
    const before=stateCopy(tasks);f.context.checkAndQueueAlerts(tasks);f.context.checkAndQueueAlerts(tasks);
    assert.equal(f.context.alertQueue.length,2);assert.equal(f.els['alert-queue-count'].textContent,1);assert.equal(f.els['alert-signaled-by'].textContent,longName);
    reject=true;await f.els.dismissAlertBtn.click();assert.equal(f.context.alertQueue.length,2);assert.equal(f.els.dismissAlertBtn.disabled,false);
    reject=false;const first=f.els.dismissAlertBtn;await first.click();await first.click();f.flush();assert.equal(calls.filter(c=>c[0]==='dismiss'&&c[1]==='T1').length,2); // failure plus one successful call
    assert.equal(f.context.alertQueue.length,1);assert.equal(f.context.isAlertModalOpen,false);assert.ok(calls.some(c=>c[0]==='history'&&c[1]==='T1'));
    f.context.processAlertQueue();assert.equal(f.els.dismissAlertBtn.disabled,false);assert.equal(f.els['alert-queue-count'].textContent,0);assert.equal(f.els['alert-signaled-by'].textContent,'Um colega');
    assert.deepEqual(stateCopy(tasks),before);
    checks.push('Actual alert queue: exact identity recognition, duplicate event suppression, full sender, failed dismissal/retry, disabled repeat, second alert reset, no task mutation');
}
console.log(JSON.stringify({status:'passed',checks,scope:'Synthetic renderers/callbacks only; browser and backend delivery remain unverified.'},null,2));
