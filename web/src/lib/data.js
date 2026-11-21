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
export const artFor=c=>KINDS.find(x=>x[0]===c)?.[3]||({software:'dashboard',digital:'course',physical:'bottle',service:'service',content:'music',other:'service'}[c]||'service');
export const COUNTRIES=[['NG','Nigeria'],['GH','Ghana'],['KE','Kenya'],['ZA','South Africa'],['US','United States'],['GB','United Kingdom']];
export const PLATFORMS=[['instagram','Instagram'],['tiktok','TikTok'],['youtube','YouTube'],['x','X'],['linkedin','LinkedIn'],['facebook','Facebook'],['newsletter','Newsletter'],['whatsapp','WhatsApp'],['website','Website']];
export const ago=(t)=>{if(!t)return '';const d=new Date(t),n=new Date();if(d.toDateString()===n.toDateString())return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});const days=Math.round((n-d)/864e5);if(days<7)return d.toLocaleDateString([],{weekday:'short'});return d.toLocaleDateString([],{day:'numeric',month:'short'})};
export const day=(t)=>t?new Date(t).toLocaleDateString([],{day:'numeric',month:'short'}):'';
export const clock=(t)=>t?new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';


// what someone is listing. Each kind is stored as products.details.kind and filed under one of the API's categories.
// [key, name, examples, art, category, detail fields]
export const KINDS=[
 ['physical','Physical product','Makeup, gadgets, fashion, food','bottle','physical',[['price','Price','money']]],
 ['software','Software','SaaS, mobile apps, browser extensions','dashboard','software',[['pricing','Pricing','pick',['Free','Freemium','Paid','Free trial']]]],
 ['ebook','Ebook','Guides, books, workbooks','book','digital',[['price','Price','money'],['pages','Pages','number']]],
 ['course','Course','Video courses, cohorts, workshops','course','digital',[['price','Price','money'],['lessons','Lessons','number']]],
 ['newsletter','Newsletter','Free or paid email newsletters','newsletter','content',[['subscribers','Subscribers','number'],['cadence','How often','pick',['Daily','Weekly','Monthly']]]],
 ['playlist','Playlist or music','Spotify, Apple Music, SoundCloud','music','content',[['platform','Where it lives','pick',['Spotify','Apple Music','YouTube Music','SoundCloud']],['followers','Followers','number']]],
 ['service','Service','Coaching, design, agencies','service','service',[['price','Starting price','money']]],
 ['other','Something else','Anything that does not fit above','spark','other',[]],
];
export const kindOf=(k)=>KINDS.find(x=>x[0]===k)||KINDS[KINDS.length-1];
export const kindFromCategory=(c)=>({physical:'physical',software:'software',digital:'ebook',content:'newsletter',service:'service'}[c]||'other');
// what the seller wants the community to do (an offer type)
export const GOALS=[
 ['attention','Get me attention','Creators post about it and send people your way. You pay per click, view or post.','Share','e.g. a TikTok about your app, a story with your link'],
 ['commission','Sell it for me','Creators sell it with their own link. You pay a cut of each sale.','Wallet','e.g. 15% of every order they bring in'],
 ['introduction','Introduce me to buyers','Creators connect you with a company that needs it. You share the contract.','Me','e.g. 10% of a signed deal'],
];
