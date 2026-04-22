import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL = 10000;

const useAutoRefresh = (refreshFn, deps = [], intervalMs = DEFAULT_INTERVAL, enabled = true) => {
    const hasInitializedRef = useRef(false);
    const previousEnabledRef = useRef(enabled);

    useEffect(() => {
        if (!enabled) {
            previousEnabledRef.current = enabled;
            return undefined;
        }

        const shouldRunImmediately = !hasInitializedRef.current || previousEnabledRef.current === enabled;

        if (shouldRunImmediately) {
            refreshFn();
        }

        hasInitializedRef.current = true;
        previousEnabledRef.current = enabled;

        const intervalId = window.setInterval(() => {
            refreshFn();
        }, intervalMs);

        const handleFocus = () => {
            refreshFn();
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [enabled, intervalMs, ...deps]);
};

export default useAutoRefresh;
