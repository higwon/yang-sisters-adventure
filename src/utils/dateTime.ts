const toUtcIso = (value: string) => {
  const normalized = value.trim().replace(' ', 'T');
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(normalized)) return normalized;
  return `${normalized}Z`;
};

const parseUtcDate = (value: string) => new Date(toUtcIso(value));

export const formatLocalDate = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
}).format(parseUtcDate(value)).replace(/\.\s?/g, '.').replace(/\.$/, '');

export const formatLocalDateTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
}).format(parseUtcDate(value));

export const formatLocalActivityTime = (value: string) => new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(parseUtcDate(value));
