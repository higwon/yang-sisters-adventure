export function validateScheduleParticipants(memberIds: number[], participantIds: number[]) {
  const uniqueIds = [...new Set(participantIds)];
  if (uniqueIds.length !== participantIds.length) throw new Error('참여 멤버가 중복되었습니다.');
  const allowed = new Set(memberIds);
  if (uniqueIds.some((id) => !allowed.has(id))) throw new Error('현재 여행의 멤버만 일정에 참여할 수 있습니다.');
  return uniqueIds;
}
