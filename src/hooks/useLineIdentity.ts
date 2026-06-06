import { useEffect, useState } from 'react';
import { hasLiffId, resolveLineUserId } from '../lib/lineLiff';

type LineIdentityState = {
  lineId: string;
  isAuto: boolean;
  loading: boolean;
  error: string;
};

function normalizeLiffError(err: unknown) {
  const message = err instanceof Error ? err.message : 'ไม่สามารถเชื่อมต่อ LIFF ได้';

  if (/endpoint URL/i.test(message) || /not related to the endpoint URL/i.test(message)) {
    return 'LIFF endpoint ยังไม่ตรงกับ URL ปัจจุบัน หรือยังไม่ได้ตั้งค่าเป็น https';
  }

  if (/login/i.test(message) || /access_token/i.test(message)) {
    return 'กรุณาเปิดผ่าน LINE หรือเข้าสู่ระบบ LIFF ใหม่อีกครั้ง';
  }

  return message;
}

export function useLineIdentity(fallbackLineId = ''): LineIdentityState {
  const [state, setState] = useState<LineIdentityState>({
    lineId: fallbackLineId.trim(),
    isAuto: false,
    loading: hasLiffId(),
    error: '',
  });

  useEffect(() => {
    let active = true;
    const fallback = fallbackLineId.trim();

    setState({
      lineId: fallback,
      isAuto: false,
      loading: hasLiffId(),
      error: '',
    });

    (async () => {
      try {
        const resolved = await resolveLineUserId(fallback);
        if (!active) return;

        setState({
          lineId: resolved.lineId,
          isAuto: resolved.isAuto,
          loading: false,
          error: '',
        });
      } catch (err) {
        if (!active) return;

        setState({
          lineId: fallback,
          isAuto: false,
          loading: false,
          error: normalizeLiffError(err),
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [fallbackLineId]);

  return state;
}
