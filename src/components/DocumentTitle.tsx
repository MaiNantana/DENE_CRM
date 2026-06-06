import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getCompanyDocumentTitle } from '../lib/company';

export default function DocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = getCompanyDocumentTitle(pathname);
  }, [pathname]);

  return null;
}
