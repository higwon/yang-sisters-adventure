import { useState } from 'react';

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minuteSteps = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, '0'));

export function TimeSelect({ name, label, value }: { name: string; label: string; value?: string | null }) {
  const [hour, setHour] = useState(value?.slice(0, 2) ?? '');
  const [minute, setMinute] = useState(value?.slice(3, 5) ?? '00');

  return <label>{label}<span className="timeParts"><select value={hour} onChange={(event) => setHour(event.target.value)} aria-label={`${label} 시`}><option value="">--시</option>{hours.map((entry) => <option key={entry}>{entry}</option>)}</select><b>:</b><select value={minute} onChange={(event) => setMinute(event.target.value)} disabled={!hour} aria-label={`${label} 분`}>{minuteSteps.map((entry) => <option key={entry}>{entry}</option>)}</select></span><input type="hidden" name={name} value={hour ? `${hour}:${minute}` : ''} /></label>;
}
