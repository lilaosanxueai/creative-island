/** 创作之火：连续使用的天数（今天没用但昨天用了，火种还在） */
export function calcStreak(dailyUsage: Record<string, number>): number {
  const days = new Set(Object.entries(dailyUsage).filter(([, m]) => m > 0).map(([d]) => d));
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  const cursor0 = new Date(today);
  if (!days.has(fmt(cursor0))) cursor0.setDate(cursor0.getDate() - 1); // 今天还没玩，从昨天数
  let streak = 0;
  const cursor = cursor0;
  while (days.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
