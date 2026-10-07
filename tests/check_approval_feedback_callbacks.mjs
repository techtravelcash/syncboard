import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const main=readFileSync(new URL('../app/js/main.js',import.meta.url),'utf8');
const card=main.slice(main.indexOf('        const approveBtn ='),main.indexOf('        const publishBtn ='));
const detail=main.slice(main.indexOf('    const modalApproveBtn ='),main.indexOf("    document.getElementById('editTaskBtn')"));
for(const kind of ['card','detail'])for(const result of ['success','error','wrong','render-error']){
 let resolve,reject,calls=0,shown=0,callback,toasts=[];
 const pending=new Promise((yes,no)=>{resolve=yes;reject=no});
 const btn={dataset:{taskId:'TC-test'},disabled:false,addEventListener(type,fn){callback=fn;}};
 const ctx={pendingApprovalFeedback:new Set(),state:{tasks:[{id:'TC-test',status:'homologation'}]},api:{updateTask(id,payload){calls++;assert.equal(id,'TC-test');assert.equal(payload.status,'publication');return pending;}},ui:{showToast(message,type){toasts.push({message,type});},renderTaskHistory(){},updateActiveView(){if(result==='render-error')throw Error('render failed');}},showApprovalSuccess(){shown++;},window:{},console:{error(){}},document:{getElementById(){return btn;}}};
 vm.createContext(ctx);
 if(kind==='card')callback=vm.runInContext('(async function(e){'+card+'})',ctx);else vm.runInContext(detail,ctx);
 const event={stopPropagation(){},target:{closest(){return btn;}}};
 const first=callback(event);await callback(event);assert.equal(calls,1,'duplicate pending approval must not write twice');assert.equal(shown,0,'no feedback before server');
 if(result==='error')reject(new Error('server failed'));else resolve({id:'TC-test',status:['success','render-error'].includes(result)?'publication':'homologation'});
 await first;assert.equal(shown,result==='success'?1:0);assert.equal(ctx.pendingApprovalFeedback.size,0,'guard releases');
 if(result==='render-error'){assert.equal(toasts.at(-1).type,'success');assert.equal(btn.disabled,true);}
 if(['error','wrong'].includes(result))assert.equal(ctx.state.tasks[0].status,'homologation');
}
assert.ok(!main.includes('decideHomologation'));
assert.ok(!main.includes('rejectTask'));
console.log('PASS TC461 real card/detail callbacks: server-only feedback, error/wrong-status silence, same-task duplicate guard and guard release; no TC462 decision handler.');
