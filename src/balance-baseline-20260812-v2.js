(() => {
  const PROFILE_KEY='ticket.active-profile.v2';
  const BASE_KEY='ticket.balance-settings.v1';
  const DATE='2026-08-12';
  const MINUTES=690;
  const MARK='ticket.balance.official.20260812.v2';
  const safe=v=>String(v||'default').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||'default';
  function apply(){
    let p=null;try{p=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{}
    if(!p)return false;
    const ns=safe(p.id||p.cpfHash?.slice(0,24)||'default');
    const key=`${BASE_KEY}.${ns}`;
    const mark=`${MARK}.${ns}`;
    let cur={};try{cur=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
    if(Number(cur.minutes)!==MINUTES||cur.referenceDate!==DATE){
      const updatedAt=new Date().toISOString();
      const history=Array.isArray(cur.history)?cur.history.filter(x=>x?.id!=='baseline-20260812-official'):[];
      localStorage.setItem(key,JSON.stringify({...cur,minutes:MINUTES,type:'positive',referenceDate:DATE,note:'Saldo oficial do banco de horas: +11h30 até 12/08/2026.',history:[...history,{id:'baseline-20260812-official',minutes:MINUTES,type:'positive',referenceDate:DATE,note:'Saldo oficial da empresa: +11h30 até 12/08/2026.',updatedAt}],updatedAt}));
      localStorage.setItem(mark,'1');
      if(sessionStorage.getItem(mark)!=='1'){sessionStorage.setItem(mark,'1');setTimeout(()=>location.reload(),80)}
    }
    return true;
  }
  if(!apply()){let n=0;const t=setInterval(()=>{n++;if(apply()||n>60)clearInterval(t)},500)}
})();