// Interface language. Thai is the source language of the UI; English is
// produced by translating Thai phrases as they reach the DOM, so every panel,
// toast and dialog is covered from one dictionary. Agent output (.md, .stream,
// form values) is never touched.

export type Lang = 'th' | 'en';
const KEY = 'starnet.lang';

export function getLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'th' || v === 'en') return v;
    // first visit: English browsers start in English, everyone else in Thai
    return /^en\b/i.test(navigator.language) && !/^th\b/i.test(navigator.language) ? 'en' : 'th';
  } catch {
    return 'th';
  }
}

export function setLang(lang: Lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  location.reload();
}

// Longest phrases first so whole sentences win over the words inside them.
const EN: [string, string][] = [
  // --- help guide ---
  ['STARNET คือออฟฟิศ AI ในรูปแบบเกม ลูกเรือแต่ละคนคือผู้ช่วย AI ที่ถนัดงานคนละแบบ สั่งงานแล้วเขาจะเดินไปนั่งที่โต๊ะ พิมพ์งานให้ดูสดๆ แล้วเดินถือผลงานมาส่งที่กล่องงานที่เสร็จ', 'STARNET is an AI office you run like a game. Each crew member is an AI assistant with a specialty. Give one a task and they walk to a desk, type the work while you watch, then carry the result to the Finished Work box.'],
  ['โหมดตัวอย่าง (ค่าเริ่มต้น) ใช้ฟรี แต่เป็นข้อความจำลองไว้ดูการทำงานเฉยๆ ถ้าอยากได้งานจริง ให้ใส่ API key ของ Anthropic ในหน้าตั้งค่า แล้วเลือก ใช้งานจริง', 'Demo mode (the default) is free but shows sample text only. For real work, add your Anthropic API key in Settings and choose Live.'],
  ['กดปุ่ม สั่งงาน เลือกลูกเรือที่ถนัดงานนั้น พิมพ์สิ่งที่ต้องการเป็นภาษาไทยได้เลย ถ้ามีเอกสารหรือข้อมูลประกอบ ให้วางในช่อง ข้อมูลประกอบ', 'Press New task, pick the crew member who fits the job and describe what you want. Paste any document or data into the Reference material box.'],
  ['คลิกที่ลูกเรือ (ในแผนที่หรือในรายชื่อด้านซ้าย) จะเห็นข้อความที่เขากำลังเขียนแบบสดๆ กดหยุดได้ทุกเมื่อ', 'Click a crew member (on the map or in the list on the left) to watch their text as they write it. You can stop them at any time.'],
  ['งานที่เสร็จจะไปอยู่ใน กล่องงานที่เสร็จ (ปุ่มด้านบนขวา) เปิดอ่าน คัดลอก ดาวน์โหลดเป็นไฟล์ .md หรือส่งต่อให้ลูกเรือคนอื่นทำต่อได้', 'Finished work lands in Finished Work (top right). Read it, copy it, download it as .md, or hand it to another crew member.'],
  ['ให้หลายคนทำงานเป็นทอดๆ เช่น นักวิจัยหาข้อมูล แล้วส่งให้นักวางกลยุทธ์ทำแผน แล้วส่งให้นักเขียนคำโฆษณาเขียนโพสต์ ผลงานจะไหลไปบนสายพานในห้องโรงงาน', 'Have several crew members work in turn, for example Researcher, then Strategist, then Copywriter. Work rides the conveyor in the Factory.'],
  ['หา API key ได้ที่ console.anthropic.com (เมนู API Keys) ต้องเติมเครดิตก่อนใช้ key จะถูกเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งไปที่ api.anthropic.com เท่านั้น ไม่มีเซิร์ฟเวอร์ของเราเกี่ยวข้อง', 'Get an API key at console.anthropic.com (API Keys); the account needs credit. The key stays in this browser and is sent only to api.anthropic.com. There is no STARNET server.'],
  ['ลูกเรือแต่ละแบบถนัดอะไร', 'What each crew type is good at'],
  ['วิธีใช้ STARNET', 'How to use STARNET'],
  ['ตั้งค่า API key', 'Set API key'],
  ['ลองสั่งงานแรก', 'Try a first task'],
  ['เลือกโหมด', 'Choose a mode'],
  ['ดูเขาทำงาน', 'Watch them work'],
  ['รับงาน', 'Collect the work'],
  // --- notices ---
  ['ตอนนี้เป็นโหมดตัวอย่าง: ผลงานเป็นข้อความจำลองเพื่อดูการทำงาน ไม่ได้ตอบโจทย์ของคุณจริง ถ้าอยากได้งานจริง ไปที่ ตั้งค่า แล้วใส่ API key และเลือก ใช้งานจริง', 'Demo mode: the output is sample text that shows how the crew works, not an answer to your task. For real work, open Settings, add an API key and choose Live.'],
  ['โหมดใช้งานจริง: ลูกเรือจะเรียก Claude จริงด้วย key ของคุณ วันนี้ใช้ไป', 'Live mode: the crew calls Claude with your key. Used today:'],
  ['ขอ key ได้ที่ console.anthropic.com เมนู API Keys (ต้องเติมเครดิตก่อน) key จะเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น และส่งตรงไปที่ api.anthropic.com เท่านั้น STARNET ไม่มีเซิร์ฟเวอร์ แนะนำให้ตั้งวงเงินใช้จ่ายของ key ไว้ด้วย และกด ลบ key เมื่อใช้เสร็จบนเครื่องคนอื่น', 'Get a key at console.anthropic.com under API Keys (the account needs credit). The key is stored only in this browser and sent only to api.anthropic.com; STARNET has no server. Set a spend limit on the key, and press Remove key when you finish on someone else\'s computer.'],
  ['ให้ลูกเรือค้นเว็บได้ (ค้นหาข้อมูลล่าสุดจากอินเทอร์เน็ต มีค่าใช้จ่ายเพิ่มประมาณ 10 ดอลลาร์ต่อ 1,000 ครั้ง และผู้ดูแลบัญชีต้องเปิดใช้ใน Console ก่อน)', 'Let the crew search the web (fresh information from the internet; about $10 per 1,000 searches, and an admin must enable web search in the Console first)'],
  ['ให้ลูกเรือที่ว่างหยิบงานตัวอย่างมาทำเอง (เฉพาะโหมดตัวอย่าง ไว้โชว์ จะทำให้กล่องงานเต็มเร็ว)', 'Idle crew pick up sample tasks on their own (Demo mode only; fills Finished Work quickly)'],
  ['เลือกได้สูงสุด 4 คน คนแรกทำก่อน แล้วผลงานจะวิ่งไปบนสายพานในห้องโรงงานให้คนถัดไปทำต่อ คนสุดท้ายจะเอางานไปส่งที่กล่องงานที่เสร็จ', 'Pick up to 4 crew members. The first works, then the output rides the Factory conveyor to the next; the last one delivers to Finished Work.'],
  // --- placeholders and long fields ---
  ['อยากให้ทำอะไร พิมพ์เป็นภาษาไทยได้เลย เช่น เขียนแคปชันขายเสื้อยืด 5 แบบ สำหรับโพสต์ในเฟซบุ๊ก', 'What should they do? For example: write 5 captions selling a T-shirt for a Facebook post'],
  ['ไม่บังคับ: วางเอกสาร ข้อมูลสินค้า บทความ หรือโค้ดที่อยากให้ใช้ประกอบงาน', 'Optional: paste a document, product info, an article or code to work from'],
  ['โจทย์ของทั้งทีม เช่น ทำแผนเปิดตัวร้านกาแฟเปิดใหม่ในเชียงใหม่ พร้อมโพสต์ประกาศ', 'The mission for the whole chain, for example: launch plan and announcement post for a new coffee shop'],
  ['ทำแผนเปิดตัวร้านกาแฟเปิดใหม่ในเชียงใหม่ แล้วเขียนโพสต์เฟซบุ๊กประกาศเปิดร้าน', 'Plan the launch of a new coffee shop in Chiang Mai, then write a Facebook post announcing the opening'],
  ['ลากเพื่อเลื่อนจอ / ล้อเมาส์เพื่อซูม / คลิกลูกเรือเพื่อดูงาน', 'Drag to pan / wheel to zoom / click a crew member'],
  ['ยังไม่มีงานที่เสร็จ สั่งงานให้ลูกเรือ แล้วเขาจะถือผลงานมาส่งที่นี่', 'No finished work yet. Give the crew a task and they will carry the result here.'],
  ['ว่างอยู่ กดปุ่ม สั่งงาน เพื่อให้คนนี้เริ่มทำงาน', 'Idle. Press New task to put this crew member to work.'],
  ['โหมดตัวอย่าง: ข้อความจำลอง ไม่ต้องมี key กดเพื่อเปลี่ยนเป็นใช้งานจริง', 'Demo mode: sample text, no key needed. Click to switch to Live.'],
  ['โหมดใช้งานจริง: เรียก Claude จริงด้วย key ของคุณ', 'Live mode: real Claude calls with your key'],
  ['ข้อความจำลอง ไว้ดูการทำงาน ไม่ต้องมี key ไม่เสียเงิน', 'Sample text to see how it works. No key, no cost.'],
  ['เรียก Claude จริงด้วย key ของคุณ ได้งานจริงตามโจทย์', 'Real Claude calls with your key. Real work.'],
  // --- errors and toasts ---
  ['ยังไม่ได้ใส่ API key เปิดหน้าตั้งค่าแล้ววาง key ของ Anthropic หรือสลับกลับไปโหมดตัวอย่าง', 'No API key yet. Open Settings and paste your Anthropic key, or switch back to Demo mode.'],
  ['API key ไม่ถูกต้องหรือไม่มีสิทธิ์ ตรวจ key ในหน้าตั้งค่า', 'Bad or unauthorized API key. Check it in Settings.'],
  ['ส่งคำขอถี่เกินไป (rate limit) รอสักครู่แล้วลองใหม่ หรือให้ทำงานพร้อมกันน้อยลง', 'Rate limited. Wait a moment and retry, or run fewer crew at once.'],
  ['เชื่อมต่อ api.anthropic.com ไม่ได้ ตรวจสอบอินเทอร์เน็ต', 'Could not reach api.anthropic.com. Check your connection.'],
  ['เซิร์ฟเวอร์ของ Anthropic งานล้นอยู่ ลองใหม่ในอีกสักนาที', 'Anthropic\'s API is overloaded. Try again in a minute.'],
  ['โมเดลปฏิเสธคำขอนี้ ลองเขียนคำสั่งใหม่ด้วยถ้อยคำอื่น', 'The model declined this request. Try rephrasing it.'],
  ['เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', 'Unknown error'],
  ['ถึงเพดานโทเคนรายวันแล้ว', 'Daily token limit reached'],
  ['เพิ่มเพดานได้ในหน้าตั้งค่า หรือรอพรุ่งนี้', 'Raise it in Settings or wait until tomorrow.'],
  ['ยังทำงานอื่นอยู่ งานนี้จะต่อคิวไว้ก่อน', 'is busy; this task is queued'],
  ['ยังทำงานอื่นอยู่ งานนี้จะต่อคิวไว้', 'is busy; the task will be queued'],
  ['จะเดินไปที่โต๊ะแล้วเริ่มทำงานทันที', 'will walk to a desk and start right away'],
  ['ถูกหยุดเพราะรีเฟรชหน้าเว็บ', 'Stopped because the page was reloaded'],
  ['เข้ากล่องงานที่เสร็จแล้ว', 'to Finished Work'],
  ['เข้าร่วมทีมแล้ว', 'joined the crew'],
  ['เลเวลอัปเป็น', 'reached level'],
  ['ลบ API key ออกจากเบราว์เซอร์นี้แล้ว', 'API key removed from this browser'],
  ['โหมดใช้งานจริงต้องมี API key', 'Live mode needs an API key'],
  ['เปิดโหมดใช้งานจริงแล้ว ลูกเรือจะเรียก Claude จริง', 'Live mode on. The crew now calls Claude.'],
  ['key นี้ดูไม่เหมือน key ของ Anthropic (ควรขึ้นต้นด้วย sk-ant-) แต่บันทึกไว้ให้แล้ว', 'That does not look like an Anthropic key (sk-ant-...). Saved anyway.'],
  ['เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอก', 'This browser blocked the clipboard'],
  ['ใช้โหมดตัวอย่าง', 'Demo mode on'],
  ['สถานีเต็มแล้ว', 'The station is full'],
  ['เริ่มงานต่อกัน:', 'Pipeline started:'],
  ['ใช้งานได้', 'Works'],
  ['คำขอถูกปฏิเสธ:', 'Request rejected:'],
  ['ลบงานที่เสร็จทั้งหมด', 'Delete all finished work'],
  ['(ดาวน์โหลดเก็บไว้ก่อนได้)', '(download anything you want to keep first)'],
  ['ผลงานจำลองจากโหมดตัวอย่าง', 'sample output from Demo mode'],
  ['โหลดไม่สำเร็จ ลองรีเฟรชหน้าเว็บ', 'Failed to load. Reload the page.'],
  // --- classes ---
  ['หาข้อมูล สรุปว่าอะไรรู้แล้ว อะไรยังไม่รู้ และอะไรสำคัญ', 'Finds what is known, what is not, and what matters.'],
  ['เปลี่ยนข้อมูลเป็นแผน จัดลำดับความสำคัญ ว่าจะทำอะไรก่อนหลัง', 'Turns findings into a plan with priorities.'],
  ['เขียนโค้ดที่ใช้งานได้จริง อ่านง่าย และรองรับกรณีพิเศษ', 'Writes working, readable code that handles edge cases.'],
  ['เขียนข้อความขายของ โพสต์ แคปชัน ที่คนอยากอ่านจริง', 'Writes sales copy, posts and captions people actually read.'],
  ['ตรวจหาจุดอ่อน ข้อผิดพลาด แล้วบอกวิธีแก้', 'Finds weak spots and mistakes, and says how to fix them.'],
  ['ทำเช็กลิสต์ ขั้นตอนการทำงาน และงานอัตโนมัติ', 'Checklists, runbooks and automation plans.'],
  ['ทีมเล็กๆ ควรรู้อะไรบ้างก่อนเปิดตัวเครื่องมือ AI ที่ใช้งานผ่านเว็บเบราว์เซอร์', 'What should a small team know before launching a browser-based AI tool?'],
  ['วางแผนเปิดตัวแอปจัดการงานสไตล์พิกเซลอาร์ตภายใน 30 วัน โดยไม่มีงบโฆษณา', 'Plan a 30-day launch for a pixel-art productivity app with no ad budget.'],
  ['เขียนฟังก์ชัน debounce ภาษา TypeScript ที่มีตัวเลือก leading/trailing พร้อมเทสต์', 'Write a TypeScript debounce function with leading/trailing options and tests.'],
  ['เขียนข้อความหน้าแรกเว็บไซต์ (หัวข้อหลัก จุดเด่น 3 ข้อ และปุ่มชวนกด) สำหรับร้านกาแฟเปิดใหม่', 'Write homepage copy (headline, 3 features, call to action) for a new coffee shop.'],
  ['ช่วยตรวจแผนนี้: จะเปิดตัวแอปวันศุกร์ โดยไม่มีรายชื่อคนรอใช้ล่วงหน้าเลย', 'Review this plan: launch the app on a Friday with no waitlist.'],
  ['ทำเช็กลิสต์ขั้นตอนอัปเว็บขึ้น Netlify และวิธีย้อนกลับเมื่อเว็บพัง', 'Write a Netlify deploy checklist and a rollback runbook.'],
  ['นักเขียนคำโฆษณา', 'Copywriter'],
  ['นักวางกลยุทธ์', 'Strategist'],
  ['ฝ่ายปฏิบัติการ', 'Ops'],
  ['โปรแกรมเมอร์', 'Coder'],
  ['ผู้ตรวจงาน', 'Reviewer'],
  ['นักวิจัย', 'Researcher'],
  ['ฉลาดกว่า ช้ากว่า', 'smarter, slower'],
  ['ใหม่สุด ถูกสุด', 'newest, cheapest'],
  ['เร็ว ค่าเริ่มต้น', 'fast, default'],
  // --- dialogs and labels ---
  ['งานต่อกัน (หลายคนทำเป็นทอด)', 'Pipeline (crew work in turn)'],
  ['เลือกลูกเรือด้านล่างตามลำดับที่ต้องการ', 'Pick crew below in the order you want.'],
  ['ความยาวคำตอบสูงสุดต่องาน (โทเคน)', 'Max answer length per task (tokens)'],
  ['Anthropic API key (สำหรับโหมดใช้งานจริง)', 'Anthropic API key (for Live mode)'],
  ['โมเดล (ใช้ในโหมดใช้งานจริง)', 'Model (used in Live mode)'],
  ['ชื่อเรียก (ภาษาอังกฤษ/ตัวเลข)', 'Callsign (A-Z, 0-9)'],
  ['ผลงานที่ส่งต่อมา (แก้ได้)', 'Work handed over (editable)'],
  ['จำนวนโทเคนที่ใช้วันนี้ (โหมดใช้งานจริง)', 'Tokens used today (Live mode)'],
  ['หยุดลูกเรือทุกคนที่กำลังทำงาน', 'Stop every working crew member'],
  ['สลับโหมดได้ในหน้าตั้งค่า', 'Switch mode in Settings'],
  ['ศูนย์บัญชาการลูกเรือ AI', 'AI CREW CONTROL'],
  ['เส้นจอ CRT แบบทีวีเก่า', 'CRT scanlines'],
  ['เปิด/ปิดเส้นจอ CRT', 'Toggle CRT scanlines'],
  ['ส่งต่อให้คนอื่นทำต่อ', 'Hand to another crew member'],
  ['ส่งต่องานจาก', 'Hand over work from'],
  ['ห้องรับลูกเรือใหม่', 'Recruitment bay'],
  ['ผลงานที่กำลังเขียน', 'Live output'],
  ['กำลังเดินไปที่โต๊ะ...', 'Walking to a desk...'],
  ['เพดานโทเคนต่อวัน', 'Daily token limit'],
  ['ยังไม่เสียค่าใช้จ่าย', 'no cost so far'],
  ['ลำดับการทำงาน', 'Order'],
  ['เริ่มงานต่อกัน', 'Start pipeline'],
  ['งานที่ต้องการ', 'Task'],
  ['ข้อมูลประกอบ', 'Reference material'],
  ['ตัวอย่างลูกเรือ', 'Crew preview'],
  ['กำลังทดสอบ...', 'Testing...'],
  ['กด Ctrl+Enter เพื่อส่ง', 'Ctrl+Enter to send'],
  ['งานที่เสร็จแล้ว', 'Finished work'],
  ['ดาวน์โหลด .md', 'Download .md'],
  ['รีเซ็ตตัวนับ', 'Reset counter'],
  ['key ปัจจุบัน:', 'Current key:'],
  ['ยังไม่ได้ใส่', 'none'],
  ['โหมดตัวอย่าง', 'DEMO'],
  ['ใช้งานจริง', 'LIVE'],
  ['มุมมองสถานี', 'Station view'],
  ['สั่งงานคนนี้', 'Give this crew member a task'],
  ['สั่งงานใหม่', 'New task'],
  ['หยุดทั้งหมด', 'Stop all'],
  ['ล้างทั้งหมด', 'Clear all'],
  ['เลือกลูกเรือ', 'Crew member'],
  ['เพิ่มลูกเรือ', 'Add crew'],
  ['รับลูกเรือ', 'Recruit'],
  ['ใช้ตัวอย่าง', 'Use sample'],
  ['คัดลอกแล้ว', 'Copied'],
  ['แสดง key', 'Show key'],
  ['ทดสอบ key', 'Test key'],
  ['ความถนัด', 'Specialty'],
  ['ทรงหงอน', 'Crest'],
  ['โกนเกรียน', 'Shaved'],
  ['น้ำเงินสถานี', 'Station Blue'],
  ['ทองบัญชาการ', 'Command Amber'],
  ['เขียววิศวกร', 'Engineering Teal'],
  ['ม่วงวิทยาศาสตร์', 'Science Violet'],
  ['แดงรักษาการณ์', 'Security Red'],
  ['เทาปฏิบัติการ', 'Ops Grey'],
  ['รูปร่าง A', 'Frame A'],
  ['รูปร่าง B', 'Frame B'],
  ['คนบนสถานี', 'aboard'],
  ['กำลังทำงาน', 'WORKING'],
  ['เสร็จแล้ว', 'DONE'],
  ['ผิดพลาด', 'ERROR'],
  ['งานต่อกัน', 'Pipeline'],
  ['งานที่เสร็จ', 'Finished'],
  ['งานเสร็จ', 'Finished'],
  ['สั่งงาน', 'New task'],
  ['ส่งงาน', 'Send'],
  ['เรียกตัว', 'Summon'],
  ['รับเพิ่ม', 'Recruit'],
  ['ต่อกัน', 'Chain'],
  ['ชื่อเรียก', 'Callsign'],
  ['เปิดผลงาน', 'Open result'],
  ['ตามดู', 'Focus'],
  ['ลบ key', 'Remove key'],
  ['ยกเลิก', 'Cancel'],
  ['บันทึก', 'Save'],
  ['ตั้งค่า', 'Settings'],
  ['วิธีใช้', 'How to use'],
  ['ลูกเรือ', 'Crew'],
  ['ซูมเข้า', 'Zoom in'],
  ['ซูมออก', 'Zoom out'],
  ['เอาออก', 'Remove'],
  ['ทรงผม', 'Hair style'],
  ['รูปร่าง', 'Body'],
  ['สีผิว', 'Skin'],
  ['สีผม', 'Hair'],
  ['คัดลอก', 'Copy'],
  ['โมเดล', 'Model'],
  ['โจทย์', 'Mission'],
  ['โหมด', 'Mode'],
  ['เลเวล', 'LV'],
  ['ตัวอย่าง', 'demo'],
  ['ว่าง', 'IDLE'],
  ['หยุด', 'Stop'],
  ['ปิด', 'Close'],
  ['ลบ', 'Delete'],
  ['สั้น', 'Short'],
  ['ยาว', 'Long'],
  ['ชุด', 'Uniform'],
  ['วันนี้ใช้ไป', 'Used today:'],
  ['ใช้ไป', 'used'],
  ['จากเพดาน', 'of the limit'],
  ['โทเคนวันนี้', 'tokens today'],
  ['โทเคน', 'tokens'],
  ['วินาทีที่แล้ว', 's ago'],
  ['นาทีที่แล้ว', 'm ago'],
  ['ชั่วโมงที่แล้ว', 'h ago'],
  ['ส่งผลงาน', 'delivered'],
  ['โดย', 'By'],
  ['สูงสุด', 'max'],
  ['คน', 'crew'],
  ['ชิ้น', 'items'],
  ['จาก', 'of'],
];
EN.sort((a, b) => b[0].length - a[0].length);

