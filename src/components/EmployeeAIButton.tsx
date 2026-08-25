import { Link } from "react-router-dom";

export default function EmployeeAIButton(){
  return <Link to="/ai" aria-label="المساعد الذكي" title="المساعد الذكي" className="group fixed bottom-5 right-5 z-[90] grid h-14 w-14 place-items-center rounded-2xl border border-primary/35 bg-background/95 text-primary shadow-xl backdrop-blur transition-all hover:-translate-y-1 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-primary/40">
    <svg viewBox="0 0 24 24" className="h-7 w-7 transition-transform duration-300 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="4"/>
      <path d="M9 10h.01M15 10h.01" strokeWidth="2.4"/>
      <path d="M9 14c1.5 1.2 4.5 1.2 6 0"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      <path d="m18 3 .5 1.5L20 5l-1.5.5L18 7l-.5-1.5L16 5l1.5-.5Z"/>
    </svg>
    <span className="sr-only">المساعد الذكي</span>
  </Link>;
}
