// TC-458: execute the actual editor setup against controlled DOM/selection events.
// No browser geometry, API requests, comment delivery or live notifications.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const source = readFileSync(process.env.MENTION_UI_SOURCE || new URL('app/js/ui.js', root), 'utf8');
const setup = source.slice(source.indexOf('export function setupRichTextEditor('), source.indexOf('// --- UTILITÁRIOS ---', source.indexOf('export function setupRichTextEditor('))).replace('export ', '');
function fixture() {
  const nodes = new Map();
  let selection, caret, sends = 0;
  class Element {
    constructor(id = '') { this.id = id; this.style = {}; this.events = {}; this.children = []; this.dataset = {}; }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    fire(type, props = {}) { const event = {key:'', target:this, preventDefault(){this.prevented = true;}, stopPropagation(){}, ...props}; for (const fn of this.events[type] || []) fn(event); return event; }
    click() { if (this.onclick) this.onclick({preventDefault(){}, stopPropagation(){}}); }
    focus() { this.focused = true; }
    contains(node) { return node === this || this.children.includes(node); }
    getBoundingClientRect() { return {bottom:200, left:40}; }
    set innerHTML(html) { this.html = html; this.children = [...html.matchAll(/<button[^>]*class="mention-item"[\s\S]*?data-pic="[^"]*">/g)].map(match => { const item = new Element(); for (const attr of match[0].matchAll(/data-(email|name|pic)="([^"]*)"/g)) item.dataset[attr[1]] = attr[2]; return item; }); }
    querySelector() { return this.children[0] || null; }
    querySelectorAll() { return this.children; }
  }
  const editor = new Element('comment-input-rich'); nodes.set(editor.id, editor);
  const send = new Element('add-comment-btn'); send.onclick = () => sends++; nodes.set(send.id, send);
  const docEvents = {};
  const document = {
    getElementById:id => nodes.get(id), querySelectorAll:() => [],
    createElement:() => new Element(), body:{appendChild(node){nodes.set(node.id,node);}},
    addEventListener(type, fn){(docEvents[type] ||= []).push(fn);},
    createTextNode:textContent => ({nodeType:3, textContent}),
    createRange:() => ({
      createContextualFragment(html) {
        // Model the relevant final text node exactly, including template whitespace.
        const tail = html.slice(html.lastIndexOf('</span>') + 7).replace('&nbsp;', '\u00a0');
        const fragment = {html, lastChild:{nodeType:3,textContent:tail}, children:[], appendChild(n){this.children.push(n);}};
        return fragment;
      },
      setStart(node, offset){caret = {node, offset};},
      setStartAfter(node){caret = {after:node};}, collapse(){}
    })
  };
  const context = {document, window:{getSelection:() => selection}, Node:{TEXT_NODE:3}, state:{users:[{name:'Tech Travelcash',email:'tech@example.invalid'}, {name:'Ana Á',email:'ana@example.invalid'}]}};
  vm.createContext(context); vm.runInContext(setup, context); context.setupRichTextEditor();
  const menu = nodes.get('rich-mention-suggestions');
  function query(text, offset = text.length) {
    const parent = {inserted:[],appendChild(fragment){this.inserted.push(fragment);},insertBefore(fragment){this.inserted.push(fragment);}};
    const textNode = {nodeType:3, textContent:text, parentNode:parent, nextSibling:null};
    selection = {rangeCount:1,getRangeAt:() => ({startContainer:textNode,startOffset:offset,getBoundingClientRect:() => ({bottom:200,left:40})}),removeAllRanges(){},addRange(){}};
    editor.fire('keyup', {key:'a'});
    return {textNode,parent};
  }
  return {editor,menu,query,caret:() => caret,sends:() => sends, outside(){for(const fn of docEvents.click) fn({target:new Element()});}};
}
for (const mode of ['click','keyboard']) {
  const f = fixture();
  const q = f.query('Olá @Tech restante', 9);
  assert.equal(f.menu.style.display, 'flex');
  if (mode === 'click') f.menu.children[0].click();
  else { f.editor.fire('keydown', {key:'Enter'}); f.editor.fire('keyup', {key:'Enter'}); }
  const fragment = q.parent.inserted[0];
  assert.equal(q.textNode.textContent, 'Olá ');
  assert(fragment.html.startsWith('<span'), 'No leading indentation or newline');
  assert(fragment.html.endsWith('</span>&nbsp;'), 'Only one trailing nonbreaking space');
  assert(!fragment.html.includes('\n'), 'No injected line breaks');
  assert(fragment.html.includes('data-email="tech@example.invalid"'));
  assert(fragment.html.includes('>@Tech Travelcash</span>'));
  assert.equal(fragment.children[0].textContent, ' restante');
  assert.equal(f.caret().node, fragment.lastChild);
  assert.equal(f.caret().offset, 1, 'Caret stays inside the trailing text node');
  assert.equal(f.menu.style.display, 'none');
  assert.equal(f.sends(), 0); assert(f.editor.focused);
  // Repeated insertion, other identity and pre-existing text remain independent.
  const second = f.query('\u00a0e @Ana'); f.menu.children[0].click();
  assert.equal(second.textNode.textContent, '\u00a0e ');
  assert(second.parent.inserted[0].html.includes('data-email="ana@example.invalid"'));
  assert.equal(second.parent.inserted.length, 1); assert.equal(f.sends(), 0);
}
{
  const f = fixture(), q = f.query('@');
  f.editor.fire('keydown', {key:'Escape'}); f.editor.fire('keyup', {key:'Escape'});
  assert.equal(f.menu.style.display,'none'); assert.equal(q.parent.inserted.length,0); assert.equal(q.textNode.textContent,'@');
  f.query('@'); f.editor.fire('keydown', {key:'Enter',shiftKey:true}); f.editor.fire('keyup', {key:'Enter',shiftKey:true});
  assert.equal(f.menu.style.display,'none'); assert.equal(f.sends(),0);
  f.query('@'); f.outside(); assert.equal(f.menu.style.display,'none');
  f.editor.fire('keydown', {key:'Enter',shiftKey:true}); assert.equal(f.sends(),0);
  f.editor.fire('keydown', {key:'Enter'}); assert.equal(f.sends(),1);
}
console.log('PASS TC-458: click/Enter compact HTML, same-line caret, exact identity, prefix/suffix, repeated mention, Escape full key cycle, outside dismissal, Shift+Enter and send shortcut. Synthetic DOM only; live browser validation separate.');
