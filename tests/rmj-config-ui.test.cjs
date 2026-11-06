const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const {parseRemoteProblem}=require('../shared/remote-problem');
function fixture(type,target='4:A',problemId='',platform='codeforces') {
 let page,sidebarPanel;const mainPanels=[],controls={};
 for(const key of ['[name="rmj-mode"]','[name="rmj-platform"]','[name="rmj-target"]','[data-rmj-save]','[data-rmj-restore]','[data-rmj-status]','[data-rmj-preview]','a'])controls[key]={style:{},setCustomValidity(v){this.validation=v;},reportValidity(){return !this.validation;},querySelector:k=>controls[k],addEventListener(n,f){this[n]=f;}};
 const sidebar={prepend:p=>sidebarPanel=p};const editor={style:{},before:p=>mainPanels.push(p),closest:()=>({querySelector:()=>sidebar})};
 const document={getElementById:id=>id==='ProblemConfig'?editor:null,createElement:()=>({style:{},querySelector:k=>controls[k],addEventListener(n,f){this[n]=f;}})};
 const src=fs.readFileSync(require('node:path').join(__dirname,'../frontend/rmj-config.page.js'),'utf8').replace(/^import .*;\s*/gm,'');
 vm.runInNewContext(src,{window:{UiContext:{rmjConfig:{type,target,problemId,platform}}},document,parseRemoteProblem,setTimeout:f=>f(),addPage:p=>page=p,NamedPage:class{constructor(name,run){this.name=name;this.run=run;}}});page.run();
 return {page,sidebarPanel,mainPanels,editor,controls};
}
test('RMJ fields occupy main settings area; sidebar contains only mode switch',()=>{
 for(const type of ['default','interactive','rmj']){
  const f=fixture(type),c=f.controls;assert.equal(f.page.name,'problem_config');
  assert.equal(f.sidebarPanel.id,'rmj-config-extension');assert.equal(f.mainPanels[0].id,'rmj-config-form');
  assert.doesNotMatch(f.sidebarPanel.innerHTML,/name="rmj-target"/);assert.match(f.mainPanels[0].innerHTML,/name="rmj-platform"/);
  assert.equal(f.editor.style.display,type==='rmj'?'none':'');assert.equal(f.mainPanels[0].style.display,type==='rmj'?'':'none');
  assert.equal(c['[data-rmj-restore]'].style.display,'none');assert.equal(c['[name="rmj-target"]'].value,'CF4A');
  c['[name="rmj-mode"]'].value='rmj';c['[name="rmj-mode"]'].change();assert.equal(f.mainPanels[0].style.display,'');
  c['[name="rmj-mode"]'].value='native';c['[name="rmj-mode"]'].change();assert.equal(f.editor.style.display,type==='rmj'?'none':'');
 }
});
test('pasted links normalize to problem ID, show original link and reject other hosts',()=>{
 const f=fixture('rmj'),c=f.controls,input=c['[name="rmj-target"]'];
 input.value='https://codeforces.com/problemset/problem/2276/A?locale=en#statement';input.paste();
 assert.equal(input.value,'CF2276A');assert.equal(c.a.href,'https://codeforces.com/contest/2276/problem/A');
 input.value='https://evil.test/contest/2276/problem/A';input.change();assert.ok(input.validation);assert.equal(c['[data-rmj-preview]'].style.display,'none');
 assert.equal(fixture('rmj','','CF2276A').controls['[name="rmj-target"]'].value,'CF2276A');
});

test('AtCoder selection, task extraction and contest-specific task URLs round-trip',()=>{
 const f=fixture('rmj','abc385/abc385_b','','atcoder'),c=f.controls,input=c['[name="rmj-target"]'];
 assert.equal(c['[name="rmj-platform"]'].value,'atcoder');assert.equal(input.value,'abc385_b');
 input.value='https://atcoder.jp/contests/abc043/tasks/abc022_b?lang=en';input.paste();
 assert.equal(input.value,'abc043/abc022_b');assert.equal(c.a.href,'https://atcoder.jp/contests/abc043/tasks/abc022_b');
 c['[name="rmj-platform"]'].value='codeforces';c['[name="rmj-platform"]'].change();
 assert.match(input.placeholder,/CF2276A/);
});
