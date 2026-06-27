import { useEffect, useState } from 'react';
import { FileUp, CreditCard, Loader2, ShoppingBag, Share2 } from 'lucide-react';
import LiffLayout from './LiffLayout';
import { initializeLiff } from '../../lib/lineLiff';
import { publicApi } from '../../api';
import { useLineIdentity } from '../../hooks/useLineIdentity';
import { buildCompanyPath, getCompanyByCode, getCurrentCompany, getCompanyThemeStyle } from '../../lib/company';

function getBootstrapTarget() {
  if (typeof window === 'undefined') return '';

  try {
    const rawState = new URLSearchParams(window.location.search).get('liff.state')?.trim() || '';
    if (!rawState) return '';

    let decoded = rawState;
    try {
      decoded = decodeURIComponent(rawState);
    } catch {
      // Keep the raw state if decoding fails.
    }

    const normalized = decoded.replace(/^\/+/, '');
    if (!normalized) return '';
    const company = getCurrentCompany();
    const companyPathMatch = normalized.match(/^(DENE|KEFERA)(?:\/(.*))?$/i);
    if (companyPathMatch) {
      const targetCompany = getCompanyByCode(companyPathMatch[1]);
      const remainder = String(companyPathMatch[2] || '').replace(/^\/+/, '');
      if (!remainder) return buildCompanyPath('/liff', targetCompany);
      if (remainder.startsWith('liff/')) return buildCompanyPath(`/${remainder}`, targetCompany);
      return buildCompanyPath(`/liff/${remainder}`, targetCompany);
    }
    if (normalized.startsWith('liff/')) return buildCompanyPath(`/${normalized}`, company);
    if (normalized.startsWith('admin/')) return buildCompanyPath(`/${normalized}`, company);
    if (normalized.startsWith('register') || normalized.startsWith('slip') || normalized.startsWith('member')) {
      return buildCompanyPath(`/liff/${normalized}`, company);
    }

    return normalized.startsWith('/') ? buildCompanyPath(normalized, company) : buildCompanyPath(`/liff/${normalized}`, company);
  } catch {
    return '';
  }
}

export default function LiffEntry() {
  const target = getBootstrapTarget();
  const { lineId, loading: identityLoading } = useLineIdentity();
  const [memberExists, setMemberExists] = useState<boolean | null>(null);
  const [memberLookupLoading, setMemberLookupLoading] = useState(false);
  const company = getCurrentCompany();

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await initializeLiff();
      } catch {
        // LIFF will still work in fallback mode; the leaf pages show their own errors.
      }

      if (!alive || !target) return;
      window.location.replace(target);
    })();

    return () => {
      alive = false;
    };
  }, [target]);

  useEffect(() => {
    if (target) return;

    let alive = true;

    if (identityLoading || !lineId) {
      setMemberLookupLoading(false);
      setMemberExists(null);
      return () => {
        alive = false;
      };
    }

    setMemberLookupLoading(true);
    (async () => {
      try {
        const users = await publicApi.getUsers(lineId, true);
        if (!alive) return;
        setMemberExists(users.some((u: any) => u.line_id === lineId));
      } catch {
        if (!alive) return;
        setMemberExists(null);
      } finally {
        if (alive) setMemberLookupLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [lineId, identityLoading, target]);

  const handleMemberAction = async () => {
    let exists = memberExists;

    if (exists === null && lineId) {
      setMemberLookupLoading(true);
      try {
        const users = await publicApi.getUsers(lineId, true);
        exists = users.some((u: any) => u.line_id === lineId);
        setMemberExists(exists);
      } catch {
        exists = false;
      } finally {
        setMemberLookupLoading(false);
      }
    }

    window.location.href = buildCompanyPath(exists ? '/liff/member' : '/liff/register', company);
  };

  if (target) {
    return (
      <LiffLayout title={`${company.label} Member`} subtitle="Opening the right page...">
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <Loader2 size={32} className="animate-spin text-japandi-500" />
          <p className="text-sm text-japandi-500 leading-relaxed">
            Taking you to the page linked from LINE
          </p>
        </div>
      </LiffLayout>
    );
  }

  const themeStyle = getCompanyThemeStyle(company);

  // Rich-menu hub tiles. Shopping & Social Media have no destination yet — set `href` later.
  const tiles: Array<{
    label: string;
    icon: typeof CreditCard;
    href?: string;
    onClick?: () => void;
    loading?: boolean;
  }> = [
    {
      label: 'Membership',
      icon: CreditCard,
      onClick: handleMemberAction,
      loading: memberLookupLoading,
    },
    {
      label: 'Upload Slip',
      icon: FileUp,
      href: buildCompanyPath('/liff/slip', company),
    },
    {
      label: 'Shopping',
      icon: ShoppingBag,
      href: '', // TODO: paste Shopping URL
    },
    {
      label: 'Social Media',
      icon: Share2,
      href: '', // TODO: paste Social Media URL
    },
  ];

  return (
    <div
      className="min-h-screen max-w-md mx-auto flex flex-col bg-japandi-100 font-sans text-japandi-900"
      style={themeStyle}
    >
      {/* Brand hero — replace the wordmark with the KEFÉRA logo image when available */}
      <header className="px-6 pt-16 pb-10 text-center">
        <h1 className="font-serif text-5xl font-medium tracking-[0.3em] pl-[0.3em] text-japandi-900">
          {company.label}
        </h1>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.45em] text-japandi-600">
          Member Privileges
        </p>
      </header>

      {/* Menu grid — thin dividers via gap-px over a divider-colored background */}
      <main className="px-6 pb-12">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-japandi-300 bg-japandi-300">
          {tiles.map(tile => {
            const Icon = tile.icon;
            const inner = (
              <span className="flex h-full w-full flex-col items-center justify-center gap-3 bg-japandi-50 py-10 transition-colors hover:bg-white">
                {tile.loading
                  ? <Loader2 size={26} className="animate-spin text-japandi-600" />
                  : <Icon size={26} strokeWidth={1} className="text-japandi-600" />}
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-japandi-900">
                  {tile.label}
                </span>
              </span>
            );

            if (tile.onClick) {
              return (
                <button key={tile.label} type="button" onClick={tile.onClick} disabled={tile.loading} className="text-center disabled:opacity-70">
                  {inner}
                </button>
              );
            }
            if (tile.href) {
              return (
                <a key={tile.label} href={tile.href} className="text-center">
                  {inner}
                </a>
              );
            }
            // Placeholder (link to be added later)
            return (
              <button key={tile.label} type="button" aria-disabled className="text-center cursor-default">
                {inner}
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[10px] uppercase tracking-[0.35em] text-japandi-500">
          {company.lineOaName}
        </p>
      </main>
    </div>
  );
}
