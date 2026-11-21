export const CATS={software:'Software',digital:'Digital',physical:'Physical',service:'Services'};
export const CAT_BG={software:['#3b5a3f','#1B2517'],digital:['#6b5a2e','#261f0e'],physical:['#6a3b2a','#26150f'],service:['#2d4b55','#14232a']};
export const TYPES={
 commission:{name:'Commission',blurb:'Sell my product, keep a cut of every sale',fields:[['percent','Commission %',15],['cookie_days','Cookie days',30]],reward:t=>t.percent+'%',sub:t=>'of every sale · '+t.cookie_days+'-day cookie',unit:'sale'},
 attention:{name:'Attention',blurb:'Post to your audience, get paid per click or view',fields:[['rate_cents','Rate (cents)',5],['per','Paid per','click']],reward:t=>'$'+(t.rate_cents/100).toFixed(2),sub:t=>'per '+t.per,unit:'click'},
 introduction:{name:'Introduction',blurb:'Introduce a buyer, share the contract',fields:[['share_percent','Your share %',10],['min_contract_cents','Min contract (cents)',2000000]],reward:t=>t.share_percent+'%',sub:t=>'of the contract · min $'+Math.round(t.min_contract_cents/100).toLocaleString(),unit:'deal'}
};
export const SYM={USD:'$',EUR:'€',GBP:'£',NGN:'₦',GHS:'GH₵',KES:'KSh ',ZAR:'R'};
export const money=(c,cur='USD')=>(SYM[cur]||'$')+(c/100).toLocaleString(undefined,{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2});
export const FEE=500;
export const ME={marketer:{id:'u-ada',handle:'ada.eats',name:'Ada Okafor',followers:4200,country:'NG',verified:true,socials:[['Instagram','@ada.eats',3100],['YouTube','Ada Eats Lagos',1100]]},
          seller:{id:'u-kofi',handle:'kofi.sauce',name:'Kofi Mensah',company:"Kofi's Hot Sauce",verified:true}};