const THAI = /[฀-๿]/;
const cache = new Map<string, string>();

export function tr(s: string): string {
  if (getLangCached() !== 'en' || !THAI.test(s)) return s;
  let out = cache.get(s);
  if (out !== undefined) return out;
  out = s;
  for (const [th, en] of EN) if (out.includes(th)) out = out.split(th).join(en);
  cache.set(s, out);
  return out;
}

let langCache: Lang | null = null;
function getLangCached(): Lang {
  return (langCache ??= getLang());
}

const SKIP = '.md, .stream, .r-title, .lang-toggle, textarea, input';
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];

function translateNode(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) {
    const p = n.parentElement;
    if (!p || p.closest(SKIP)) return;
    const v = n.nodeValue ?? '';
    const t = tr(v);
    if (t !== v) n.nodeValue = t;
    return;
  }
  if (n.nodeType !== Node.ELEMENT_NODE) return;
  const el = n as Element;
  if (el.closest('.md, .stream')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !THAI.test(v)) continue;
    const t = tr(v);
    if (t !== v) el.setAttribute(a, t);
  }
  if (el.matches('textarea, input')) return;
  for (const c of Array.from(el.childNodes)) translateNode(c);
}

/** English mode: translate the UI as it renders. */
export function installTranslator() {
  if (getLangCached() !== 'en') return;
  document.documentElement.lang = 'en';
  translateNode(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') translateNode(m.target);
      else if (m.type === 'attributes') translateNode(m.target);
      else m.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
