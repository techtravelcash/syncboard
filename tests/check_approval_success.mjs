import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('app/js/approval-success.js').replace('export function','function');
function setup(supported=true,fail=false) {
 let active=null,created=0;
 const button={addEventListener(name,fn){this[name]=fn;}};
 const img={dataset:{},addEventListener(name,fn){this[name]=fn;}};
 const document={getElementById:()=>active,createElement:()=>{created++;return {showModal:supported?function(){if(fail)throw Error('blocked');this.open=true;}:undefined,setAttribute(){},querySelector:s=>s==='img'?img:button,addEventListener(name,fn){this[name+'Event']=fn;},close(){this.open=false;this.closeEvent();},remove(){active=null;}};},body:{appendChild:d=>{active=d;}}};
 const context={document};vm.createContext(context);vm.runInContext(source,context);
 return {show:context.showApprovalSuccess,button,img,get active(){return active;},get created(){return created;}};
}
const t=setup();t.show();assert.ok(t.active.open);assert.match(t.active.innerHTML,/Boa, mais um cubo resolvido!/);assert.match(t.active.innerHTML,/enviada para Publicação/);assert.match(t.active.innerHTML,/prefers-reduced-motion: reduce/);assert.match(t.active.innerHTML,/autofocus/);t.show();assert.equal(t.created,1);t.button.click();assert.equal(t.active,null);t.show();assert.equal(t.created,2);t.active.closeEvent();assert.equal(t.active,null);
const fallback=setup();fallback.show();fallback.img.error({currentTarget:fallback.img});assert.equal(fallback.img.src,'assets/cube-static-512.png');fallback.img.error({currentTarget:fallback.img});assert.equal(fallback.img.hidden,true);
for(const config of [[false,false],[true,true]]){const t=setup(...config);t.show();assert.equal(t.active,null);}
for(const p of ['app/index.html','app/ui-v2-fidelity-preview.html'])assert.match(read(p),/css\/approval-success.css/);
console.log('PASS TC461 approval feedback: exact copy, publication distinction, reduced-motion source, duplicate dialog, close/reopen cleanup, image fallback and unsupported/failed native dialog fallback. Native keyboard/focus/layout needs browser QA.');
