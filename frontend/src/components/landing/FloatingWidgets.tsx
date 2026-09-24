import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, RotateCcw } from 'lucide-react';
import chatbotImg from '../../assets/chatbot.png';

/* ─── Knowledge base ───────────────────────────────────────────────────────────
   Keys are PHRASES. Match score = sum of matched phrase lengths, so longer/more
   specific phrases beat short generic ones (fixes wrong-answer collisions). */
interface KB { keys: string[]; a: string }

const KB_ENTRIES: KB[] = [
  { keys: ['free demo', 'is it free', 'really free', 'free class', 'free trial', 'how many demo', 'demo class'], a: 'Every new student gets 3 free demo classes! Try different tutors before paying anything  no card, no commitment.' },
  { keys: ['become a tutor', 'become tutor', 'want to teach', 'teach on', 'join as a tutor', 'apply as tutor', 'tutor job', 'earn money', 'how much can i earn'], a: 'Want to teach? Register as a tutor, set your own rate and schedule, and get paid on time after every class. Tap "Get started" and choose Tutor to apply.' },
  { keys: ['payment', 'how do payment', 'how much', 'price', 'cost', 'fee', 'wallet', 'credit', 'charge', 'billing'], a: 'You only pay for classes you actually attend. After each completed class, credits are deducted from your wallet  transparent, no hidden fees. Top up anytime.' },
  { keys: ['refund', 'cancel', 'reschedule'], a: 'You pay per attended class, so nothing to refund for skipped classes. Cancel or reschedule a booking anytime before it starts  free.' },
  { keys: ['verified', 'background', 'are tutors safe', 'are tutors verified', 'trusted', 'good tutor', 'find a tutor', 'choose a tutor'], a: 'Every tutor is background-checked, qualification-verified and rated by real students. Browse, compare ratings and watch demos on the Find Tutors page.' },
  { keys: ['subject', 'what can i learn', 'courses', 'topics', 'which subjects'], a: 'We offer 100+ subjects  Maths, Physics, Coding, English, Chemistry, Biology, Public Speaking, Computer Science and more, across all grade levels.' },
  { keys: ['language', 'hindi', 'tamil', 'telugu', 'medium'], a: 'Tutors teach in many languages  English, Hindi, Tamil, Telugu, Kannada and more. Filter by language when you search.' },
  { keys: ['grade', 'standard', 'which class', 'what level', 'age group'], a: 'We cover all grade levels  primary, middle, high school and beyond. Pick your grade when booking and we will match the right tutor.' },
  { keys: ['parent', 'my child', 'track progress', 'monitor', 'progress report'], a: 'Parents link to their child and get weekly progress reports, attendance and full class history in their own dashboard.' },
  { keys: ['attendance', 'present', 'absent'], a: 'Attendance is auto-marked when a student joins the live class. A live attendance rate shows for every learner on the dashboard.' },
  { keys: ['worksheet', 'quiz', 'practice'], a: 'Tutors share interactive worksheets and quizzes that auto-grade with instant scores  great practice between classes.' },
  { keys: ['assignment', 'homework', 'submit'], a: 'Tutors set assignments, students submit their work, and tutors grade with feedback  all tracked inside the platform.' },
  { keys: ['resource', 'notes', 'pdf', 'study material', 'download'], a: 'Tutors upload notes, PDFs and study material to the Resources library, which students can download anytime.' },
  { keys: ['recording', 'recorded', 'replay', 'rewatch', 'missed a class', 'miss a class'], a: 'Every class is auto-recorded, so you can rewatch anytime for revision  never miss a lesson.' },
  { keys: ['live class', 'online class', 'video class', 'whiteboard', 'screen share', 'how classes work', 'how do classes'], a: 'Classes are live HD sessions right in your browser  screen share, whiteboard, raise-hand and chat. No downloads needed.' },
  { keys: ['mind game', 'games', 'fun activities'], a: 'Students get mind games like Grand Prix, Quick Count and Number Order  learn while you play and build streaks!' },
  { keys: ['chat', 'doubt', 'message my tutor', 'ask doubt'], a: 'Use the in-app chat to message your tutor, parents or principal anytime  perfect for clearing doubts between classes.' },
  { keys: ['principal', 'school', 'institution', 'organisation', 'organization', 'manage tutors'], a: 'Principals onboard tutors, track classes, view analytics and manage their whole institution from the principal dashboard.' },
  { keys: ['get started', 'sign up', 'register', 'create account', 'how do i start', 'how to begin', 'join brainbaseedu'], a: 'Easy! 1) Sign up free, 2) find your tutor, 3) book a free demo. Tap "Get started" at the top to begin.' },
  { keys: ['security', 'privacy', 'is my data', 'is it safe', 'data safe'], a: 'Your data and payments are protected  secure wallet payments, role-based access and recorded classes keep everything safe and transparent.' },
  { keys: ['mobile', 'app', 'phone', 'android', 'ios'], a: 'brainbaseeduworks right in your mobile browser  no install needed. Join live classes, chat and check progress on the go.' },
  { keys: ['contact', 'support', 'help', 'customer care', 'reach you'], a: 'Our support team is one message away. Sign in and use the Chat tab, or reach us via the Contact link in the footer.' },
  { keys: ['hello', 'hi ', 'hey', 'namaste', 'good morning'], a: 'Hi there! I can help with demos, pricing, tutors, subjects, progress and more. Pick a question below or type your own.' },
  { keys: ['thank', 'thanks', 'great', 'awesome'], a: 'You are welcome! Happy learning  tap "Get started" whenever you are ready.' },
];

const QUICK_OPTIONS = [
  'Is it really free?',
  'How do payments work?',
  'Are tutors verified?',
  'What subjects can I learn?',
  'How do I get started?',
  'How do I become a tutor?',
  'Can parents track progress?',
  'Are classes recorded?',
];

