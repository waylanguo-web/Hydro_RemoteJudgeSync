const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
test('config extension mounts only on config page and preserves native editor for ordinary problems',()=>{
 for(const type of ['default','interactive','rmj']) {
  let page,panel;const controls={};
  for(const key of ['[name="rmj-mode"]','[name="rmj-target"]','[data-rmj-save]','[data-rmj-status]','[data-rmj-fields]','[data-rmj-native]'])controls[key]={addEventListener:(n,f)=>{controls[key][n]=f;}};
  const editor={style:{},before:p=>panel=p};
  const document={getElementById:id=>id==='ProblemConfig'?editor:null,createElement:()=>({querySelector:key=>controls[key]})};
  const src=fs.readFileSync(require('node:path').join(__dirname,'../frontend/rmj-config.page.js'),'utf8').replace(/^import .*;\s*/,'');
  vm.runInNewContext(src,{window:{UiContext:{rmjConfig:{type,target:'4:A'}}},document,addPage:p=>page=p,NamedPage:class{constructor(name,run){this.name=name;this.run=run;}}});
  assert.equal(page.name,'problem_config');page.run();assert.equal(panel.id,'rmj-config-extension');
  assert.equal(editor.style.display,type==='rmj'?'none':'');assert.equal(controls['[name="rmj-target"]'].value,'4:A');
  controls['[name="rmj-mode"]'].value='rmj';controls['[name="rmj-mode"]'].change();assert.equal(editor.style.display,'none');
  controls['[name="rmj-mode"]'].value='native';controls['[name="rmj-mode"]'].change();assert.equal(editor.style.display,type==='rmj'?'none':'');
 }
});
