/// React Router 6 helper for back-button handlers that gracefully fall
/// back to a sensible URL when there's no history to pop. Without this,
/// navigate(-1) on a page reached via deep link is a silent no-op — the
/// user taps the arrow and nothing happens.
///
/// Usage:
///   import { useSafeBack } from '../lib/safeBack';
///   const goBack = useSafeBack('/');
///   <button onClick={goBack}>←</button>
///
/// The fallback should be wherever the back arrow's target is when the
/// user doesn't have explicit history — usually `/` (Home) or, for
/// nested screens, the parent route (e.g. `/pool/:id` for the picks
/// page).
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useSafeBack(fallback = '/') {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(() => {
    // React Router 6 stamps every Location with a `key`. The very first
    // entry of a session has key === 'default' — it's the only one we
    // can't navigate(-1) away from. Anything else means there's at
    // least one entry behind us in the stack, so navigate(-1) works.
    if (location.key === 'default') navigate(fallback);
    else navigate(-1);
  }, [navigate, location.key, fallback]);
}
