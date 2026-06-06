import { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { getCurrentCompany, getCompanyThemeStyle } from '../../lib/company';

interface LiffLayoutProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  noPad?: boolean;
}

export default function LiffLayout({ title, subtitle, onBack, children, noPad }: LiffLayoutProps) {
  const company = getCurrentCompany();
  const themeStyle = getCompanyThemeStyle(company);

  return (
    <div className="min-h-screen bg-[#eef0f3] flex flex-col max-w-md mx-auto relative" style={themeStyle}>
      {/* Header */}
      <div className="bg-japandi-800 text-white px-4 pt-12 pb-4 flex items-center gap-3 shrink-0 shadow-lg">
        {onBack && (
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors -ml-1">
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h1 className="font-bold text-lg leading-tight">{title}</h1>
          {subtitle && <p className="text-japandi-300 text-xs">{subtitle}</p>}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${noPad ? '' : 'p-4'}`}>
        {children}
      </div>
    </div>
  );
}
