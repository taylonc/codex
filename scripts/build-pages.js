import {cp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await cp('cards.js','dist/catalog.js');
const html=await readFile('dist/index.html','utf8');
await writeFile('dist/index.html',html.replace('<head>','<head><meta name="static-preview" content="true">'));
await writeFile('dist/.nojekyll','');
console.log('GitHub Pages preview built in dist/');
