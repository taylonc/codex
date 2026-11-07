import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
let child,dir,cookie='';const base='http://127.0.0.1:3107';
async function request(route,body){const res=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{cookie,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,...await res.json()};}
before(async()=>{dir=await mkdtemp(path.join(os.tmpdir(),'sunday-test-'));child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3107',DB_PATH:path.join(dir,'test.db')},stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{child.stdout.on('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('Server exited')));});});
after(async()=>{child?.kill();await new Promise(r=>child?.once('exit',r));await rm(dir,{recursive:true,force:true});});
test('complete persistent collector journey and validation',async()=>{
 const initial=await request('state');assert.equal(initial.user.coins,500);assert.equal(initial.user.packs.frontiers,3);assert.equal(initial.cards.length,36);
 const opened=await request('open',{set:'frontiers'});assert.equal(opened.pulled.length,5);assert.notEqual(opened.pulled[4].rarity,'Common');assert.equal(opened.user.packs.frontiers,2);assert.equal(Object.values(opened.user.collection).reduce((a,b)=>a+b,0),5);
 assert.equal((await request('state')).user.opened,1);
 assert.equal((await request('open',{set:'invalid'})).status,400);
 assert.equal((await request('buy',{set:'midnight'})).user.coins,350);
 assert.equal((await request('daily',{})).user.coins,600);assert.equal((await request('daily',{})).status,400);
 assert.equal((await request('register',{name:'Test Collector',email:'test@example.com',pass:'a-long-password'})).user.registered,true);
 const saved=(await request('state')).user;
 await request('logout',{});cookie='';assert.notEqual((await request('state')).user.id,saved.id);
 assert.equal((await request('login',{email:'test@example.com',pass:'wrong'})).status,401);
 const logged=await request('login',{email:'test@example.com',pass:'a-long-password'});assert.equal(logged.user.id,saved.id);assert.deepEqual(logged.user.collection,saved.collection);assert.equal(logged.user.name,'Test Collector');
 for(let i=0;i<5;i++)await request('buy',{set:'frontiers'});assert.equal((await request('buy',{set:'midnight'})).status,400);
 const bad=await fetch(base+'/api/daily',{method:'POST',headers:{cookie,origin:'https://attacker.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(bad.status,403);
});
