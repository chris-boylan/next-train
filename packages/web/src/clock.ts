import { useEffect, useState } from 'react';

// Train times are Irish time, so show the clock in Irish time whatever the device is set to.
const TIME_ZONE = 'Europe/Dublin';

export function formatTime(date: Date, withSeconds = false): string {
  return date.toLocaleTimeString('en-IE', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds && { second: '2-digit' }),
    timeZone: TIME_ZONE,
  });
}

/** The current time, updated every second so the displayed minute rolls over on time. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
