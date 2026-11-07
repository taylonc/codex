import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cards, sets } from './cards.js';
await mkdir('data',{recursive:true});
const db = new DatabaseSync(process.env.DB_PATH || 'data/game.db');
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password TEXT,coins INTEGER DEFAULT 500,packs TEXT DEFAULT '{"frontiers":3,"woodland":0,"midnight":0}',collection TEXT DEFAULT '{}',opened INTEGER DEFAULT 0,daily TEXT); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT,expires INTEGER);`);
const query=(sql,...args)=>db.prepare(sql).get(...args);
const run=(sql,...args)=>db.prepare(sql).run(...args);
const state=u=>({id:u.id,name:u.name,registered:!!u.email,coins:u.coins,packs:JSON.parse(u.packs),collection:JSON.parse(u.collection),opened:u.opened,daily:u.daily});
const sessions=new Map();
function session(res,id){const token=randomBytes(32).toString('hex');run('INSERT INTO sessions VALUES(?,?,?)',token,id,Date.now()+30*86400000);res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${process.env.NODE_ENV==='production'?'; Secure':''}`);}
function password(p,salt=randomBytes(16).toString('hex')){return `${salt}:${scryptSync(p,salt,64).toString('hex')}`;}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const send=(obj,status=200)=>{res.statusCode=status;res.end(JSON.stringify(obj));};
 if(req.method==='POST' && req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`)return send({error:'Invalid origin'},403);
 let body={};if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)return send({error:'Request too large'},413);}try{body=JSON.parse(raw||'{}');}catch{return send({error:'Invalid JSON'},400);}}
 const token=req.headers.cookie?.match(/(?:^|; )session=([a-f0-9]+)/)?.[1];
 const sess=token&&query('SELECT * FROM sessions WHERE token=? AND expires>?',token,Date.now());let user=sess&&query('SELECT * FROM users WHERE id=?',sess.user_id);
 if(url.pathname==='/api/state' && req.method==='GET'){if(!user){const id=randomBytes(16).toString('hex');run('INSERT INTO users(id,name) VALUES(?,?)',id,'Cozy collector');session(res,id);user=query('SELECT * FROM users WHERE id=?',id);}return send({user:state(user),cards,sets});}
 if(!user)return send({error:'Refresh the page to start a session'},401);
 if(req.method!=='POST')return send({error:'Not found'},404);
 if(url.pathname==='/api/register'){
 const {name,email,pass}=body;if(typeof name!=='string'||!name.trim()||name.length>40||typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||typeof pass!=='string'||pass.length<10||pass.length>128)return send({error:'Enter a name, valid email, and password of 10–128 characters.'},400);
 if(user.email)return send({error:'Already registered'},400);
 if(query('SELECT id FROM users WHERE email=?',email.toLowerCase()))return send({error:'This email already has an account. Please sign in.'},409);
 run('UPDATE users SET name=?,email=?,password=? WHERE id=?',name.trim(),email.toLowerCase(),password(pass),user.id);
 }else if(url.pathname==='/api/login'){
 const key=req.socket.remoteAddress;const rate=sessions.get(key)||{n:0,t:Date.now()};if(Date.now()-rate.t>600000){rate.n=0;rate.t=Date.now();}rate.n++;sessions.set(key,rate);if(rate.n>30)return send({error:'Too many attempts. Try again in 10 minutes.'},429);
 const found=typeof body.email==='string'&&query('SELECT * FROM users WHERE email=?',body.email.toLowerCase());const hash=found?.password||password('dummy-password');const [salt,expected]=hash.split(':');const actual=scryptSync(String(body.pass||'').slice(0,128),salt,64);if(!found||!timingSafeEqual(actual,Buffer.from(expected,'hex')))return send({error:'Email or password is incorrect.'},401);session(res,found.id);user=found;
 }else if(url.pathname==='/api/logout'){if(token)run('DELETE FROM sessions WHERE token=?',token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');return send({ok:true});
 }else if(url.pathname==='/api/open'){
 const set=sets.find(s=>s.id===body.set);const packs=JSON.parse(user.packs);if(!set||!packs[set.id])return send({error:'You need a pack first. Visit the shop.'},400);
 const pool=cards.filter(c=>c.set===set.id);const pulled=Array.from({length:5},(_,i)=>{const roll=randomInt(1000);const rarity=i===4?(roll<30?'Legendary':roll<350?'Rare':'Uncommon'):(roll<10?'Legendary':roll<70?'Rare':roll<270?'Uncommon':'Common');const p=pool.filter(c=>c.rarity===rarity);return p[randomInt(p.length)];});
 const collection=JSON.parse(user.collection);for(const c of pulled)collection[c.id]=(collection[c.id]||0)+1;packs[set.id]--;run('UPDATE users SET packs=?,collection=?,opened=opened+1 WHERE id=?',JSON.stringify(packs),JSON.stringify(collection),user.id);return send({user:state(query('SELECT * FROM users WHERE id=?',user.id)),pulled});
 }else if(url.pathname==='/api/buy'){
 const set=sets.find(s=>s.id===body.set);if(!set||user.coins<set.price)return send({error:'Not enough coins. Claim your daily gift.'},400);const packs=JSON.parse(user.packs);packs[set.id]++;run('UPDATE users SET coins=coins-?,packs=? WHERE id=?',set.price,JSON.stringify(packs),user.id);
 }else if(url.pathname==='/api/daily'){
 const today=new Date().toISOString().slice(0,10);if(user.daily===today)return send({error:'Your gift is already claimed. Come back tomorrow!'},400);run('UPDATE users SET coins=coins+250,daily=? WHERE id=?',today,user.id);
 }else return send({error:'Not found'},404);
 return send({user:state(query('SELECT * FROM users WHERE id=?',user.id))});
 }
 let file=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\//,'');const base=path.resolve('public');const target=path.resolve(base,file);if(!target.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
 const data=await readFile(target);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[path.extname(target)]||'application/octet-stream');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");res.end(data);
 }catch(e){console.error(e);if(!res.headersSent)res.writeHead(e.code==='ENOENT'?404:500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.code==='ENOENT'?'Not found':'Something went wrong. Please try again.'}));}});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Sunday Cards listening on port '+(process.env.PORT||3000)));
