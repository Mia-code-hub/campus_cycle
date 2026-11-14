export type ItemStatus = 'listed' | 'reserved' | 'completed' | 'removed';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type ApplicationAction = 'approve' | 'reject' | 'complete' | 'cancel';

export interface ItemStateLike {
  status: ItemStatus;
}
export interface ApplicationStateLike {
  status: ApplicationStatus;
}

export interface TransitionResult {
  itemStatus: ItemStatus;
  applicationStatus: ApplicationStatus;
}

// 状态机纯函数：返回流转后的物品与申领单状态，非法流转抛错。
// hasOtherActiveApplications：cancel 时该物品是否还存在其他进行中（pending/approved）申领。
export function transition(
  item: ItemStateLike,
  application: ApplicationStateLike,
  action: ApplicationAction,
  hasOtherActiveApplications = false,
): TransitionResult {
  switch (action) {
    case 'approve':
      if (application.status !== 'pending') {
        throw new Error(`approve 要求申领状态为 pending，当前为 ${application.status}`);
      }
      if (item.status !== 'listed') {
        throw new Error(`approve 要求物品状态为 listed，当前为 ${item.status}`);
      }
      return { itemStatus: 'reserved', applicationStatus: 'approved' };

    case 'reject':
      if (application.status !== 'pending') {
        throw new Error(`reject 要求申领状态为 pending，当前为 ${application.status}`);
      }
      // 拒绝待审申领不改变物品状态（可能已被另一申领预留）
      return { itemStatus: item.status, applicationStatus: 'rejected' };

    case 'complete':
      if (application.status !== 'approved') {
        throw new Error(`complete 要求申领状态为 approved，当前为 ${application.status}`);
      }
      if (item.status !== 'reserved') {
        throw new Error(`complete 要求物品状态为 reserved，当前为 ${item.status}`);
      }
      return { itemStatus: 'completed', applicationStatus: 'completed' };

    case 'cancel':
      if (application.status !== 'pending' && application.status !== 'approved') {
        throw new Error(
          `cancel 要求申领状态为 pending 或 approved，当前为 ${application.status}`,
        );
      }
      if (item.status !== 'listed' && item.status !== 'reserved') {
        throw new Error(`cancel 要求物品状态为 listed 或 reserved，当前为 ${item.status}`);
      }
      return {
        itemStatus: item.status === 'reserved' && !hasOtherActiveApplications ? 'listed' : item.status,
        applicationStatus: 'cancelled',
      };

    default:
      throw new Error(`未知动作：${String(action)}`);
  }
}
