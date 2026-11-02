'use strict';
// This plugin UI is standalone ES module JavaScript; no dependency bundler is needed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../extensions/personal-operations');
const code=fs.readFileSync(path.join(root,'ui/index.js'));
const style=fs.readFileSync(path.join(root,'ui/style.css'));
const fingerprint=crypto.createHash('sha256').update(code).update('\0').update(style).digest('hex').slice(0,16);
const relative='dist/control-ui/'+fingerprint;
const directory=path.join(root,relative);fs.mkdirSync(directory,{recursive:true});
fs.writeFileSync(path.join(directory,'index.js'),code);
fs.writeFileSync(path.join(directory,'index.css'),style);
const file=path.join(root,'openclaw.plugin.json'),manifest=JSON.parse(fs.readFileSync(file));
manifest.controlUi={...manifest.controlUi,entry:relative+'/index.js',styles:[relative+'/index.css']};
fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({plugin:manifest.id,fingerprint,entry:manifest.controlUi.entry,installed:false}));