// Full pool used for input autocomplete suggestions
const ALL_QUESTIONS = [
  ...QUICK_OPTIONS,
  'How do refunds work?',
  'What languages do tutors teach?',
  'Which grades do you support?',
  'How does attendance work?',
  'Do you have worksheets?',
  'How do assignments work?',
  'Where are study resources?',
  'How do live classes work?',
  'Do you have mind games?',
  'Can I use it on mobile?',
  'Is my data secure?',
  'How do I contact support?',
  'How do I manage my school?',
];

function suggest(text: string): string[] {
  const q = text.toLowerCase().trim();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  return ALL_QUESTIONS
    .filter((ql) => {
      const lower = ql.toLowerCase();
      return lower.includes(q) || words.some((w) => lower.includes(w));
    })
    .slice(0, 5);
}

interface Msg { from: 'bot' | 'user'; text: string }

const GREETING = "Hi! I'm Tara, your brainbaseeduhelper. Pick a question below or type your own.";

function answer(q: string): string {
  const lower = ` ${q.toLowerCase()} `;
  let best: KB | null = null;
  let bestScore = 0;
  for (const e of KB_ENTRIES) {
    let score = 0;
    for (const k of e.keys) if (lower.includes(k)) score += k.length;
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best && bestScore > 0
    ? best.a
    : "I'm not sure about that one. Try a quick question below, or ask about demos, pricing, tutors, subjects, progress or getting started.";
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-slate-400"
          animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
      ))}
    </span>
  );
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [ended, setEnded] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: GREETING }]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, typing, open]);

  const reset = () => {
    setMsgs([{ from: 'bot', text: GREETING }]);
    setEnded(false);
    setTyping(false);
    setInput('');
  };

  const send = (text: string) => {
    const q = text.trim();
    if (!q || typing || ended) return;
    setInput('');
    setMsgs((m) => [...m, { from: 'user', text: q }]);
    setTyping(true);
    const reply = answer(q);
    const delay = 700 + Math.min(1100, reply.length * 11);
    timer.current = window.setTimeout(() => {
      setTyping(false);
      setMsgs((m) => [...m, { from: 'bot', text: reply }]);
    }, delay);
  };

  const endChat = () => {
    if (typing) return;
    setMsgs((m) => [...m, { from: 'bot', text: 'Thanks for chatting! Closing now  reach out anytime. Happy learning.' }]);
    setEnded(true);
    timer.current = window.setTimeout(() => { setOpen(false); reset(); }, 1700);
  };

  return (
    <>
      {/* launcher  chatbot png */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open chat"
        className="fixed bottom-5 right-5 z-50 flex h-16 w-16 items-center justify-center transition-transform hover:-translate-y-0.5 hover:scale-105"
      >
        {open ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg">
            <X className="h-6 w-6" />
          </span>
        ) : (
          <>
            <img src={chatbotImg} alt="Chat" className="h-16 w-16 object-contain drop-shadow-lg" />
            <span className="absolute right-1 top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
            </span>
          </>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-5 z-50 flex h-[33rem] w-[min(23rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            {/* header */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3.5 text-white">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 p-1">
                <img src={chatbotImg} alt="Tara" className="h-full w-full object-contain" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold leading-none">Ask Tara</p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-indigo-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Online now</p>
              </div>
              {!ended && (
                <button onClick={endChat} disabled={typing} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/25 disabled:opacity-50">
                  End chat
                </button>
              )}
              <button onClick={reset} title="Restart chat" aria-label="Restart" className="rounded-lg p-1.5 hover:bg-white/15"><RotateCcw className="h-4 w-4" /></button>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>

            {/* messages */}
            <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto bg-[#FBF8F1] p-4">
              {msgs.map((m, i) => (
                <div key={i} className={`flex items-end gap-2 ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.from === 'bot' && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 p-0.5">
                      <img src={chatbotImg} alt="" className="h-full w-full object-contain" />
                    </span>
                  )}
                  <span className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm font-medium leading-relaxed ${m.from === 'user' ? 'rounded-br-md bg-indigo-600 text-white' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'}`}>
                    {m.text}
                  </span>
                </div>
              ))}

              {typing && (
                <div className="flex items-end gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 p-0.5">
                    <img src={chatbotImg} alt="" className="h-full w-full object-contain" />
                  </span>
                  <span className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2">
                    <span className="mb-0.5 block text-[10px] font-semibold text-slate-400">Tara is thinking…</span>
                    <TypingDots />
                  </span>
                </div>
              )}

              {/* quick-reply suggestions  natural rows in the conversation */}
              {!typing && !ended && (
                <div className="space-y-1.5 pt-1">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Suggested questions</p>
                  {QUICK_OPTIONS.slice(0, msgs.length > 1 ? 4 : QUICK_OPTIONS.length).map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                    >
                      {s}
                      <Send className="h-3.5 w-3.5 shrink-0 -rotate-0 text-indigo-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* input + live autocomplete */}
            <div className="relative border-t border-slate-100 bg-white">
              {/* autocomplete suggestions */}
              {!ended && suggest(input).length > 0 && (
                <div className="absolute bottom-full left-0 right-0 mb-1 mx-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                  {suggest(input).map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-indigo-50">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" /> {s}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={ended ? 'Chat ended' : 'Ask a question…'}
                  disabled={ended}
                  className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white disabled:opacity-60"
                />
                <button type="submit" aria-label="Send" disabled={!input.trim() || typing || ended}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
            <p className="bg-white pb-2 text-center text-[10px] text-slate-300">
              <Sparkles className="mr-1 inline h-2.5 w-2.5" /> Instant answers to common questions
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
