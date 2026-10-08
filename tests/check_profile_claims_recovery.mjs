// Recovery-specific real bootstrap + profile renderer, isolated APIs only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const main=readFileSync(new URL('../app/js/main.js',import.meta.url),'utf8');
const helper=readFileSync(new URL('../app/js/people-v2.js',import.meta.url),'utf8');
const {peopleAvatar}=await import('data:text/javascript;base64,'+Buffer.from(helper).toString('base64'));
const bootstrap=main.slice(main.indexOf("document.addEventListener('DOMContentLoaded', async () => {"),main.indexOf('// --- ATUALIZA PERFIL NO ORB'));
const profile=main.slice(main.indexOf('function updateUserProfileUI()'),main.indexOf('// --- DRAG AND DROP'));
const cases=[['absent',undefined],['null',null],['object',{}],['string','invalid'],['empty',[]],['malformed entries',[null,42,{},'invalid']],['unknown claim',[{typ:'name',val:'Fixture'}]],['short picture',[{typ:'picture',val:'https://example.invalid/a.png'}]],['long picture',[{typ:'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture',val:'https://example.invalid/b.png'}]],['mixed picture',[null,{}, {typ:'picture',val:'https://example.invalid/c.png'}]]];
const result=[];
async function run(label,claims,failure=null){
 const classes=()=>{const values=new Set();return{add:(...a)=>a.forEach(x=>values.add(x)),remove:(...a)=>a.forEach(x=>values.delete(x)),contains:x=>values.has(x),toggle(){}}};
 const node=()=>({classList:classes(),style:{},attrs:{},inert:false,innerHTML:'',textContent:'',setAttribute(k,v){this.attrs[k]=v}});
 const ids=['loader-container','main-content','app','user-management-btn','user-name-display','user-role-display','user-avatar-menu','orb-avatar-container'];const nodes=Object.fromEntries(ids.map(id=>[id,node()]));nodes.app.inert=true;
 const user={userDetails:'fixture@example.invalid',userRoles:['travelcash_user','admin']};if(label!=='absent')user.claims=claims;
 if(failure==='denied-role')user.userRoles=[];if(failure==='missing-roles')delete user.userRoles;if(failure==='missing-details')delete user.userDetails;
 const writes=[],errors=[],timers=[];let callback,reads=0;
 const context={state:{},peopleAvatar,localStorage:{getItem:()=> 'dark'},document:{documentElement:node(),getElementById:id=>nodes[id],addEventListener:(event,fn)=>{if(event==='DOMContentLoaded')callback=fn}},api:{getUserInfo:async()=>failure==='missing-session'?null:user,fetchUsers:async()=>{reads++;return failure==='bad-directory'?undefined:[{name:'Fixture Name',email:'fixture@example.invalid',role:'Fixture role'}]},fetchTasks:async()=>{reads++;return[]},updateUserPhoto:url=>{writes.push(url);return Promise.resolve()}},ui:{populateProjectFilter(){},populateResponsibleFilter(){},updateNotificationBadge(){},updateActiveView(){}},initializeProjectTaskCounts(){},initializeShell(){},connectToSignalR(){},updateDragAndDropState(){},initializeEventListeners(){},checkAndQueueAlerts(){},showStartupState:title=>{errors.push(title);nodes.app.inert=true;nodes['loader-container'].classList.remove('hidden')},setTimeout:fn=>{timers.push(fn);return timers.length},console:{error(){}},Promise};
 vm.runInNewContext(bootstrap+'\n'+profile,context);await callback();timers.forEach(fn=>fn());
 if(failure){assert.equal(errors.length,1,label);assert.equal(nodes.app.inert,true,label);assert.equal(nodes['loader-container'].classList.contains('hidden'),false,label);assert.equal(writes.length,0,label);if(['missing-session','denied-role','missing-roles'].includes(failure))assert.equal(reads,0,label)}
 else{assert.equal(errors.length,0,label);assert.equal(nodes.app.inert,false,label);assert.equal(nodes['loader-container'].classList.contains('hidden'),true,label);assert.equal(nodes['user-name-display'].textContent,'Fixture Name');assert.equal(nodes['user-role-display'].textContent,'Fixture role');const expected=Array.isArray(claims)?claims.find(c=>c?.typ==='picture'||c?.typ==='http://schemas.xmlsoap.org/ws/2005/05/identity/claims/picture')?.val:undefined;assert.deepEqual(writes,expected?[expected]:[],label);assert.equal(nodes['orb-avatar-container'].innerHTML,nodes['user-avatar-menu'].innerHTML);if(!expected)assert(nodes['orb-avatar-container'].innerHTML.includes('sb-person-initial'),label)}
 result.push(label);
}
for(const [label,claims] of cases)await run(label,claims);
for(const failure of ['missing-session','denied-role','missing-roles','missing-details','bad-directory'])await run(failure,undefined,failure);
console.log(JSON.stringify({status:'passed',scenarios:result,checks:['Real bootstrap and real profile renderer used together','Optional picture metadata falls back without photo writes','Both supported picture types keep exact existing photo call','Required session/role/details/directory failures remain blocked','No auth/API/route change; no live request'],scope:'Isolated recovery regression fixtures, not production/SSO verification'},null,2));
