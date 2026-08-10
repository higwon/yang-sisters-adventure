export type ExpenseShare = { userId: number; shareAmountMinor: number };

export function splitAmountMinor(
  amountMinor: number,
  participantIds: number[],
): ExpenseShare[] {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error('금액은 0보다 큰 최소 화폐 단위 정수여야 합니다.');
  }

  const uniqueIds = [...new Set(participantIds)];
  if (uniqueIds.length !== participantIds.length || uniqueIds.length === 0) {
    throw new Error('참여자는 한 명 이상이며 중복될 수 없습니다.');
  }

  const base = Math.floor(amountMinor / uniqueIds.length);
  const remainder = amountMinor % uniqueIds.length;

  return uniqueIds.map((userId, index) => ({
    userId,
    shareAmountMinor: base + (index < remainder ? 1 : 0),
  }));
}

export async function assertTripMembers(
  db: D1Database,
  tripId: number,
  userIds: number[],
): Promise<void> {
  const uniqueIds = [...new Set(userIds)];
  const placeholders = uniqueIds.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT user_id FROM trip_members WHERE trip_id = ? AND user_id IN (${placeholders})`,
    )
    .bind(tripId, ...uniqueIds)
    .all<{ user_id: number }>();

  if (result.results.length !== uniqueIds.length) {
    throw new Error('결제자와 참여자는 모두 현재 여행의 멤버여야 합니다.');
  }
}
