export const Toggle = ({ active }: { active: boolean }) => (
  <button className={`w-11 h-6 rounded-full flex items-center p-1 transition-colors ${active ? 'bg-[#0b8252]' : 'bg-slate-200'}`}>
    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`}></div>
  </button>
);
