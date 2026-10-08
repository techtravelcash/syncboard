// Exercise the real bootstrap callback in an isolated DOM/API mock. No network.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const path = fileURLToPath(new URL('../app/js/main.js', import.meta.url));
const source = readFileSync(path, 'utf8');
const start = source.indexOf("document.addEventListener('DOMContentLoaded', async () => {");
const end = source.indexOf('// --- ATUALIZA PERFIL NO ORB', start);
assert.ok(start >= 0 && end > start, 'Real bootstrap boundaries must be available');
const bootstrap = source.slice(start, end);
function node(hidden = false) {
  const classes = new Set(hidden ? ['hidden'] : []);
  return {style: {}, inert: false, attrs: {}, classList: {add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x), toggle: () => {}}, setAttribute(k,v) {this.attrs[k]=v;}};
}
async function scenario(failure) {
  const elements = {'loader-container':node(), 'main-content':node(), app:node(), 'user-management-btn':node(true)};
  elements.app.inert = true;
  const timers = [];
  const errors = [];
  let callback;
  let reads = 0;
  const context = {
    state: {}, localStorage: {getItem: () => 'dark'},
    document: {documentElement:node(), getElementById:id=>elements[id], addEventListener:(name, cb)=> {if(name==='DOMContentLoaded')callback=cb;}},
    api: {getUserInfo:async()=>failure==='missing-session'?null:{userRoles:failure==='denied-role'?[]:['travelcash_user','admin']}, fetchUsers:async()=>{reads++;return[];},fetchTasks:async()=>{reads++;return[];}},
    ui: {populateProjectFilter(){},populateResponsibleFilter(){},updateNotificationBadge(){},updateActiveView(){}},
    initializeProjectTaskCounts(){},initializeShell(){if(failure==='shell')throw new Error('Simulated shell initialization failure');},
    updateUserProfileUI(){},connectToSignalR(){},updateDragAndDropState(){},
    initializeEventListeners(){if(failure==='listeners')throw new Error('Simulated late listener/theme storage failure');},
    checkAndQueueAlerts(){if(failure==='alerts')throw new Error('Simulated late alert initialization failure');},
    showStartupState(title){errors.push(title);elements.app.inert=true;elements['loader-container'].classList.remove('hidden');elements['loader-container'].style.opacity='1';},
    setTimeout(cb){timers.push(cb);return timers.length;},console:{error(){}},Promise
  };
  vm.runInNewContext(bootstrap, context);
  await callback();
  for(const timer of timers)timer();
  if(failure){
    assert.equal(errors.length,1,failure);
    assert.equal(timers.length,0,`${failure}: no dismissal may hide the retry/error state`);
    assert.equal(elements['loader-container'].classList.contains('hidden'),false,failure);
    assert.equal(elements.app.inert,true,failure);
    if(['missing-session','denied-role','shell'].includes(failure))assert.equal(reads,0,failure);
  }else{
    assert.equal(errors.length,0);
    assert.equal(timers.length,1);
    assert.equal(elements['loader-container'].classList.contains('hidden'),true);
    assert.equal(elements.app.inert,false);
    assert.equal(elements['main-content'].attrs['aria-busy'],'false');
  }
}
for(const failure of [null,'listeners','alerts','shell','missing-session','denied-role'])await scenario(failure);
console.log(JSON.stringify({status:'passed',tests:['successful startup reveals ready app','late listener failure retains retry state after timers','late alert failure retains retry state after timers','shell initialization failure shows error','missing session stops data reads','denied role stops data reads'],scope:'Real bootstrap callback with isolated mocks; no browser or backend end-to-end claim'},null,2));
