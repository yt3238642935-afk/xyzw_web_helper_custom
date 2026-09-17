import * as XLSX from "xlsx";

/**
 * 等待指定 Token 的 WebSocket 连接成功
 */
async function waitForConnection(tokenStore, tokenId, timeout = 10000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const status = tokenStore.getWebSocketStatus(tokenId);

    if (status === "connected") {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("WebSocket连接超时");
}


/**
 * 从 items 中读取指定物品数量
 */
function getItemCount(items, itemId) {
  if (!items) return 0;

  // 情况1：items 是数组
  if (Array.isArray(items)) {
    const item = items.find(
      (x) => Number(x.id ?? x.itemId) === itemId
    );

    if (!item) return 0;

    return Number(
      item.num ??
      item.count ??
      item.quantity ??
      0
    );
  }

  // 情况2：items 是对象
  const item = items[String(itemId)] ?? items[itemId];

  if (item == null) return 0;

  if (typeof item === "number") {
    return item;
  }

  return Number(
    item.num ??
    item.count ??
    item.quantity ??
    0
  );
}


/**
 * 把 role_getroleinfo 返回的数据
 * 转换成一行 Excel 数据
 */
function parseRoleInfo(token, response) {
  const role = response?.role;

  if (!role) {
    throw new Error("响应中不存在 role 数据");
  }

  const items =
    role.items ??
    role.itemList ??
    role.bag?.items ??
    role.inventory ??
    null;

  return {
    Token名称: token.name,
    服务器: token.server ?? "",

    角色ID: role.roleId ?? "",
    角色名: role.name ?? "",

    等级: role.level ?? 0,
    战力: role.power ?? role.fighting ?? 0,

    金币: role.gold ?? 0,
    金砖: role.diamond ?? 0,

    身份等级: role.legacy?.color ?? 0,

    招募令: getItemCount(items, 1001),
    进阶石: getItemCount(items, 1003),
    精铁: getItemCount(items, 1006),

    竞技场门票: getItemCount(items, 1007),

    普通鱼竿: getItemCount(items, 1011),
    金鱼竿: getItemCount(items, 1012),
    珍珠: getItemCount(items, 1013),

    军团币: getItemCount(items, 1014),

    晶石: getItemCount(items, 1016),
    复活丹: getItemCount(items, 1017),

    盐靛: getItemCount(items, 1019),
    皮肤币: getItemCount(items, 1020),
    扫荡魔毯: getItemCount(items, 1021),
    白玉: getItemCount(items, 1022),
    彩玉: getItemCount(items, 1023),

    扳手: getItemCount(items, 1026),

    贝壳: getItemCount(items, 1033),
    金盐靛: getItemCount(items, 1035),

    木制宝箱: getItemCount(items, 2001),
    青铜宝箱: getItemCount(items, 2002),
    黄金宝箱: getItemCount(items, 2003),
    铂金宝箱: getItemCount(items, 2004),
    钻石宝箱: getItemCount(items, 2005),
  };
}


/**
 * 获取单个角色身份牌信息
 */
async function fetchRoleIdentity(tokenStore, token) {
  const tokenId = token.id;

  // 记录这个连接原本是不是已经存在
  const alreadyConnected =
    tokenStore.getWebSocketStatus(tokenId) === "connected";

  try {
    // 没有连接才创建
    if (!alreadyConnected) {
      tokenStore.createWebSocketConnection(
        tokenId,
        token.token,
        token.wsUrl
      );

      await waitForConnection(tokenStore, tokenId);
    }

    // 真正向游戏服务器读取角色信息
    const response =
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "role_getroleinfo",
        {},
        8000
      );

    return parseRoleInfo(token, response);

  } finally {

    // 如果是我们为了导出临时建立的连接，
    // 用完以后关闭。
    //
    // 如果用户本来就已经连着这个账号，
    // 不要把人家的连接关闭。
    if (!alreadyConnected) {
      tokenStore.closeWebSocketConnection(tokenId);
    }
  }
}


/**
 * 批量读取身份牌
 */
export async function fetchIdentityCards(
  tokenStore,
  tokens,
  onProgress
) {
  const results = [];
  const errors = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    try {
      const data =
        await fetchRoleIdentity(
          tokenStore,
          token
        );

      results.push(data);

    } catch (error) {

      errors.push({
        token: token.name,
        error: error.message,
      });

    }

    if (onProgress) {
      onProgress({
        current: i + 1,
        total: tokens.length,
        tokenName: token.name,
      });
    }
  }

  return {
    results,
    errors,
  };
}


/**
 * 导出 Excel
 */
export function exportIdentityExcel(data) {
  const worksheet =
    XLSX.utils.json_to_sheet(data);

  const workbook =
    XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "角色身份牌"
  );

  const now = new Date();

  const date =
    [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

  XLSX.writeFile(
    workbook,
    `角色身份牌_${date}.xlsx`
  );
}
