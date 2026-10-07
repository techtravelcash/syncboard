// Real form/controller callbacks with minimal DOM. Native layout/focus remains browser QA.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app/js/homologation-v2.js',import.meta.url),'utf8').replaceAll('export function','function');
const task={responsible:[{email:'old@example.test'}]};
const users=[{name:'Old',email:'old@example.test'},{name:'Reviewer',email:'reviewer@example.test'},{name:'<New & Safe>',email:'new@example.test'}];
function fixture(submit=async()=>true,supported=true) {
 let active=null,calls=[];
 function element(){return {disabled:false,handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(){}};}
 const select={...element(),options:[{value:''}],value:'',appendChild(option){this.options.push(option);}};
 const buttons=[element(),element()],error=element(),form=element();
 const dialog={...element(),querySelector(s){return s==='select'?select:s==='form'?form:error;},querySelectorAll(){return buttons;},close(){this.handlers.close();},remove(){active=null;},showModal:supported?function(){this.open=true;}:undefined};
 const document={getElementById:()=>active,createElement:name=>name==='dialog'?dialog:element(),body:{appendChild(node){active=node;}}};
 const context={document};vm.createContext(context);vm.runInContext(source,context);
 const show=()=>context.openForwardDialog(task,users,async email=>{calls.push(email);return submit(email);});
 return {show,select,buttons,error,form,dialog,calls,get active(){return active;},async submit(){await form.handlers.submit({preventDefault(){}});}};
}
const cancel=fixture();assert.equal(cancel.show(),true);assert.equal(cancel.select.options.length,3);assert.equal(cancel.select.options.some(o=>o.value==='old@example.test'),false);assert.ok(cancel.select.options.some(o=>o.textContent?.includes('<New & Safe>')));assert.equal(cancel.show(),undefined);cancel.buttons[0].handlers.click();assert.equal(cancel.active,null);assert.equal(cancel.calls.length,0);
const success=fixture();success.show();await success.submit();assert.equal(success.calls.length,0);success.select.value='reviewer@example.test';await success.submit();assert.deepEqual(success.calls,['reviewer@example.test']);assert.equal(success.active,null);
let fail=true;const retry=fixture(async()=>!fail);retry.show();retry.select.value='new@example.test';await retry.submit();assert.ok(retry.active);assert.equal(retry.select.value,'new@example.test');assert.ok(retry.buttons.every(b=>!b.disabled));assert.match(retry.error.textContent,/Não foi possível/);fail=false;await retry.submit();assert.equal(retry.active,null);assert.equal(retry.calls.length,2);
let resolve;const race=fixture(()=>new Promise(r=>{resolve=r;}));race.show();race.select.value='new@example.test';const pending=race.submit();assert.ok(race.buttons.every(b=>b.disabled));assert.ok(race.select.disabled);await race.submit();assert.equal(race.calls.length,1);let prevented=false;race.dialog.handlers.cancel({preventDefault(){prevented=true;}});assert.ok(prevented);resolve(true);await pending;assert.equal(race.active,null);
const thrown=fixture(async()=>{throw Error('offline');});thrown.show();thrown.select.value='new@example.test';await thrown.submit();assert.ok(thrown.active);assert.ok(thrown.buttons.every(b=>!b.disabled));
const unsupported=fixture(undefined,false);assert.equal(unsupported.show(),false);assert.equal(unsupported.active,null);
console.log('PASS TC462 forward dialog: registered choices, old sole assignee excluded, self allowed, safe labels, selection required, cancel/no-write, error retaining selection/retry, repeated submit lock, pending Escape guard, close cleanup and unsupported fallback.');
