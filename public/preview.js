import {cards,sets} from './catalog.js';
const key='sunday-cards-preview-v1';
function load(){const saved=localStorage.getItem(key);if(saved)return JSON.parse(saved);return {id:'preview',name:'Preview collector',registered:false,coins:500,packs:{frontiers:3,woodland:0,midnight:0},collection:{},opened:0,daily:null};}
export async function previewApi(route,body={}){
 const user=load();let pulled;
 if(route==='open'){
 const set=sets.find(s=>s.id===body.set);if(!set||!user.packs[set.id])throw Error('You need a pack first. Visit the shop.');
 pulled=Array.from({length:5},(_,i)=>{const roll=Math.random()*1000;const rarity=i===4?(roll<30?'Legendary':roll<350?'Rare':'Uncommon'):(roll<10?'Legendary':roll<70?'Rare':roll<270?'Uncommon':'Common');const pool=cards.filter(c=>c.set===set.id&&c.rarity===rarity);return pool[Math.floor(Math.random()*pool.length)];});
 user.packs[set.id]--;user.opened++;for(const c of pulled)user.collection[c.id]=(user.collection[c.id]||0)+1;
 }else if(route==='buy'){
 const set=sets.find(s=>s.id===body.set);if(!set||user.coins<set.price)throw Error('Not enough coins. Claim your daily gift.');user.coins-=set.price;user.packs[set.id]++;
 }else if(route==='daily'){
 const today=new Date().toISOString().slice(0,10);if(user.daily===today)throw Error('Your gift is already claimed. Come back tomorrow!');user.daily=today;user.coins+=250;
 }else if(route!=='state')throw Error('Accounts are available in the server app. This preview saves only in this browser.');
 localStorage.setItem(key,JSON.stringify(user));return {user,cards,sets,pulled,preview:true};
}
