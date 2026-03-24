import {readFileSync} from 'fs';
const t=readFileSync('dist/status/html.js','utf8');
const i=t.indexOf('<!DOCTYPE');
console.log('DOCTYPE at index:',i);
console.log(t.substring(i,i+150));
