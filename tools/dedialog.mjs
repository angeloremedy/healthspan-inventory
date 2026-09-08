// One-off codemod (2026-09-08): browser prompt()/confirm()/alert() → in-app
// uiPrompt/uiConfirm/uiAlert (js/00-dialogs.js). prompt/confirm become awaited,
// and every function that now awaits is marked async. Prints the functions it made
// async so their callers can be checked for synchronous use of the return value.
//   node tools/dedialog.mjs            (rewrites js/*.js in place)
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
const files = fs.readdirSync('js').filter(f => /^\d\d-.*\.js$/.test(f) && !f.startsWith('00-')).sort();
const madeAsync = {};
for (const f of files) {
  const p = 'js/' + f; let src = fs.readFileSync(p, 'utf8');
  let ast;
  try { ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'script', locations: true, allowAwaitOutsideFunction: true }); }
  catch (e) { console.error(f, 'parse failed', e.message); continue; }
  const edits = []; // {pos, insert} or {start,end,text}
  const asyncFns = new Set();
  const isFn = n => n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression';
  walk.fullAncestor(ast, (node, state, ancestors) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return;
    const name = node.callee.name;
    if (!['prompt', 'confirm', 'alert'].includes(name)) return;
    if (name === 'alert') { edits.push({ start: node.callee.start, end: node.callee.end, text: 'uiAlert' }); return; }
    edits.push({ start: node.callee.start, end: node.callee.end, text: (name === 'prompt' ? 'uiPrompt' : 'uiConfirm') });
    // await, unless already awaited
    const parent = ancestors[ancestors.length - 2];
    if (!(parent && parent.type === 'AwaitExpression')) edits.push({ start: node.start, end: node.start, text: 'await ' });
    // enclosing function → async
    for (let i = ancestors.length - 2; i >= 0; i--) { const a = ancestors[i]; if (isFn(a)) { if (!a.async) asyncFns.add(a); break; } }
  });
  for (const fn of asyncFns) {
    let at = fn.start;
    if (fn.type === 'FunctionExpression' && fn.start !== undefined) {
      // method shorthand `name(){}` or getter — find the parent Property; acorn gives the FunctionExpression starting at '(' for methods
      const ch = src[fn.start];
      if (ch === '(') { /* method shorthand: async goes before the key — handled via property below */ }
    }
    edits.push({ start: at, end: at, text: 'async ', fn });
    const name = fn.id ? fn.id.name : '(anonymous ' + f + ':' + fn.loc.start.line + ')';
    (madeAsync[f] = madeAsync[f] || []).push(name);
  }
  // method shorthand fix: FunctionExpression whose src[start]=='(' belongs to a Property/MethodDefinition; move 'async ' before the key
  const props = [];
  walk.fullAncestor(ast, (node, st, anc) => { if ((node.type === 'Property' && node.method) || node.type === 'MethodDefinition') props.push(node); });
  for (const e of edits) {
    if (e.fn && src[e.fn.start] === '(') { const pr = props.find(pp => pp.value === e.fn); if (pr) { e.start = e.end = pr.key.start; } }
  }
  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  for (const e of edits) src = src.slice(0, e.start) + e.text + src.slice(e.end);
  fs.writeFileSync(p, src);
  console.log(f, 'edits', edits.length, 'async', asyncFns.size);
}
console.log('\nFunctions made async (check callers that use the return value synchronously):');
for (const f of Object.keys(madeAsync)) console.log(' ', f, '→', madeAsync[f].join(', '));
