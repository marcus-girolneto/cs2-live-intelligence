const RETENTION = [7, 14, 30, 60, 90, 180, 365];
/** Choices up to the plan maximum, always including the saved value. */
export function retentionOptions(max: number, current: number) {
  const list = RETENTION.filter((d) => d <= max);
  if (!list.includes(max)) list.push(max);
  if (current > 0 && !list.includes(current) && current <= max)
    list.push(current);
  return list.sort((a, b) => a - b);
}
