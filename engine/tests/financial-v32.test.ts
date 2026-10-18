import {describe,it,expect} from 'vitest';
import {projectFinancial,presetInput,employerMpf,corporateTax,migrateFinancial} from '../lib/calc/financial';
import {simulateRunway} from '../lib/calc/runway';
import {profileToRunway} from '../lib/engine/engine';
import {demoStartup} from '../data/demo';
describe('v3.2 financial model',()=>{
  it('reconciles profit, cash and working capital for both industries and payment assumptions',()=>{
    for(const id of ['tech_saas','professional_services'])for(const collectionDays of [0,15,30,45,90])for(const taxPaidMonth12 of [false,true]){
      const p=projectFinancial({...presetInput(id),monthlyRevenue:180000,collectionDays,taxPaidMonth12,hireCount:2});
      expect(p.rows).toHaveLength(12);expect(Math.abs(p.balanceSheet.reconciliationError)).toBeLessThan(.001);
      expect(p.balanceSheet.retainedEarnings).toBeCloseTo(p.rows.reduce((s,r)=>s+r.netIncome,0)-p.input.setupCost,5);
      expect(p.rows[11].cashEnd).toBeCloseTo(p.input.capital-p.input.setupCost+p.rows.reduce((s,r)=>s+r.cashMovement,0),5);
    }
  });
  it('marks an insolvent opening and reports full-horizon conditional results without fake month12 labels',()=>{
    const p=projectFinancial({...presetInput(),capital:10000});expect(p.firstDepletion).toBe(0);expect(p.runwayMonths).toBe(0);expect(p.rows[11].month).toBe(12);expect(p.rows.every(r=>r.conditional)).toBe(true);expect(p.fundingGap).toBeGreaterThan(0);
  });
  it('separates EBITDA from taxes and tax payments',()=>{
    const a=projectFinancial({...presetInput(),monthlyRevenue:300000,taxPaidMonth12:false});
    const b=projectFinancial({...presetInput(),monthlyRevenue:300000,taxPaidMonth12:true});
    expect(a.rows[11].ebitda).toBe(b.rows[11].ebitda);expect(a.rows[11].netIncome).toBe(b.rows[11].netIncome);
    expect(a.endingCash-b.endingCash).toBeCloseTo(a.balanceSheet.taxPayable,5);expect(b.balanceSheet.taxPayable).toBe(0);
  });
  it('honours actual collection timing instead of treating revenue as cash',()=>{
    const a=projectFinancial({...presetInput(),collectionDays:0});const b=projectFinancial({...presetInput(),collectionDays:60});
    expect(b.rows[0].collections).toBe(0);expect(b.rows[1].collections).toBe(0);expect(b.rows[2].collections).toBeCloseTo(b.rows[0].revenue,5);expect(a.totalRevenue).toBe(b.totalRevenue);expect(b.endingCash).toBeLessThan(a.endingCash);
  });
  it('charges each planned employee only from their start month with capped MPF',()=>{
    const p=projectFinancial({...presetInput(),hireMonth:7,hireCount:2,hireSalary:40000});
    expect(p.rows[5].labour).toBe(20000);expect(p.rows[6].labour).toBe(100000);expect(p.rows[6].mpf).toBe(4000);expect(employerMpf(100000)).toBe(1500);
  });
  it('shares the identical projection with Black Swan when there are no events',()=>{
    const finance=presetInput();const profile={...demoStartup,finance};const a=projectFinancial(finance);const b=simulateRunway(profileToRunway(profile),[],[],12);
    expect(b.rows.map(r=>r.cashEnd)).toEqual(a.rows.map(r=>r.cashEnd));expect(b.financial?.fundingGap).toBe(a.fundingGap);
  });
  it('makes disrupted delivery visible and models recovery after replacement',()=>{
    const input={...presetInput(),staffCount:2};const ev=[{month:3,effects:{headcountDelta:-1,devSpeedMultiplier:.6}}];
    const a=projectFinancial(input,ev);const b=projectFinancial(input,ev,[{month:3,changes:{headcount:3}}]);
    expect(a.totalLostRevenue).toBeGreaterThan(0);expect(b.rows[4].capacity).toBe(1);expect(a.rows[4].capacity).toBeLessThan(1);
  });
  it('rejects impossible numeric inputs',()=>{
    for(const changes of [{capital:NaN},{hireCount:-1},{hireMonth:0},{collectionDays:91},{cogsRate:2},{price:0},{staffCount:2.5}])expect(()=>projectFinancial({...presetInput(),...changes})).toThrow();
  });
  it('preserves existing cash during migration and keeps forecast calls pure',()=>{
    const p=migrateFinancial(demoStartup);expect(p.capital).toBe(demoStartup.cash);expect(p.setupCost).toBe(0);
    const before=JSON.stringify(p);expect(projectFinancial(p)).toEqual(projectFinancial(p));expect(JSON.stringify(p)).toBe(before);
  });
  it('computes two-tier tax and never uses average burn beyond the horizon',()=>{
    expect(corporateTax(3000000)).toBe(330000);expect(corporateTax(-50)).toBe(0);
    const p=projectFinancial({...presetInput(),capital:10000000});expect(p.runwayMonths).toBeNull();expect(p.firstDepletion).toBeNull();
  });
});

it('does not confuse twelve-month survival with a profit',()=>{
  const finance={...presetInput(),capital:10000000,monthlyRevenue:0,growth:0};
  const out=simulateRunway({...profileToRunway(demoStartup),finance},[],[],12);
  expect(out.financial!.firstDepletion).toBe(null);
  expect(out.financial!.totalProfit).toBeLessThan(0);
  expect(Number.isFinite(out.runwayMonths)).toBe(true);
});

it('does not reprice planned hires when the headcount decision is unchanged',()=>{
  const input={...presetInput(),staffCount:2,staffSalary:22000,hireMonth:7,hireCount:1,hireSalary:40000};
  const baseline=projectFinancial(input);
  const after=projectFinancial(input,[],[{month:9,changes:{headcount:4}}]);
  expect(after.rows[8].labour).toBe(baseline.rows[8].labour);
  expect(after.rows[8].mpf).toBe(baseline.rows[8].mpf);
});
