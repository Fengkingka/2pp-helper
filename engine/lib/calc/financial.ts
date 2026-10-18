/** Versioned educational service-business model. Cash and profit reconcile; no plug equity. */
import presetsData from '../../data/startup-presets.json';
import type { MonthEvent, MonthDecision, RunwayResult, RunwayState } from './runway';
export interface FinancialInput {
  presetId: string; capital: number; setupCost: number; monthlyRevenue: number;
  founderSalary: number; staffCount: number; staffSalary: number; hireMonth: number; hireCount: number; hireSalary: number;
  rent: number; serverCost: number; marketing: number; otherCost: number; cogsRate: number;
  growth: number; growthDecay: number; churn: number; collectionDays: number; paymentDays: number; annualFees: number; price: number;
  founderEmployee: boolean; taxPaidMonth12: boolean;
}
export const financialPresets = presetsData;
export function presetInput(id = 'tech_saas'): FinancialInput {
  const p = presetsData.presets.find(x => x.id === id) || presetsData.presets[0];
  const { id: presetId, name, nameEn, ...input } = p;
  return { ...input, presetId };
}
export function migrateFinancial(profile: any): FinancialInput {
  if (profile?.finance) return { ...profile.finance };
  const p = presetInput();
  if (!profile) return p;
  // Existing cash is already available cash: never deduct setup twice during migration.
  return { ...p, presetId: 'custom', setupCost: 0, capital: profile.cash ?? p.capital, monthlyRevenue: profile.monthlyRevenue ?? p.monthlyRevenue,
    founderSalary: profile.avgSalary ?? p.founderSalary, staffCount: Math.max(0, (profile.headcount ?? 1) - 1), staffSalary: profile.avgSalary ?? p.staffSalary,
    rent: 0, serverCost: profile.serverCost ?? 0, marketing: profile.marketing ?? 0, otherCost: profile.otherCost ?? 0,
    cogsRate: 0, collectionDays: 0, paymentDays: 0, annualFees: 0, price: profile.price || p.price };
}
export function validateFinancial(p: FinancialInput) {
  for (const [k,v] of Object.entries(p)) {
    if (typeof v === 'number' && (!Number.isFinite(v) || v < 0 || v > 1e9)) throw new RangeError('Invalid ' + k);
  }
  const required = Object.keys(presetInput()).filter(k => typeof (presetInput() as any)[k] === 'number');
  for (const k of required) if (typeof (p as any)[k] !== 'number') throw new RangeError('Missing ' + k);
  for (const k of ['cogsRate','growth','growthDecay','churn'] as const) if (p[k] > 1) throw new RangeError('Invalid rate ' + k);
  if (p.price <= 0 || p.collectionDays > 90 || p.paymentDays > 90 || p.hireMonth < 1 || p.hireMonth > 12 || !Number.isInteger(p.hireMonth)) throw new RangeError('Invalid timing or price');
  if (![p.staffCount,p.hireCount].every(v => Number.isInteger(v) && v <= 29) || p.staffCount + p.hireCount > 29) throw new RangeError('Maximum 30 people including founder');
  if (typeof p.founderEmployee !== 'boolean' || typeof p.taxPaidMonth12 !== 'boolean') throw new RangeError('Invalid employment or tax assumption');
}
export const employerMpf = (salary: number) => Math.min(Math.max(0, salary) * 0.05, 1500);
export const corporateTax = (profit: number) => Math.max(0, Math.min(profit, 2000000)) * 0.0825 + Math.max(0, profit-2000000) * 0.165;
function due(series: number[], monthIndex: number, days: number) {
  const delay = days / 30, full = Math.floor(delay), part = delay-full;
  return (series[monthIndex-full] || 0)*(1-part) + (series[monthIndex-full-1] || 0)*part;
}
export function projectFinancial(input: FinancialInput, events: MonthEvent[] = [], decisions: MonthDecision[] = []) {
  validateFinancial(input);
  const p = { ...input };
  const rows: any[] = [], revenueSeries: number[] = [], cogsSeries: number[] = [];
  let cash = p.capital-p.setupCost, retained = -p.setupCost, paidIn = p.capital, ar=0, ap=0, taxPayable=0, taxableProfit=0;
  let demand=p.monthlyRevenue, headcount=1+p.staffCount, staffSalary=p.staffSalary, server=p.serverCost, marketing=p.marketing, other=p.otherCost, price=p.price;
  let dev=1, recoverAt=0, churn=p.churn, firstDepletion: number|null = cash<=0 ? 0:null, runway: number|null = cash<=0?0:null, breakeven: number|null=null;
  const roster = [{ role:'Founder', salary:p.founderSalary, startMonth:1, count:1 }, ...(p.staffCount ? [{role:'Initial team',salary:p.staffSalary,startMonth:1,count:p.staffCount}]:[]), ...(p.hireCount ? [{role:'Planned hires',salary:p.hireSalary,startMonth:p.hireMonth,count:p.hireCount}]:[])];
  let hired = false, recurringStaff = p.staffCount, hires = 0;
  for (let m=1;m<=12;m++) {
    let externalCash=0, oneOffCost=0, eventIncome=0;
    if (m===p.hireMonth && !hired) { headcount+=p.hireCount; hires=p.hireCount; hired=true; }
    for (const e of events.filter(x=>x.month===m)) {
      const f=e.effects;
      if (f.serverCostMultiplier!==undefined) server*=Math.max(0,f.serverCostMultiplier);
      if (f.revenueMultiplier!==undefined) demand*=Math.max(0,f.revenueMultiplier);
      if (f.churnDelta!==undefined) churn=Math.min(1,Math.max(0,churn+f.churnDelta));
      if (f.headcountDelta!==undefined) { headcount=Math.max(1,headcount+f.headcountDelta); hires=Math.min(hires,headcount-1); recurringStaff=Math.max(0,headcount-1-hires); }
      if (f.devSpeedMultiplier!==undefined) {dev*=Math.max(0,Math.min(1,f.devSpeedMultiplier));recoverAt=0;}
      if ((f.cashDelta||0)>=0) eventIncome+=f.cashDelta||0; else oneOffCost-=f.cashDelta||0;
    }
    for (const d of decisions.filter(x=>x.month===m)) {
      const c=d.changes;
      if (c.headcount!==undefined) {if(c.headcount>headcount && dev<1)recoverAt=m+2;headcount=Math.max(1,Math.min(30,Math.round(c.headcount)));hires=Math.min(hires,headcount-1);recurringStaff=Math.max(0,headcount-1-hires);}
      if(c.avgSalary!==undefined)staffSalary=Math.max(0,c.avgSalary);
      if(c.serverCost!==undefined)server=Math.max(0,c.serverCost);
      if(c.marketing!==undefined)marketing=Math.max(0,c.marketing);
      if(c.otherCost!==undefined)other=Math.max(0,c.otherCost);
      if(c.price!==undefined && c.price>0) {const ratio=c.price/price;demand*=ratio;if(ratio>1)churn=Math.min(1,churn+0.05*(ratio-1));price=c.price;}
      if(d.bridgeRound)externalCash+=Math.max(0,d.bridgeRound);
    }
    if(recoverAt && m>=recoverAt){dev=1;recoverAt=0;}
    const capacity=Math.min(1,headcount/(1+p.staffCount))*dev;
    const revenue=Math.max(0,demand*capacity), lostRevenue=Math.max(0,demand-revenue), cogs=revenue*p.cogsRate;
    const labour=p.founderSalary+recurringStaff*staffSalary+hires*p.hireSalary;
    const mpf=(p.founderEmployee?employerMpf(p.founderSalary):0)+recurringStaff*employerMpf(staffSalary)+hires*employerMpf(p.hireSalary);
    const fees=m===12?p.annualFees:0;
    const opex=labour+mpf+p.rent+server+marketing+other+fees+oneOffCost;
    const ebitda=revenue-cogs-opex+eventIncome;
    taxableProfit+=ebitda;
    const taxLiability=corporateTax(taxableProfit), taxExpense=taxLiability-taxPayable;
    taxPayable=taxLiability;
    const netIncome=ebitda-taxExpense;
    revenueSeries.push(revenue);cogsSeries.push(cogs);
    const collections=due(revenueSeries,m-1,p.collectionDays), supplierPayments=due(cogsSeries,m-1,p.paymentDays);
    ar+=revenue-collections;ap+=cogs-supplierPayments;
    const taxPaid=m===12 && p.taxPaidMonth12?taxPayable:0;
    const cashMovement=collections-supplierPayments-opex-taxPaid+externalCash+eventIncome;
    const openingCash=cash;cash+=cashMovement;paidIn+=externalCash;retained+=netIncome;taxPayable-=taxPaid;
    if(firstDepletion===null && cash<=0) {firstDepletion=m;runway=Math.max(0,m-1+openingCash/(openingCash-cash));}
    if(breakeven===null && ebitda>=0)breakeven=m;
    rows.push({month:m,revenue,cogs,grossProfit:revenue-cogs,labour,mpf,rent:p.rent,marketing,otherCost:other,serverCost:server,fees,oneOffCost,eventIncome,opex,ebitda,taxExpense,netIncome,collections,supplierPayments,taxPaid,externalCash,cashMovement,cashEnd:cash,headcount,staffSalary,price,capacity,lostRevenue,ar,ap,taxPayable,retained,paidIn,conditional:firstDepletion!==null});
    const marketingEffect=p.marketing>0?Math.min(2,Math.sqrt(marketing/p.marketing)):1;
    const growth=p.growth*Math.pow(p.growthDecay,m-1)*marketingEffect*Math.sqrt(headcount/(1+p.staffCount));
    demand=Math.max(0,demand*(1+growth-churn));
  }
  const last=rows[11];
  const assets=last.cashEnd+last.ar, liabilities=last.ap+last.taxPayable, equity=paidIn+retained;
  const fundingGap=Math.max(0,...rows.map(r=>-r.cashEnd),p.setupCost-p.capital);
  return {version:1,input:{...input},rows,roster,firstDepletion,runwayMonths:runway,minimumCash:Math.min(p.capital-p.setupCost,...rows.map(r=>r.cashEnd)),fundingGap,
    firstOperatingSurplusMonth:breakeven,endingCash:cash,endingRevenue:last.revenue,totalLostRevenue:rows.reduce((s,r)=>s+r.lostRevenue,0),
    totalRevenue:rows.reduce((s,r)=>s+r.revenue,0),totalProfit:retained,
    balanceSheet:{cash:last.cashEnd,receivables:last.ar,assets,payables:last.ap,taxPayable:last.taxPayable,liabilities,paidInCapital:paidIn,retainedEarnings:retained,equity,reconciliationError:assets-liabilities-equity},
    assumptionVersion:presetsData.version};
}
/** Adapter preserves the Black Swan UI/report contract while using the same finance model. */
export function financialRunway(state: RunwayState, events: MonthEvent[], decisions: MonthDecision[], months: number): RunwayResult {
  const input = {...state.finance!};
  const p = projectFinancial(input,events,decisions), count=Math.min(12,Math.max(1,months));
  const rows=p.rows.slice(0,count).map(r=>({month:r.month,revenue:r.revenue,cost:r.cogs+r.opex,net:r.cashMovement,cashEnd:r.cashEnd,headcount:r.headcount,growthRate:input.growth,churn:input.churn,devSpeed:r.capacity}));
  const bankrupt=p.firstDepletion!==null && p.firstDepletion<=count;
  const last=p.rows[count-1], operatingCash=last.cashMovement-last.externalCash;
  // Legacy contract: remaining months at the final month's cash use, not survival or profit.
  const remaining=bankrupt?0:operatingCash>=0?Infinity:last.cashEnd/-operatingCash;
  return {rows,bankruptMonth:bankrupt?Math.max(1,p.firstDepletion!):null,endingCash:last.cashEnd,runwayMonths:remaining,outcome:bankrupt?'bankrupt':'survived',financial:p};
}
