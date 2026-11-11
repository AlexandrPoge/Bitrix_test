import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../web/data.js';
import { tenure, isEarly, summarize, insights, filterExits, validateExit, csv, validateState, validDate, experimentDefaults, validateExperiment, migrateState, compareReasons } from '../web/domain.js';

test('seed matches brief: 54 exits, 18 early, valid unique records', () => {
  const state=seed(); assert.equal(validateState(state),true);
  assert.equal(summarize(state.exits).total,54); assert.equal(summarize(state.exits).early,18); assert.equal(summarize(state.exits).earlyPercent,33);
});
test('90 day boundary uses calendar days and is exclusive',()=>{
  const r={hired:'2026-01-01',left:'2026-03-31'};assert.equal(tenure(r),89);assert.equal(isEarly(r),true);
  r.left='2026-04-01';assert.equal(tenure(r),90);assert.equal(isEarly(r),false);
});
test('insights expose evidence and require >=3 cases in same unit/reason',()=>{
  const s=insights(seed().exits);assert.equal(s.length,3);
  const schedule=s.find(i=>i.reason==='График');assert.equal(schedule.count,5);assert.equal(schedule.total,6);assert.equal(schedule.records.length,5);
  assert.equal(insights(schedule.records.slice(0,2)).length,0);
});
test('filters compose across period, unit, tenure, reason, search',()=>{
  const rows=filterExits(seed().exits,{unit:'Магазин «Центр»',early:true,reason:'График'});assert.equal(rows.length,5);
  assert.equal(filterExits(rows,{query:'demo-001'}).length,1);
  assert.equal(filterExits(rows,{period:'2026-07-01'}).length,0);
  assert.equal(summarize([]).earlyPercent,0);assert.equal(summarize([]).coverage,0);
});
test('invalid dates, future exits, invalid enums rejected',()=>{
  const r=seed().exits[0];assert.equal(validateExit(r),null);
  assert.ok(validateExit({...r,left:'2026-02-30'})); assert.ok(validateExit({...r,hired:'2026-11-11',left:'2026-01-01'}));
  assert.ok(validateExit({...r,left:'2027-01-01'}));assert.ok(validateExit({...r,source:'someone'}));assert.equal(validDate('2026-02-29'),false);
});
test('new record changes signal and analytics without hardcoded counts',()=>{
  const rows=seed().exits;const next={...rows[0],id:'new',code:'DEMO-055'};rows.push(next);
  assert.equal(summarize(rows).early,19);assert.equal(insights(rows).find(i=>i.reason==='График').count,6);
});
test('backup rejects duplicates, corrupt records and statuses',()=>{
  const state=seed();state.exits.push({...state.exits[0]});assert.equal(validateState(state),false);
  const s=seed();s.actions[0].status='Unknown';assert.equal(validateState(s),false);
  assert.equal(validateState({version:1,exits:[],actions:[null]}),false);
});
test('CSV quotes separators, newlines, quotes and neutralizes formulas',()=>{
  const r={...seed().exits[0],comment:'=HYPERLINK("bad");\nline'};const out=csv([r]);
  assert.ok(out.startsWith('\ufeff'));assert.ok(out.includes('"\'=HYPERLINK(""bad"");\nline"'));
});
test('backup rejects HTML in identifiers and mismatched evidence keys',()=>{
  const s=seed();s.exits[0].id='x" onclick="alert(1)';assert.equal(validateState(s),false);
  const a=seed();a.actions[0].key='Other|Something';assert.equal(validateState(a),false);
});
test('legacy migration preserves user content and adds editable pilot plan',()=>{
  const legacy=seed();legacy.version=1;legacy.actions[0].title='Моя задача';legacy.actions[0].due='2027-01-01';
  for(const field of Object.keys(experimentDefaults('Обучение')))delete legacy.actions[0][field];
  const updated=migrateState(legacy);assert.equal(updated.version,2);assert.equal(updated.actions[0].title,'Моя задача');
  assert.equal(updated.actions[0].cohortSize,5);assert.equal(updated.actions[0].reviewDate,'2027-01-01');
  assert.deepEqual(updated.exits,legacy.exits);assert.equal(validateState(updated),true);assert.equal(legacy.version,1);
});
test('experiment validates group size, sequence and evidence for outcome',()=>{
  const a={due:'2026-11-25',...experimentDefaults('График')};assert.equal(validateExperiment(a),null);
  for(const cohortSize of [0,101,2.5,NaN,'5'])assert.ok(validateExperiment({...a,cohortSize}));
  assert.ok(validateExperiment({...a,reviewDate:'2026-11-24'}));
  assert.ok(validateExperiment({...a,outcome:'Есть улучшение'}));
  assert.equal(validateExperiment({...a,outcome:'Недостаточно данных',resultNote:'Пока вышли только двое из пяти.'}),null);
});
test('version 2 backup must contain valid experiment data',()=>{
  const s=seed();s.actions[0].cohortSize=-3;assert.equal(validateState(s),false);
  assert.throws(()=>migrateState(s));
});
test('reason comparison uses separate group denominators and guards small samples',()=>{
  const c=compareReasons(seed().exits);assert.equal(c.earlyTotal,18);assert.equal(c.lateTotal,36);assert.equal(c.sufficient,true);
  const r=c.reasons.find(r=>r.reason==='График');assert.equal(r.earlyCount,5);assert.equal(r.earlyPercent,28);assert.equal(r.lateCount,0);assert.equal(r.latePercent,0);
  assert.equal(compareReasons(seed().exits.slice(0,18)).sufficient,false);assert.equal(compareReasons([]).sufficient,false);
});
test('demo schedule evidence has five different voices without changing counts',()=>{
  const rows=seed().exits.filter(r=>isEarly(r)&&r.reason==='График');assert.equal(rows.length,5);assert.equal(new Set(rows.map(r=>r.comment)).size,5);
});
