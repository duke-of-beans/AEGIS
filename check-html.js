const fs=require('fs');
const t=fs.readFileSync('dist/status/html.js','utf8');
const i=t.indexOf('<!DOCTYPE');
console.log('DOCTYPE at index:',i);
console.log('First 150 chars of HTML:');
console.log(t.substring(i,i+150));
console.log('Total dist lines:',t.split('\n').length);
