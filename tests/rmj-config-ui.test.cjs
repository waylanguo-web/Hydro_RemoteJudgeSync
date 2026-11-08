const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const {parseCFProblem,cfUrl}=require('../shared/cf-problem');
async function fixture(type,target='4:A',problemId='') {
 let page,sidebarPanel;const mainPanels=[],controls={};
 for(const key of ['[name="rmj-mode"]','[name="rmj-platform"]','[name="rmj-target"]','[data-rmj-save]','[data-rmj-restore]','[data-rmj-status]','[data-rmj-preview]','[data-rmj-options]','a'])controls[key]={style:{},setCustomValidity(v){this.validation=v;},reportValidity(){return !this.validation;},querySelector:k=>controls[k],addEventListener(n,f){this[n]=f;}};
 const sidebar={prepend:p=>sidebarPanel=p};const editor={style:{},before:p=>mainPanels.push(p),closest:()=>({querySelector:()=>sidebar})};
 const document={getElementById:id=>id==='ProblemConfig'?editor:null,createElement:()=>({style:{},querySelector:k=>controls[k],addEventListener(n,f){this[n]=f;}})};
 const src=fs.readFileSync(require('node:path').join(__dirname,'../frontend/rmj-config.page.js'),'utf8').replace(/^import .*;\s*/gm,'');
 const schema={uri:'https://hydro.js.org/schema/problemConfig.json',schema:{properties:{type:{enum:['default']}}}};
 const yamlDefaults={options:{schemas:[schema]},getDiagnosticsOptions(){return this.options;},setDiagnosticsOptions(value){this.options=value;}};
 vm.runInNewContext(src,{window:{UiContext:{rmjConfig:{type:type==='rmj'?'remoteJudge':type,enabled:type==='rmj',target,problemId}}},document,parseCFProblem,cfUrl,setTimeout:f=>f(),loadMonaco:async()=>({monaco:{languages:{yaml:{yamlDefaults}}}}),addPage:p=>page=p,NamedPage:class{constructor(name,run){this.name=name;this.run=run;}}});await page.run();
 assert.equal(yamlDefaults.options.schemas[0].schema.properties.rmj,undefined);
 return {page,sidebarPanel,mainPanels,editor,controls};
}
test('RMJ settings leave Hydro YAML validation and native editor intact',async()=>{
 for(const type of ['default','interactive','rmj']){
  const f=await fixture(type),c=f.controls;assert.equal(f.page.name,'problem_config');
  assert.equal(f.sidebarPanel,undefined);assert.equal(f.mainPanels[0].id,'rmj-config-form');
  assert.match(f.mainPanels[0].innerHTML,/name="rmj-platform"/);
  assert.equal(f.editor.style.display,'');assert.equal(c['[data-rmj-options]'].style.display,type==='rmj'?'':'none');
  assert.equal(c['[name="rmj-target"]'].value,'CF4A');
  c['[name="rmj-mode"]'].value='rmj';c['[name="rmj-mode"]'].change();assert.equal(c['[data-rmj-options]'].style.display,'');
  c['[name="rmj-mode"]'].value='native';c['[name="rmj-mode"]'].change();assert.equal(f.editor.style.display,'');
 }
});
test('pasted links normalize to problem ID, show original link and reject other hosts',async()=>{
 const f=await fixture('rmj'),c=f.controls,input=c['[name="rmj-target"]'];
 input.value='https://codeforces.com/problemset/problem/2276/A?locale=en#statement';input.paste();
 assert.equal(input.value,'CF2276A');assert.equal(c.a.href,'https://codeforces.com/contest/2276/problem/A');
 input.value='https://evil.test/contest/2276/problem/A';input.change();assert.ok(input.validation);assert.equal(c['[data-rmj-preview]'].style.display,'none');
 assert.equal((await fixture('rmj','','CF2276A')).controls['[name="rmj-target"]'].value,'CF2276A');
});
