export const CATS={software:'Software',digital:'Digital',physical:'Physical',service:'Services',content:'Content',other:'Other'};
export const CAT_BG={software:['#3b5a3f','#1B2517'],digital:['#6b5a2e','#261f0e'],physical:['#6a3b2a','#26150f'],service:['#2d4b55','#14232a'],content:['#4a3b5c','#1d1626'],other:['#4b4a3a','#1e1d15']};
export const TYPES={
 commission:{name:'Commission',blurb:'Sell my product, keep a cut of every sale',fields:[['percent','Commission %',15],['cookie_days','Cookie days',30]],reward:t=>t.percent+'%',sub:t=>'of every sale'+(t.cookie_days?' · '+t.cookie_days+'-day cookie':''),unit:'sale'},
 attention:{name:'Attention',blurb:'Post to your audience, get paid per click or view',fields:[['rate_cents','Rate (cents)',5],['per','Paid per','click']],reward:(t,cur='USD')=>money(t.rate_cents||0,cur),sub:t=>'per '+t.per,unit:'click'},
 introduction:{name:'Introduction',blurb:'Introduce a buyer, share the contract',fields:[['share_percent','Your share %',10],['min_contract_cents','Min contract (cents)',2000000]],reward:t=>t.share_percent+'%',sub:(t,cur='USD')=>'of the contract'+(t.min_contract_cents?' · min '+money(t.min_contract_cents,cur):''),unit:'deal'}
};
export const SYM={USD:'$',EUR:'€',GBP:'£',NGN:'₦',GHS:'GH₵',KES:'KSh ',ZAR:'R'};
export const money=(c,cur='USD')=>(SYM[cur]||'$')+(c/100).toLocaleString(undefined,{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2});
export const FEE=500;
export const bgFor=p=>{const c=CAT_BG[p.category]||CAT_BG.other;return `linear-gradient(165deg,${c[0]},${c[1]})`};
export const initials=n=>String(n||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()||'?';
export const artFor=c=>({software:'dashboard',digital:'course',physical:'bottle',service:'service',content:'music',other:'service'}[c]||'service');
export const COUNTRIES=[['NG','Nigeria'],['GH','Ghana'],['KE','Kenya'],['ZA','South Africa'],['US','United States'],['GB','United Kingdom']];
export const PLATFORMS=[['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['x','X'],['linkedin','LinkedIn'],['facebook','Facebook'],['newsletter','Newsletter'],['whatsapp','WhatsApp'],['website','Website']];
export const ago=(t)=>{if(!t)return '';const d=new Date(t),n=new Date();if(d.toDateString()===n.toDateString())return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});const days=Math.round((n-d)/864e5);if(days<7)return d.toLocaleDateString([],{weekday:'short'});return d.toLocaleDateString([],{day:'numeric',month:'short'})};
export const day=(t)=>t?new Date(t).toLocaleDateString([],{day:'numeric',month:'short'}):'';
export const clock=(t)=>t?new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';

