// Mock of the Cloudflare function so the app can be tested without an API key.
// Serves public/index.html at http://localhost:8787 and answers /api/chat with canned SSE:
//   'plan' in the message -> a tool_use round (add_study_block), JSON-mode -> a fake deck / test, image -> a fake deck.
// Run: node dev/mock.js   (leave it running, then run the tests in another terminal)
const http = require('http'), fs = require('fs');
const sse = (res, events) => { res.writeHead(200, {'content-type':'text/event-stream'}); let i=0; const tick=()=>{ if(i>=events.length){ res.end(); return; } const e=events[i++]; res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`); setTimeout(tick, 15); }; tick(); };
const textEvents = t => { const ev=[{type:'message_start'},{type:'content_block_start',index:0,content_block:{type:'text',text:''}}]; for (const w of t.match(/.{1,12}/g)) ev.push({type:'content_block_delta',index:0,delta:{type:'text_delta',text:w}}); ev.push({type:'content_block_stop',index:0},{type:'message_delta',delta:{stop_reason:'end_turn'}},{type:'message_stop'}); return ev; };
let calls = [];
// fake Canvas Calendar Feed, dates relative to now so it never goes stale. GET /canvas-move shifts one due date (tests sync).
let moved = false, failNext = 0;
const icsT = (days, h, m) => { const d = new Date(); d.setDate(d.getDate()+days); d.setHours(h, m, 0, 0); return d.toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''); };
const icsD = days => { const d = new Date(); d.setDate(d.getDate()+days); return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`; };
const feed = () => { const ev = [
  ['event-assignment-101', icsT(-3,23,59), 'Unit 2 Discussion [26FA World Religions PHI120-303]', 'assignment_101'],
  ['event-assignment-102', icsT(0,22,59), '1.8 - Variables and Expressions [26FA Beginning Algebra MTH095-012]', 'assignment_102'],
  ['event-assignment-103', icsT(1,23,59), 'Unit 5 Discussion: Ask Dr. S anything about the reading this week, reply to two classmates [26FA World Religions PHI120-303]', 'assignment_103'],
  ['event-assignment-104', icsT(moved?9:4,10,0), 'Chapter 5 MC Quiz [26FA World Religions PHI120-303]', 'assignment_104'],
  ['event-assignment-105', icsT(8,23,59), 'Rhetorical Analysis Essay\\, final draft [26FA Composition I COM101-033]', 'assignment_105'],
  ['event-calendar-event-201', 'VALUE=DATE:'+icsD(2), 'Start Unit 6 [26FA World Religions PHI120-303]', 'calendar_event_201'],
  ['event-assignment-106', icsT(12,23,59), 'Group presentation slides [Group Project 4]', 'assignment_106'],
]; return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:icalendar-ruby','X-WR-CALNAME:Student Calendar (Canvas)', ...ev.flatMap(([uid, dt, sum, anchor]) => {
    const line = `SUMMARY:${sum}`, folded = line.length > 75 ? line.slice(0,75)+'\r\n '+line.slice(75) : line;
    return ['BEGIN:VEVENT', dt.startsWith('VALUE') ? `DTSTART;${dt}` : `DTSTART:${dt}`, 'CLASS:PUBLIC', folded, `URL;VALUE=URI:https://canvas.morainevalley.edu/calendar?include_contexts=course_1#${anchor}`, `UID:${uid}`, 'END:VEVENT']; }), 'END:VCALENDAR'].join('\r\n'); };
