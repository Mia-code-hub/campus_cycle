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

// 撤回与重新上架：物品主人对自己发布物品的处理，与申领状态机解耦。
// 撤回只改变物品是否对外可见，不动任何一条申领的历史记录——
// 进行中的申领由调用方在同一事务里作废，已完成的交割记录必须原样留着，台账才对得上。
export function withdrawItem(item: ItemStateLike): ItemStatus {
  if (item.status === 'completed') {
    throw new Error('已交割完成的物品不能撤回');
  }
  if (item.status === 'removed') {
    throw new Error('物品已经撤回，无需重复操作');
  }
  return 'removed';
}

export function relistItem(item: ItemStateLike, violationFlag = 0): ItemStatus {
  // 违规下架（violation_flag=1）的物品由管理员处理，主人不能自己恢复上架，
  // 否则等于给了一条绕过审核的通道
  if (violationFlag === 1) {
    throw new Error('违规下架的物品需管理员复核通过后才能恢复');
  }
  if (item.status !== 'removed') {
    throw new Error(`relist 要求物品状态为 removed，当前为 ${item.status}`);
  }
  return 'listed';
}
