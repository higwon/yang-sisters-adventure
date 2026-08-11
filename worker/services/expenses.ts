export async function assertTripMembers(
  db: D1Database,
  tripId: number,
  userIds: number[],
): Promise<void> {
  const uniqueIds = [...new Set(userIds)];
  const placeholders = uniqueIds.map(() => '?').join(',');
  const result = await db.prepare(
    `SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id IN (${placeholders})`,
  ).bind(tripId, ...uniqueIds).all<{ user_id: number }>();
  if (result.results.length !== uniqueIds.length) {
    throw new Error('결제자는 현재 여행의 멤버여야 합니다.');
  }
}
