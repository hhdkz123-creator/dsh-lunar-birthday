import lunar from './vendor/lunar.cjs';
const { Solar, Lunar } = lunar;
export const MONTHS = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
export const DAYS = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
export function cleanBirthday(value) {
  if (!value || !['solar','lunar'].includes(value.calendar) || !Number.isInteger(value.month) || !Number.isInteger(value.day) || typeof value.leap !== 'boolean') throw new Error('请选择有效的生日类型、月份、日期和闰月');
  const {calendar,month,day,leap}=value;
  if (month<1 || month>12 || day<1 || day>(calendar==='lunar'?30:31) || (calendar==='solar' && leap)) throw new Error('生日日期无效');
  if (calendar==='solar') { const d=new Date(Date.UTC(2000,month-1,day)); if(d.getUTCMonth()+1!==month || d.getUTCDate()!==day) throw new Error('公历日期不存在'); }
  return {calendar,month,day,leap};
}
export function localDate(now=new Date(), zone='Asia/Shanghai') {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23',minute:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {year:+parts.year,month:+parts.month,day:+parts.day,hour:+parts.hour,minute:+parts.minute,iso:`${parts.year}-${parts.month}-${parts.day}`};
}
export function isBirthday(date,birthday) {
  if(!birthday) return false;
  const b=cleanBirthday(birthday);
  if(b.calendar==='solar') return date.month===b.month && date.day===b.day;
  const l=Solar.fromYmd(date.year,date.month,date.day).getLunar();
  return Math.abs(l.getMonth())===b.month && l.getDay()===b.day && (l.getMonth()<0)===b.leap;
}
export function nextBirthday(birthday,today) {
  if(!birthday) return null;
  const b=cleanBirthday(birthday);
  for(let year=today.year-(b.calendar==='lunar'?1:0);year<=today.year+100;year++) {
    try {
      let iso;
      if(b.calendar==='lunar') {
        const l=Lunar.fromYmd(year,b.leap?-b.month:b.month,b.day),s=l.getSolar(),back=s.getLunar();
        if(back.getYear()!==year || back.getMonth()!==(b.leap?-b.month:b.month) || back.getDay()!==b.day) continue;
        iso=s.toYmd();
      } else {
        const d=new Date(Date.UTC(year,b.month-1,b.day));
        if(d.getUTCMonth()+1!==b.month || d.getUTCDate()!==b.day) continue;
        iso=`${year}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}`;
      }
      if(iso>=today.iso) return iso;
    } catch { /* Short months and absent leap months skip the year. */ }
  }
  return null;
}
export function birthdayLabel(birthday) {
  if(!birthday) return '未设置生日';
  const b=cleanBirthday(birthday);
  return b.calendar==='lunar'?`农历${b.leap?'闰':''}${MONTHS[b.month-1]}${DAYS[b.day-1]}`:`公历${b.month}月${b.day}日`;
}
export function isQuiet(config,now) {
  const q=config.quiet;
  if(!q?.enabled) return false;
  const minute=now.hour*60+now.minute,start=q.start*60,end=q.end*60;
  return start===end || (start<end ? minute>=start && minute<end : minute>=start || minute<end);
}