export const PEOPLE={
 chidi:{name:'Chidi Eze',followers:2800,country:'NG',verified:true,socials:'Instagram @chidicooks · 2.8k'},
 mira:{name:'Mira Bello',followers:640,country:'GH',verified:false,socials:'TikTok @mirabites · 640'},
 zainab:{name:'Zainab Yusuf',followers:9100,country:'NG',verified:true,socials:'Instagram @zeeeats · 9.1k · YouTube Zee Kitchen · 4k'},
 tola:{name:'Tola Adebayo',followers:5400,country:'NG',verified:true,socials:'TikTok @tolacooks · 5.4k'},
 'u-ada':{name:'Ada Okafor',followers:4200,country:'NG',verified:true,socials:'Instagram @ada.eats · 3.1k · YouTube Ada Eats Lagos · 1.1k'}
};
export const seed=()=>({role:'marketer',tab:'deals',dtab:'chat',fc:'all',from:'feed',pf:null,n:20,gal:{},
 products:[
  {id:'p1',owner:'u-kofi',name:'Scotch Bonnet Hot Sauce',category:'physical',art:'bottle',gallery:['bottle'],url:'https://kofihotsauce.example',desc:'Small-batch scotch bonnet sauce made in Lagos.'},
  {id:'p7',owner:'u-kofi',name:'Pepper Masterclass',category:'digital',art:'course',gallery:['course'],video:'0:48',desc:'A video course on growing and fermenting peppers.'},
  {id:'p2',owner:'u-tunde',name:'Lagos Nights EP',category:'digital',art:'music',gallery:['music'],video:'0:30',desc:'A lo-fi EP for late nights.'},
  {id:'p3',owner:'u-pay',name:'PayrollPilot HR suite',category:'software',art:'dashboard',gallery:['dashboard','app'],video:'1:05',desc:'Payroll for African SMEs.'},
  {id:'p4',owner:'u-nia',name:'The Quiet Founder',category:'digital',art:'book',gallery:['book'],desc:'A short book on building slowly.'},
  {id:'p5',owner:'u-kix',name:'Kix Drop 04',category:'physical',art:'sneaker',gallery:['sneaker'],desc:'Limited sneaker drop.'},
  {id:'p6',owner:'u-notely',name:'Notely',category:'software',art:'app',gallery:['app','dashboard'],video:'0:42',desc:'A note app for busy people, on web and mobile.'}
 ],
 offers:[
  {id:'o1',pid:'p1',owner:'u-kofi',co:"Kofi's Hot Sauce",coV:true,title:"Sell Kofi's small-batch hot sauce",type:'commission',terms:{percent:15,cookie_days:30},req:{min_followers:1000,countries:['NG','GH'],verified_only:false},desc:'Share your link in your food groups, stories or newsletter and earn on every bottle that sells.',status:'open',max:10,likes:128,fin:{cur:'USD',budget:150000,cap:30000,funded:true,spent:42000}},
  {id:'o6',pid:'p6',owner:'u-notely',co:'Notely',coV:true,title:'Get people to try Notely',type:'commission',terms:{percent:25,cookie_days:60},req:{min_followers:2000,countries:[],verified_only:false},desc:'Review Notely for your audience. Earn 25% of every paid plan for the first year.',status:'open',max:40,likes:301,fin:{cur:'USD',budget:500000,cap:100000,funded:true,spent:118000}},
  {id:'o3',pid:'p3',owner:'u-pay',co:'PayrollPilot',coV:true,title:'Introduce PayrollPilot to finance teams',type:'introduction',terms:{share_percent:10,min_contract_cents:2000000},req:{min_followers:0,countries:[],verified_only:true},desc:'B2B payroll for African SMEs. Introduce a buyer, take 10% of the signed contract. Average deal is $50k.',status:'open',max:5,likes:57,fin:{cur:'USD',budget:2000000,cap:500000,funded:true,spent:0}},
  {id:'o2',pid:'p2',owner:'u-tunde',co:'Tunde Beats',coV:true,title:'Push the "Lagos Nights" lo-fi drop',type:'attention',terms:{rate_cents:4,per:'view'},req:{min_followers:2000,countries:[],verified_only:false},desc:'Post a clip or playlist feature to your audience and get paid for every verified view.',status:'open',max:25,likes:342,fin:{cur:'USD',budget:80000,cap:10000,funded:true,spent:21000}},
  {id:'o7',pid:'p7',owner:'u-kofi',co:"Kofi's Hot Sauce",coV:true,title:'Share the Pepper Masterclass',type:'commission',terms:{percent:40,cookie_days:45},req:{min_followers:500,countries:[],verified_only:false},desc:'A video course for home cooks. Earn 40% of every enrolment.',status:'open',max:30,likes:76,fin:{cur:'USD',budget:null,cap:null,funded:false,spent:0}},
  {id:'o4',pid:'p4',owner:'u-nia',co:'Nia Writes',coV:false,title:'Share "The Quiet Founder" with readers',type:'commission',terms:{percent:30,cookie_days:60},req:{min_followers:0,countries:[],verified_only:false},desc:'Recommend it to your readers or reading group and keep 30% of every copy sold.',status:'open',max:50,likes:89,fin:{cur:'USD',budget:null,cap:null,funded:false,spent:0}},
  {id:'o5',pid:'p5',owner:'u-kix',co:'Kix Lagos',coV:true,title:'Post our new sneaker drop',type:'attention',terms:{rate_cents:5000,per:'post'},req:{min_followers:50000,countries:['NG'],verified_only:true},desc:'We pay per post for creators with a large Nigerian audience.',status:'open',max:8,likes:210,fin:{cur:'NGN',budget:50000000,cap:5000000,funded:true,spent:0}}
 ],
 interests:[
  {id:'i1',offer:'o1',from:'chidi',msg:'I run a Lagos street-food group with 2.8k members. Spicy food is exactly their thing.',status:'pending'},
  {id:'i2',offer:'o1',from:'mira',msg:'I do food reviews in Accra. Would love to try the sauce first.',status:'pending'}
 ],
 deals:[
  {id:'d1',offer:'o4',marketer:'u-ada',status:'active',terms:{percent:30,cookie_days:60},since:'12 Nov',msgs:[{f:'u-nia',t:'Welcome Ada! Your link is live. Tell me if you need review copies.'},{f:'u-ada',t:'Thanks Nia. Posting to my reading group tonight.'}],dels:[{id:'x1',kind:'Social post',proof:'instagram.com/p/Cz8k2',status:'verified',amount:1200}]},
  {id:'d2',offer:'o1',marketer:'zainab',status:'active',terms:{percent:15,cookie_days:30},since:'9 Nov',msgs:[{f:'zainab',t:'Posted the reel! 14k views so far.'},{f:'u-kofi',t:'Looks great Zainab, verifying now.'}],dels:[{id:'x2',kind:'Creator video',proof:'zainab-reel.mp4',video:'0:45',by:'Zainab Yusuf',status:'pending',amount:null},{id:'x3',kind:'Social post',proof:'instagram.com/p/Dk3a1',status:'verified',amount:18000}]},
  {id:'d3',offer:'o6',marketer:'u-ada',status:'active',terms:{percent:25,cookie_days:60},since:'15 Nov',msgs:[{f:'u-notely',t:'Hi Ada, your Notely link is live. We can send a promo code for your followers.'},{f:'u-ada',t:'That would be great. I am filming a short review this week.'},{f:'u-notely',t:'Perfect. Code ADA20 gives 20% off the first month.'}],dels:[{id:'x6',kind:'Social post',proof:'instagram.com/p/Nt4k1',status:'verified',amount:4800},{id:'x7',kind:'Creator video',proof:'notely-review.mp4',video:'1:12',by:'Ada Okafor',status:'pending',amount:null}]},
  {id:'d4',offer:'o2',marketer:'u-ada',status:'paused',terms:{rate_cents:4,per:'view'},since:'2 Nov',msgs:[{f:'u-tunde',t:'Pausing for a week while we finish the next track.'},{f:'u-ada',t:'No problem, ping me when you are back.'}],dels:[{id:'x8',kind:'Social post',proof:'tiktok.com/@ada.eats/v/91',status:'verified',amount:2100}]},
  {id:'d5',offer:'o7',marketer:'tola',status:'active',terms:{percent:40,cookie_days:45},since:'17 Nov',msgs:[{f:'u-kofi',t:'Welcome Tola! Your course link is ready.'},{f:'tola',t:'Thanks! Posting a teaser tomorrow.'}],dels:[]},
 ]});

export const prodOf=(S,id)=>S.products.find(p=>p.id===id);
export const offerOf=(S,id)=>S.offers.find(o=>o.id===id);
export const elig=(o)=>{const r=o.req,m=ME.marketer,res=[];
 if(r.min_followers)res.push({ok:m.followers>=r.min_followers,t:r.min_followers.toLocaleString()+'+ followers',you:'You have '+m.followers.toLocaleString()});
 if(r.countries.length)res.push({ok:r.countries.includes(m.country),t:'Based in '+r.countries.join(' / '),you:'You are in '+m.country});
 if(r.verified_only)res.push({ok:m.verified,t:'Verified marketer',you:m.verified?'You are verified':'Not verified'});
 return {ok:res.every(x=>x.ok),res}};
export const bgFor=p=>`linear-gradient(165deg,${CAT_BG[p.category][0]},${CAT_BG[p.category][1]})`;
export const initials=n=>String(n).split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
export const artFor=c=>({software:'dashboard',digital:'course',physical:'bottle',service:'service'}[c]);