http.createServer((req,res)=>{
  if (req.method==='GET' && (req.url==='/' || req.url==='/m')){ res.writeHead(200,{'content-type':'text/html'}); res.end(fs.readFileSync(__dirname+'/../public/index.html')); return; }
  if (req.url==='/api/health'){ res.writeHead(200,{'content-type':'application/json'}); res.end('{"ok":true}'); return; }
  if (req.url==='/api/chat' && failNext){ const st = failNext; failNext = 0; res.writeHead(st,{'content-type':'application/json'}); res.end(JSON.stringify({error: st===429 ? "You've used today's AI messages on this device. They reset overnight." : st===503 ? 'The API key on this deployment was rejected.' : 'Upstream error.'})); return; }
  if (req.url==='/api/chat'){ let b=''; req.on('data',d=>b+=d); req.on('end',()=>{ const body=JSON.parse(b); calls.push(body);
    const last = body.messages[body.messages.length-1];
    const hasImage = Array.isArray(last.content) && last.content.some(c=>c.type==='image');
    const txt = typeof last.content==='string' ? last.content : (Array.isArray(last.content) ? last.content.map(c=>c.text||'').join(' ') : '');
    if (Array.isArray(last.content) && last.content.some(c=>c.type==='tool_result')){ return sse(res, textEvents('Done. Tomorrow at 7pm, 60 minutes on the ENG draft. Start there.')); }
    // the app merges rules() + the student's message into one turn, so only look at the last paragraph (rules mention "planner")
    if (body.tools && /plan/i.test(txt.split('\n\n').pop())){ const t = new Date(); t.setDate(t.getDate()+1); const date = t.toISOString().slice(0,10);
      const input = JSON.stringify({date, start:'19:00', minutes:60, label:'ENG 101: draft intro'});
      const ev=[{type:'message_start'},{type:'content_block_start',index:0,content_block:{type:'text',text:''}},{type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Let me block that.'}},{type:'content_block_stop',index:0},{type:'content_block_start',index:1,content_block:{type:'tool_use',id:'tu1',name:'add_study_block',input:{}}},{type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:input.slice(0,20)}},{type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:input.slice(20)}},{type:'content_block_stop',index:1},{type:'message_delta',delta:{stop_reason:'tool_use'}},{type:'message_stop'}];
      return sse(res, ev); }
    if (body.system && /JSON/.test(body.system)){
      if (hasImage) return sse(res, textEvents(JSON.stringify({topic:'Cell biology notes', course:'BIO 111', cards:[{q:'What does the mitochondria do?',a:'Makes ATP.'},{q:'Ribosome job?',a:'Builds proteins.'},{q:'Cell membrane is made of?',a:'A phospholipid bilayer.'}]})));
      return sse(res, textEvents('```json\n'+JSON.stringify({title:'PSY 101 Exam 1', course:'PSY 101', questions:[{q:'Q1?',o:['a','b','c','d'],a:1,e:'because',t:'memory'},{q:'Q2?',o:['a','b','c','d'],a:2,e:'because',t:'memory'},{q:'Q3?',o:['a','b','c','d'],a:0,e:'because',t:'sleep'}]})+'\n```'));
    }
    return sse(res, textEvents('Hey! Tonight, do the MATH homework first, it is due at 11:59pm. Then 25 minutes on the speech outline.'));
  }); return; }
  if (req.url.startsWith('/fail?')){ failNext = Number(new URL(req.url,'http://x').searchParams.get('status')); res.end('ok'); return; }
  if (req.url==='/canvas-move'){ moved = true; res.end('ok'); return; }
  if (req.url==='/api/canvas'){ let b=''; req.on('data',d=>b+=d); req.on('end',()=>{ const {url} = JSON.parse(b);
    if (!/^https:\/\/canvas\.morainevalley\.edu\/feeds\/calendars\/[\w.-]+\.ics$/.test(url)){ res.writeHead(400,{'content-type':'application/json'}); res.end('{"error":"That isn\'t a Canvas Calendar Feed link. It should end in .ics."}'); return; }
    res.writeHead(200,{'content-type':'text/calendar'}); res.end(feed()); }); return; }
  if (req.url==='/calls'){ res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify(calls)); return; }
  res.writeHead(404); res.end();
}).listen(8787, ()=>console.log('mock on 8787'));
