import Link from "next/link";
import { ShieldCheck, Bell, Sparkles, BookOpen, Search, ArrowRight } from "lucide-react";

export default function HomePage() {
  const categories = [
    { name: "Union Public Service (UPSC)", count: "12 Active", color: "from-blue-600 to-indigo-700" },
    { name: "Staff Selection Commission (SSC)", count: "24 Active", color: "from-emerald-600 to-teal-700" },
    { name: "Railway Recruitment Boards (RRB)", count: "18 Active", color: "from-amber-600 to-orange-700" },
    { name: "State PSCs (KPSC, MPPSC, etc.)", count: "45 Active", color: "from-purple-600 to-violet-700" },
    { name: "Banking & Financial (IBPS/SBI)", count: "9 Active", color: "from-cyan-600 to-blue-700" },
    { name: "Defense (NDA, CDS, AFCAT)", count: "14 Active", color: "from-rose-600 to-red-700" },
  ];

  return (
    <main className="flex-1 flex flex-col items-center justify-between">
      {/* Top Navigation Bar */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              UG
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                UPA-GURU
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Exam Intelligence
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 rounded-md transition"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition"
            >
              Get Alerts
              <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="w-full max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-6">
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI-Verified Government Exam Notifications & Deadlines</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
          Never Miss a <span className="text-blue-600 dark:text-blue-400">Government Exam</span> Deadline Again
        </h1>

        <p className="max-w-2xl mx-auto text-lg text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
          Aggregated, AI-extracted, and human-verified notifications across all Central & State government recruitment portals. Direct PDF downloads, eligibility criteria, and omnichannel push alerts.
        </p>

        {/* Quick Search Preview Bar */}
        <div className="max-w-2xl mx-auto relative mb-12">
          <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-2">
            <Search className="h-5 w-5 text-slate-400 ml-3" />
            <input
              type="text"
              placeholder="Search by exam name, conducting body, or qualification..."
              className="flex-1 bg-transparent border-0 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              readOnly
            />
            <Link
              href="/auth/register"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
            >
              Search
            </Link>
          </div>
        </div>

        {/* Highlight Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 mx-auto mb-2">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">100% Verified</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Human-In-The-Loop reviewed</div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 mx-auto mb-2">
              <Bell className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">&lt; 15 Mins</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Telegram & WhatsApp alerts</div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 mx-auto mb-2">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">Full Syllabus</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Structured topics & eligibility</div>
          </div>
        </div>
      </section>

      {/* Category Grid Section */}
      <section className="w-full max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-8">
          Browse by Exam Category
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((category) => (
            <div
              key={category.name}
              className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition cursor-pointer flex items-center justify-between group"
            >
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {category.name}
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">{category.count}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
            </div>
          ))}
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>&copy; 2026 UPA-GURU Platform. Dedicated to Empowering India&apos;s Aspirants.</p>
      </footer>
    </main>
  );
}
