import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../web/data.js';
import { tenure, isEarly, summarize, insights, filterExits, validateExit, csv, validateState, validDate } from '../web/domain.js';

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
