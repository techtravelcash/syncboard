/** TC475: login remains functional without the removed animation action. No browser or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html = fs.readFileSync(new URL('../app/login.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../app/css/login-v2.css', import.meta.url), 'utf8');
assert.doesNotMatch(html, /cube-motion-toggle|cubeToggle|cubeSource|Pausar animação|Retomar animação/);
assert.doesNotMatch(css, /cube-motion-toggle/);
assert.match(html, /<source media="\(prefers-reduced-motion: no-preference\)" data-cube-source="cube-assembly-512.gif"/);
assert.match(html, /<img data-cube-source="cube-static-512.png"[^>]*alt="" width="512" height="512">/);
assert.match(html, /href="\/\.auth\/login\/google\?post_login_redirect_uri=\/"/);
assert.match(css, /@media \(max-width: 900px\)/);
assert.match(css, /@media \(max-width: 374px\)/);
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
assert.equal(scripts.length, 2);
for (const script of scripts) new vm.Script(script);
let scenarios = 0;
for (const saved of [undefined, 'dark', 'light']) {
  for (const prefersDark of [false, true]) {
    for (const reducedMotion of [false, true]) {
      const classes = new Set();
      const classList = { contains: v => classes.has(v), add: v => classes.add(v), remove: v => classes.delete(v), toggle(v) { classes.has(v) ? classes.delete(v) : classes.add(v); } };
      const localStorage = saved === undefined ? {} : {theme: saved};
      let listener, icon, iconRenders = 0;
      const document = {
        documentElement: {classList},
        getElementById(id) {
          if (id === 'theme-toggle') return {addEventListener(event, fn) { assert.equal(event, 'click'); listener = fn; }};
          if (id === 'theme-icon') return {setAttribute(attr, value) { assert.equal(attr, 'data-lucide'); icon = value; }};
          throw new Error(`Unexpected element lookup: ${id}`);
        }
      };
      const window = {lucide: {createIcons() { iconRenders++; }}, matchMedia(query) {return {matches: query.includes('reduced-motion') ? reducedMotion : prefersDark};}};
      const context = vm.createContext({document, localStorage, window, tailwind: {}});
      for (const script of scripts) vm.runInContext(script, context);
      let dark = saved === 'dark' || (saved === undefined && prefersDark);
      assert.equal(classes.has('dark'), dark);
      assert.equal(icon, dark ? 'sun' : 'moon');
      assert.equal(typeof listener, 'function');
      // Repeated clicks still update the icon and persist the selected theme.
      for (let i = 0; i < 4; i++) {
        listener(); dark = !dark;
        assert.equal(classes.has('dark'), dark);
        assert.equal(localStorage.theme, dark ? 'dark' : 'light');
        assert.equal(icon, dark ? 'sun' : 'moon');
      }
      assert.equal(iconRenders, 5);
      scenarios++;
    }
  }
}
console.log(`PASS TC475: animation control absent; animated/static sources, Google link and responsive rules retained; ${scenarios} isolated login theme scenarios.`);
