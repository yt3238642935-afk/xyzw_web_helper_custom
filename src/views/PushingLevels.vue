<template>
  <div class="pushing-levels-page">
    <div class="pl-header">
      <div>
        <h2>战斗推关</h2>
        <p>主线推图 · 并发队列与异常保护</p>
      </div>
      <div class="pl-header-actions scheduler-settings">
        <n-switch v-model:value="autoContinue" size="small">
          <template #checked>自动继续</template>
          <template #unchecked>单场停止</template>
        </n-switch>

        <label class="setting-field">
          <span>在线账号 A</span>
          <n-input-number
            v-model:value="onlineAccountLimit"
            :min="1"
            :max="200"
            size="small"
            class="setting-input"
          />
        </label>

        <label class="setting-field">
          <span>同关失败 B</span>
          <n-input-number
            v-model:value="sameLevelFailureLimit"
            :min="1"
            :max="999999"
            size="small"
            class="setting-input"
          />
        </label>

        <label class="setting-field">
          <span>胜场轮换 C</span>
          <n-input-number
            v-model:value="winRotationLimit"
            :min="1"
            :max="999999"
            size="small"
            class="setting-input"
          />
        </label>

        <label class="setting-field">
          <span>重连分钟 D</span>
          <n-input-number
            v-model:value="reconnectDelayMinutes"
            :min="1"
            :max="1440"
            size="small"
            class="setting-input"
          />
        </label>
      </div>
    </div>

    <n-alert type="info" :show-icon="false" class="scheduler-hint">
      最多同时在线 {{ safeOnlineLimit }} 个；同一关连续失败 {{ safeFailureLimit }} 次锁停；
      单账号胜利 {{ safeWinLimit }} 次轮换；异常断线 {{ safeReconnectMinutes }} 分钟后重新排队。
    </n-alert>

    <n-card class="account-card-top" :content-style="{ padding: '12px 16px' }">
      <div class="account-toolbar">
        <n-input
          v-model:value="searchKeyword"
          clearable
          size="tiny"
          placeholder="搜索账号"
          class="search-input"
        />
        <n-checkbox
          :checked="allVisibleSelected"
          :indeterminate="someVisibleSelected"
          @update:checked="toggleAllVisible"
        >
          全选
        </n-checkbox>
        <div v-if="tokenGroups.length" class="group-list-inline">
          <button
            v-for="group in tokenGroups"
            :key="group.id"
            class="group-chip"
            :class="{ selected: selectedGroupIds.includes(group.id) }"
            :style="groupChipStyle(group)"
            @click="toggleGroup(group)"
          >
            {{ group.name }}
          </button>
        </div>
      </div>

      <div v-if="filteredTokens.length" class="token-grid">
        <div
          v-for="token in filteredTokens"
          :key="token.id"
          class="token-cell"
          :class="{ selected: selectedTokenIds.includes(token.id) }"
          @click="toggleToken(token.id, !selectedTokenIds.includes(token.id))"
        >
          <n-checkbox
            :checked="selectedTokenIds.includes(token.id)"
            @update:checked="(checked) => toggleToken(token.id, checked)"
            @click.stop
          />
          <span class="token-server" :title="token.server || '未知区服'">
            {{ token.server || "未知区服" }}
          </span>
          <span class="token-sep">-</span>
          <span class="token-name" :title="token.name || token.id">
            {{ token.name || token.id }}
          </span>
          <span
            class="status-dot"
            :class="getStatusClass(token.id)"
            :title="getStatusTitle(token.id)"
          ></span>
        </div>
      </div>
      <n-empty v-else description="暂无账号" size="small" />
    </n-card>

    <n-card class="control-card" :content-style="{ padding: '12px 16px' }">
      <div class="control-row">
        <div class="torch-field">
          <span class="torch-label">火把类型</span>
          <n-select
            v-model:value="torchItemId"
            :options="torchOptions"
            size="small"
            class="torch-select"
          />
        </div>
        <div class="torch-field">
          <span class="torch-label">使用数量（1-999）</span>
          <n-input-number
            v-model:value="torchQuantity"
            :min="1"
            :max="999"
            size="small"
            class="torch-input"
          />
        </div>
        <n-button
          size="small"
          type="primary"
          :disabled="!selectedTokenIds.length"
          :loading="torchRunning"
          @click="useTorchForSelected"
        >
          使用火把
        </n-button>
        <n-button
          type="primary"
          size="small"
          :disabled="!selectedTokenIds.length"
          @click="startSelected"
        >
          开始推图
        </n-button>
        <n-button
          type="error"
          size="small"
          :disabled="!hasSelectedManaged"
          @click="stopSelected"
        >
          停止所选
        </n-button>
        <div class="control-spacer"></div>
        <span class="status-text">
          已选 {{ selectedTokenIds.length }} · 在线/启动 {{ onlineCount }}/{{ safeOnlineLimit }} ·
          排队 {{ queuedCount }} · 冷却 {{ cooldownCount }} · 锁停 {{ blockedCount }} · 轮换中 {{ rotatingCount }}
        </span>
        <n-button size="small" @click="clearSelection">清除选择</n-button>
      </div>
    </n-card>

    <div v-if="runningCards.length" class="running-section">
      <n-card
        v-for="card in runningCards"
        :key="card.tokenId"
        class="running-card"
        :class="{
          active: card.status === STATUS.RUNNING,
          blocked: card.status === STATUS.BLOCKED,
          cooldown: card.status === STATUS.COOLDOWN,
        }"
      >
        <div class="running-head">
          <div class="card-title">
            <strong :title="card.tokenName">{{ card.tokenName }}</strong>
            <n-tag size="small" :type="card.statusType">{{ card.statusText }}</n-tag>
          </div>
          <n-space size="small">
            <n-tag size="small" type="success">{{ card.wins }}胜</n-tag>
            <n-tag size="small" type="error">{{ card.losses }}负</n-tag>
          </n-space>
        </div>
        <div class="level-line">当前关卡：{{ card.level > 0 ? `${card.level}关` : "--" }}</div>
        <div class="level-line">boss：{{ card.bossName || "--" }}</div>
        <div class="level-line">
          本关连续失败：{{ card.sameLevelFailures }}/{{ safeFailureLimit }}；
          本轮胜场：{{ card.roundWins }}/{{ safeWinLimit }}
        </div>
        <div class="level-line torch-line">{{ card.torchLabel }}</div>

        <div class="running-body">
          <template v-if="card.status === STATUS.RUNNING">
            <div class="countdown-row">
              <span class="countdown-text">战斗剩余 {{ formatDuration(card.countdown) }}</span>
              <n-progress
                class="inline-progress"
                type="line"
                :percentage="progressPercent(card)"
                :show-indicator="false"
                :height="8"
                status="success"
              />
            </div>
          </template>

          <template v-else-if="card.status === STATUS.COOLDOWN">
            <div class="countdown-row">
              <span class="countdown-text">重连剩余 {{ formatDuration(card.reconnectRemaining) }}</span>
              <n-progress
                class="inline-progress"
                type="line"
                :percentage="reconnectProgressPercent(card)"
                :show-indicator="false"
                :height="8"
                status="warning"
              />
            </div>
          </template>

          <template v-else>
            <div class="waiting-line">{{ card.waitingText }}</div>
          </template>

          <div class="card-actions">
            <span class="err-text" :title="card.lastError || '无'">
              {{ card.lastError || `已战斗 ${card.battles} 场` }}
            </span>
            <n-space size="small">
              <n-button
                v-if="canManualContinue(card)"
                size="tiny"
                type="primary"
                @click="manualContinue(card.tokenId)"
              >
                {{ card.status === STATUS.COOLDOWN ? "立即重连" : "继续推图" }}
              </n-button>
              <n-button
                v-if="canStopCard(card)"
                size="tiny"
                type="error"
                @click="stopOne(card.tokenId)"
              >
                停止
              </n-button>
            </n-space>
          </div>
        </div>
      </n-card>
    </div>

    <n-card class="log-card" :content-style="{ padding: '12px 16px' }">
      <template #header>
        <div class="log-header">
          <div>
            推图日志
            <n-tag size="small">{{ logs.length }}/2000 条</n-tag>
          </div>
          <div class="log-actions">
            <n-checkbox v-model:checked="autoScroll" size="small">自动滚动</n-checkbox>
            <n-checkbox v-model:checked="onlyErrors" size="small">只看错误</n-checkbox>
            <n-button size="tiny" @click="clearLogs">清空</n-button>
          </div>
        </div>
      </template>
      <div class="log-filter">
        <span class="log-filter-label">筛选账号：</span>
        <n-select
          v-model:value="logFilterTokenId"
          :options="logFilterOptions"
          size="small"
          clearable
          placeholder="全部账号"
          class="log-filter-select"
        />
        <n-button
          size="tiny"
          :disabled="!logFilterTokenId"
          @click="logFilterTokenId = null"
        >
          清除筛选
        </n-button>
        <span class="log-filter-count">共 {{ visibleLogs.length }} 条</span>
      </div>
      <div ref="logsContainer" class="log-container">
        <div
          v-for="(log, index) in visibleLogs"
          :key="`${log.time}-${index}`"
          class="log-item"
          :class="log.type"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-name">[{{ log.tokenName }}]</span>
          <span class="log-msg">{{ log.msg }}</span>
        </div>
        <n-empty v-if="!visibleLogs.length" description="暂无日志" size="small" />
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useMessage } from "naive-ui";
import { useTokenStore } from "@/stores/tokenStore";
import {
  PREEMPTION_EVENTS,
  taskPreemptionCoordinator,
} from "@/utils/taskPreemptionCoordinator";
import { BOSS_NAMES } from "./boss_names.js";

const MAX_LOGS = 2000;
const KNOWLEDGE_COIN_ITEM_ID = 1024;
const TORCH_REFRESH_INTERVAL = 30000;
const START_STAGGER_MS = 2000;
const SETTINGS_KEY = "pushing_levels_scheduler_settings_v2";
const PREEMPTION_SNAPSHOT_KEY = "xyzw_push_preemption_snapshot_v1";
const SESSION_RESTART_TIMEOUT_MS = 30000;
// PUSH_SCHEDULER_CYCLIC_ROTATION_V3
// 达到胜场阈值的账号只让出当前在线名额，并回到候选队尾，不再永久退出。

const STATUS = Object.freeze({
  IDLE: "idle",
  QUEUED: "queued",
  STARTING: "starting",
  RUNNING: "running",
  PREEMPTED: "preempted",
  COOLDOWN: "cooldown",
  BLOCKED: "blocked",
  ROTATED: "rotated",
  STOPPED: "stopped",
});

const message = useMessage();
const tokenStore = useTokenStore();

const selectedTokenIds = ref([]);
const selectedGroupIds = ref([]);
const campaignTokenIds = ref([]);
const queueOrder = ref([]);
const searchKeyword = ref("");
const autoContinue = ref(true);
const onlineAccountLimit = ref(30);
const sameLevelFailureLimit = ref(10);
const winRotationLimit = ref(50);
const reconnectDelayMinutes = ref(30);
const autoScroll = ref(true);
const onlyErrors = ref(false);
const logsContainer = ref(null);
const logs = ref([]);
const runningStates = reactive({});
const torchRunning = ref(false);
const torchItemId = ref(1008);
const torchQuantity = ref(150);
const logFilterTokenId = ref(null);
const tickNow = ref(Date.now());
const preemptionActive = ref(false);
const preemptionSnapshot = ref(null);

const sessionControllers = new Map();
const sessionPromises = new Map();

let tickTimer = null;
let presenceTimer = null;
let schedulerBusy = false;
let schedulerPending = false;
let destroyed = false;
let runSerial = 0;
let unsubscribePreemption = null;
let unsubscribeResume = null;
let preemptionChain = Promise.resolve();

const torchOptions = [
  { label: "木材火把", value: 1008 },
  { label: "青铜火把", value: 1009 },
  { label: "咸神火把", value: 1010 },
];

const clampInteger = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(number)));
};

const safeOnlineLimit = computed(() => clampInteger(onlineAccountLimit.value, 1, 200, 30));
const safeFailureLimit = computed(() => clampInteger(sameLevelFailureLimit.value, 1, 999999, 10));
const safeWinLimit = computed(() => clampInteger(winRotationLimit.value, 1, 999999, 50));
const safeReconnectMinutes = computed(() => clampInteger(reconnectDelayMinutes.value, 1, 1440, 30));

const tokens = computed(() => tokenStore.gameTokens || []);
const tokenGroups = computed(() => tokenStore.tokenGroups || []);

const filteredTokens = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase();
  const list = [...tokens.value].sort((a, b) => {
    const left = new Date(a.lastUsed || a.updatedAt || a.createdAt || 0).getTime();
    const right = new Date(b.lastUsed || b.updatedAt || b.createdAt || 0).getTime();
    return left - right;
  });

  if (!keyword) return list;
  return list.filter((token) => {
    return [token.name, token.server, token.remark, token.id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
  });
});

const onlineCount = computed(() => {
  return Object.values(runningStates).filter((state) => state?.slotHeld).length;
});

const queuedCount = computed(() => {
  return Object.values(runningStates).filter((state) => state?.status === STATUS.QUEUED).length;
});

const cooldownCount = computed(() => {
  return Object.values(runningStates).filter((state) => state?.status === STATUS.COOLDOWN).length;
});

const blockedCount = computed(() => {
  return Object.values(runningStates).filter((state) => state?.status === STATUS.BLOCKED).length;
});

const rotatingCount = computed(() => {
  return Object.values(runningStates).filter((state) => state?.status === STATUS.ROTATED).length;
});

const allVisibleSelected = computed(() => {
  return filteredTokens.value.length > 0
    && filteredTokens.value.every((token) => selectedTokenIds.value.includes(token.id));
});

const someVisibleSelected = computed(() => {
  return filteredTokens.value.some((token) => selectedTokenIds.value.includes(token.id))
    && !allVisibleSelected.value;
});

const hasSelectedManaged = computed(() => {
  return selectedTokenIds.value.some((tokenId) => {
    const state = runningStates[tokenId];
    return Boolean(
      state?.slotHeld
      || state?.status === STATUS.QUEUED
      || state?.status === STATUS.COOLDOWN,
    );
  });
});

function getTorchLabel(state) {
  if (!state) return "火把 无";
  const remaining = computeTorchRemaining(state);
  if (state.torchType > 0 && remaining > 0) {
    const name = state.torchTypeName || getTorchName(state.torchType);
    return `${name} ${formatTorchTime(remaining)}`;
  }
  return "火把 无";
}

function getStatusPresentation(status) {
  const map = {
    [STATUS.IDLE]: { text: "待启动", type: "default", waiting: "等待手动启动" },
    [STATUS.QUEUED]: { text: "排队中", type: "info", waiting: "等待在线名额" },
    [STATUS.STARTING]: { text: "连接中", type: "info", waiting: "正在建立连接" },
    [STATUS.RUNNING]: { text: "推图中", type: "success", waiting: "正在推图" },
    [STATUS.PREEMPTED]: { text: "日常抢占", type: "warning", waiting: "批量日常执行中，等待恢复" },
    [STATUS.COOLDOWN]: { text: "重连冷却", type: "warning", waiting: "异常断线，等待重新排队" },
    [STATUS.BLOCKED]: { text: "失败锁停", type: "error", waiting: "需手动继续，系统不会自动重连" },
    [STATUS.ROTATED]: { text: "轮换中", type: "success", waiting: "已达到胜场阈值，正在回到候选队尾" },
    [STATUS.STOPPED]: { text: "已停止", type: "default", waiting: "已手动停止" },
  };
  return map[status] || map[STATUS.IDLE];
}

const runningCards = computed(() => {
  const ids = new Set([...campaignTokenIds.value, ...selectedTokenIds.value]);
  Object.values(runningStates).forEach((state) => {
    if (state?.tokenId) ids.add(state.tokenId);
  });

  return [...ids]
    .filter((tokenId) => tokens.value.some((token) => token.id === tokenId))
    .map((tokenId) => {
      const token = getToken(tokenId);
      const state = runningStates[tokenId] || {};
      const level = Number(state.level || 0);
      const presentation = getStatusPresentation(state.status || STATUS.IDLE);
      const reconnectRemaining = state.status === STATUS.COOLDOWN
        ? Math.max(0, Math.ceil((Number(state.reconnectAt || 0) - tickNow.value) / 1000))
        : 0;

      return {
        tokenId,
        tokenName: token?.name || tokenId,
        status: state.status || STATUS.IDLE,
        statusText: presentation.text,
        statusType: presentation.type,
        waitingText: presentation.waiting,
        level,
        bossName:
          state.bossName && Number(state.bossLevel || 0) === level
            ? state.bossName
            : getBossName(level),
        wins: state.wins || 0,
        roundWins: state.roundWins || 0,
        losses: state.losses || 0,
        sameLevelFailures: state.sameLevelFailures || 0,
        battles: state.battles || 0,
        countdown: state.countdown || 0,
        totalTime: state.totalTime || 0,
        reconnectRemaining,
        reconnectDelaySeconds: Math.max(1, Math.ceil(Number(state.reconnectDelayMs || 0) / 1000)),
        lastError: state.lastError || "",
        torchLabel: getTorchLabel(state),
      };
    });
});

const visibleLogs = computed(() => {
  let list = logs.value;
  if (logFilterTokenId.value) {
    list = list.filter((log) => log.tokenId === logFilterTokenId.value);
  }
  if (onlyErrors.value) {
    list = list.filter((log) => log.type === "error");
  }
  return list;
});

const logFilterOptions = computed(() => {
  const map = new Map();
  logs.value.forEach((log) => {
    if (!map.has(log.tokenId)) {
      map.set(log.tokenId, { label: log.tokenName, value: log.tokenId });
    }
  });
  [...selectedTokenIds.value, ...campaignTokenIds.value].forEach((id) => {
    if (!map.has(id)) {
      const token = getToken(id);
      map.set(id, { label: token?.name || id, value: id });
    }
  });
  return Array.from(map.values());
});

watch(
  () => [visibleLogs.value.length, onlyErrors.value, logFilterTokenId.value],
  () => {
    if (!autoScroll.value) return;
    nextTick(() => {
      const element = logsContainer.value;
      if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    });
  },
);

watch(
  [onlineAccountLimit, sameLevelFailureLimit, winRotationLimit, reconnectDelayMinutes],
  () => {
    saveSettings();
    requestSchedule();
  },
);

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    onlineAccountLimit.value = clampInteger(saved.onlineAccountLimit, 1, 200, 30);
    sameLevelFailureLimit.value = clampInteger(saved.sameLevelFailureLimit, 1, 999999, 10);
    winRotationLimit.value = clampInteger(saved.winRotationLimit, 1, 999999, 50);
    reconnectDelayMinutes.value = clampInteger(saved.reconnectDelayMinutes, 1, 1440, 30);
  } catch {}
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      onlineAccountLimit: safeOnlineLimit.value,
      sameLevelFailureLimit: safeFailureLimit.value,
      winRotationLimit: safeWinLimit.value,
      reconnectDelayMinutes: safeReconnectMinutes.value,
    }));
  } catch {}
}

function getToken(tokenId) {
  return tokens.value.find((token) => token.id === tokenId);
}

function getTokenName(tokenId) {
  return getToken(tokenId)?.name || tokenId;
}

function getWebSocketStatus(tokenId) {
  return tokenStore.getWebSocketStatus(tokenId) || "disconnected";
}

function isConnected(tokenId) {
  return getWebSocketStatus(tokenId) === "connected";
}

function getStatusClass(tokenId) {
  const state = runningStates[tokenId];
  if (state?.status === STATUS.BLOCKED) return "status-red";
  if (state?.status === STATUS.COOLDOWN) return "status-orange";
  if (state?.status === STATUS.QUEUED) return "status-purple";
  const status = getWebSocketStatus(tokenId);
  if (status === "connected") return "status-green";
  if (status === "connecting") return "status-blue";
  if (status === "error") return "status-red";
  return "status-gray";
}

function getStatusTitle(tokenId) {
  const state = runningStates[tokenId];
  if (state) return getStatusPresentation(state.status).text;
  const status = getWebSocketStatus(tokenId);
  const map = {
    connected: "已连接",
    connecting: "连接中",
    disconnected: "未连接",
    error: "连接异常",
    disconnecting: "断开中",
  };
  return map[status] || "未连接";
}

function toggleToken(tokenId, checked) {
  if (checked) {
    selectedTokenIds.value = [...new Set([...selectedTokenIds.value, tokenId])];
  } else {
    selectedTokenIds.value = selectedTokenIds.value.filter((id) => id !== tokenId);
  }
}

function toggleAllVisible(checked) {
  const visibleIds = filteredTokens.value.map((token) => token.id);
  if (checked) {
    selectedTokenIds.value = [...new Set([...selectedTokenIds.value, ...visibleIds])];
    return;
  }
  const visibleSet = new Set(visibleIds);
  selectedTokenIds.value = selectedTokenIds.value.filter((id) => !visibleSet.has(id));
}

function toggleGroup(group) {
  const index = selectedGroupIds.value.indexOf(group.id);
  const validIds = (group.tokenIds || []).filter((tokenId) => getToken(tokenId));
  if (index >= 0) {
    selectedGroupIds.value.splice(index, 1);
    const groupSet = new Set(validIds);
    selectedTokenIds.value = selectedTokenIds.value.filter((tokenId) => !groupSet.has(tokenId));
  } else {
    selectedGroupIds.value.push(group.id);
    selectedTokenIds.value = [...new Set([...selectedTokenIds.value, ...validIds])];
  }
}

function groupChipStyle(group) {
  const selected = selectedGroupIds.value.includes(group.id);
  return selected
    ? { backgroundColor: group.color, borderColor: group.color, color: "#fff" }
    : { borderColor: group.color, color: group.color };
}

function createState(tokenId, tokenName) {
  return {
    tokenId,
    tokenName,
    status: STATUS.IDLE,
    running: false,
    slotHeld: false,
    stopFlag: false,
    manualStopped: false,
    preempted: false,
    failureLocked: false,
    rotationPending: false,
    connectedOnce: false,
    runId: 0,
    level: 0,
    bossName: "",
    bossLevel: 0,
    wins: 0,
    roundWins: 0,
    losses: 0,
    sameLevelFailures: 0,
    failureLevel: 0,
    battles: 0,
    countdown: 0,
    totalTime: 0,
    lastError: "",
    startTime: 0,
    consecutiveErrors: 0,
    reconnectAt: 0,
    reconnectDelayMs: 0,
    reconnectAttempts: 0,
    torchType: 0,
    torchTypeName: "",
    torchRemaining: 0,
    torchSettleTime: 0,
    torchActive: false,
    torchBaseTimestamp: 0,
    torchBaseRemaining: 0,
    lastTorchFetch: 0,
  };
}

function ensureState(tokenId) {
  if (!runningStates[tokenId]) {
    runningStates[tokenId] = createState(tokenId, getTokenName(tokenId));
  }
  return runningStates[tokenId];
}

function resetStateForManualRun(state) {
  state.status = STATUS.IDLE;
  state.running = false;
  state.slotHeld = false;
  state.stopFlag = false;
  state.manualStopped = false;
  state.preempted = false;
  state.failureLocked = false;
  state.rotationPending = false;
  state.connectedOnce = false;
  state.level = 0;
  state.bossName = "";
  state.bossLevel = 0;
  state.wins = 0;
  state.roundWins = 0;
  state.losses = 0;
  state.sameLevelFailures = 0;
  state.failureLevel = 0;
  state.battles = 0;
  state.countdown = 0;
  state.totalTime = 0;
  state.lastError = "";
  state.startTime = 0;
  state.consecutiveErrors = 0;
  state.reconnectAt = 0;
  state.reconnectDelayMs = 0;
  state.reconnectAttempts = 0;
}

function addLog(tokenId, tokenName, msg, type = "info") {
  logs.value.push({
    time: new Date().toLocaleTimeString(),
    tokenId,
    tokenName,
    msg,
    type,
  });
  if (logs.value.length > MAX_LOGS) {
    logs.value.splice(0, logs.value.length - MAX_LOGS);
  }
}

function clearLogs() {
  logs.value = [];
}

function sanitizeError(error) {
  return String(error?.message || error || "未知错误")
    .replace(/请求超时: \w+(\s*\(\d+ms\))?/g, "请求超时")
    .trim();
}

function pickNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function responseBody(response) {
  if (response?.body && typeof response.body === "object") return response.body;
  return response || {};
}

function getTorchName(torchType) {
  if (!torchType || torchType === 0) return "";
  const option = torchOptions.find((item) => item.value === torchType);
  return option ? option.label : `火把(${torchType})`;
}

function applyTorchInfo(state, info) {
  if (!state || !info) return;
  const type = Number(info.torchType || 0);
  const remaining = Number(info.torchRemaining || 0);
  const settleTime = Number(info.torchSettleTime || 0);
  state.torchType = type;
  state.torchTypeName = getTorchName(type);
  state.torchRemaining = remaining;
  state.torchSettleTime = settleTime;
  state.torchActive = type > 0 && remaining > 0;
  state.torchBaseTimestamp = Date.now();
  state.torchBaseRemaining = remaining;
  state.lastTorchFetch = Date.now();
}

function readTorchFromResponse(response) {
  const body = responseBody(response);
  const role = body.role || body.body?.role || {};
  return {
    torchType: pickNumber(role.autoClickType, body.autoClickType) || 0,
    torchRemaining: pickNumber(role.autoClickTime, body.autoClickTime) || 0,
    torchSettleTime: pickNumber(role.autoClickSettleTime, body.autoClickSettleTime) || 0,
  };
}

function computeTorchRemaining(state) {
  if (!state) return 0;
  if (state.torchSettleTime > 0) {
    const settleMs = state.torchSettleTime < 1e12
      ? state.torchSettleTime * 1000
      : state.torchSettleTime;
    if (settleMs > tickNow.value) {
      return Math.max(0, Math.floor((settleMs - tickNow.value) / 1000));
    }
  }
  if (state.torchBaseTimestamp && state.torchBaseRemaining) {
    const diff = state.torchBaseRemaining
      - Math.floor((tickNow.value - state.torchBaseTimestamp) / 1000);
    return Math.max(0, diff);
  }
  return Number(state.torchRemaining || 0);
}

function formatTorchTime(seconds) {
  if (!seconds || seconds <= 0) return "0分钟";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

function getBossName(level) {
  if (!level || level <= 0) return "";
  return BOSS_NAMES[level] || "";
}

function applyLevel(state, level, serverBossName = "") {
  if (!state) return;
  const previousLevel = Number(state.level || 0);
  const nextLevel = Number(level) || 0;
  if (nextLevel > 0) state.level = nextLevel;

  if (previousLevel > 0 && state.level !== previousLevel) {
    state.sameLevelFailures = 0;
    state.failureLevel = state.level;
  }

  if (serverBossName) {
    state.bossName = serverBossName;
    state.bossLevel = state.level;
    return;
  }
  if (state.bossLevel !== state.level || !state.bossName) {
    state.bossName = getBossName(state.level);
    state.bossLevel = state.level;
  }
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return minutes > 0 ? `${minutes}m${rest}s` : `${rest}s`;
}

function progressPercent(card) {
  if (!card.totalTime) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - card.countdown / card.totalTime) * 100)));
}

function reconnectProgressPercent(card) {
  if (!card.reconnectDelaySeconds) return 0;
  return Math.max(
    0,
    Math.min(100, Math.round((1 - card.reconnectRemaining / card.reconnectDelaySeconds) * 100)),
  );
}

function createAbortError(reason = "操作已取消") {
  const message = typeof reason === "string" ? reason : reason?.message || "操作已取消";
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function isAbortError(error) {
  return error?.name === "AbortError" || String(error?.message || "").includes("操作已取消");
}

function sleep(ms, signal = null) {
  if (signal?.aborted) return Promise.reject(createAbortError(signal.reason));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(createAbortError(signal?.reason));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function isCurrentRun(state, runId, signal = null) {
  return Boolean(
    !destroyed
    && state
    && state.runId === runId
    && !state.stopFlag
    && !state.preempted
    && !signal?.aborted,
  );
}

function isSocketError(error) {
  const text = sanitizeError(error).toLowerCase();
  return [
    "websocket",
    "socket",
    "未连接",
    "连接已关闭",
    "disconnected",
    "closed",
    "network",
  ].some((keyword) => text.includes(keyword));
}

function setManagedReconnect(tokenId, managed) {
  try {
    const client = tokenStore.getWebSocketClient?.(tokenId);
    if (!client) return;
    if (typeof client.setAutoReconnectEnabled === "function") {
      client.setAutoReconnectEnabled(!managed);
    } else {
      client.autoReconnectEnabled = !managed;
    }
  } catch {}
}

async function closeConnectionAndWait(tokenId) {
  try {
    if (typeof tokenStore.closeWebSocketConnectionAsync === "function") {
      await tokenStore.closeWebSocketConnectionAsync(tokenId);
      return;
    }
    tokenStore.closeWebSocketConnection(tokenId);
    const startedAt = Date.now();
    while (Date.now() - startedAt < 6000) {
      if (getWebSocketStatus(tokenId) === "disconnected") return;
      await sleep(100);
    }
  } catch (error) {
    console.warn(`关闭推图连接失败 [${tokenId}]`, error);
  }
}

async function waitConnected(tokenId, state, runId, timeoutMs = 8000, signal = null) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!isCurrentRun(state, runId, signal)) return false;
    if (isConnected(tokenId)) return true;
    await sleep(200, signal);
  }
  return isConnected(tokenId);
}

async function connectForPush(tokenId, state, runId, signal) {
  if (isConnected(tokenId)) {
    setManagedReconnect(tokenId, true);
    state.connectedOnce = true;
    return true;
  }

  const token = getToken(tokenId);
  if (!token) throw new Error("未找到账号数据");

  state.status = STATUS.STARTING;
  state.lastError = "";
  await tokenStore.createWebSocketConnection(tokenId, token.token, token.wsUrl);
  if (!await waitConnected(tokenId, state, runId, 8000, signal)) {
    throw new Error("WebSocket 连接失败或超时");
  }

  if (!isCurrentRun(state, runId, signal)) return false;
  setManagedReconnect(tokenId, true);
  state.connectedOnce = true;
  return true;
}

function addToCampaign(tokenId) {
  if (!campaignTokenIds.value.includes(tokenId)) {
    campaignTokenIds.value.push(tokenId);
  }
}

function removeFromQueue(tokenId) {
  queueOrder.value = queueOrder.value.filter((id) => id !== tokenId);
}

function canAutoQueue(state) {
  return Boolean(
    state
    && !preemptionActive.value
    && campaignTokenIds.value.includes(state.tokenId)
    && !state.slotHeld
    && !state.manualStopped
    && !state.preempted
    && !state.failureLocked
    && !state.rotationPending
    && state.status !== STATUS.COOLDOWN,
  );
}

function hasQueuedReplacement(tokenId) {
  return queueOrder.value.some((candidateId) => {
    return candidateId !== tokenId && canAutoQueue(runningStates[candidateId]);
  });
}

function enqueue(tokenId, { front = false } = {}) {
  const state = ensureState(tokenId);
  if (!canAutoQueue(state)) return false;
  if (queueOrder.value.includes(tokenId)) return true;

  state.status = STATUS.QUEUED;
  state.running = false;
  state.stopFlag = false;
  if (front) queueOrder.value.unshift(tokenId);
  else queueOrder.value.push(tokenId);
  requestSchedule();
  return true;
}

function requestSchedule() {
  if (destroyed || preemptionActive.value) return;
  schedulerPending = true;
  queueMicrotask(() => {
    drainQueue().catch((error) => {
      console.error("推图调度异常", error);
    });
  });
}

function launchAccountSession(tokenId, state) {
  const previousController = sessionControllers.get(tokenId);
  if (previousController && !previousController.signal.aborted) {
    previousController.abort(createAbortError("创建新的推图会话"));
  }

  const controller = new AbortController();
  const runId = ++runSerial;
  sessionControllers.set(tokenId, controller);
  state.slotHeld = true;
  state.running = true;
  state.status = STATUS.STARTING;
  state.stopFlag = false;
  state.preempted = false;
  state.runId = runId;

  const promise = runAccountSession(tokenId, runId, controller.signal)
    .catch((error) => {
      if (!isAbortError(error)) {
        addLog(tokenId, getTokenName(tokenId), `账号任务异常：${sanitizeError(error)}`, "error");
      }
    })
    .finally(() => {
      if (sessionControllers.get(tokenId) === controller) {
        sessionControllers.delete(tokenId);
      }
      if (sessionPromises.get(tokenId) === promise) {
        sessionPromises.delete(tokenId);
      }
    });

  sessionPromises.set(tokenId, promise);
  return { runId, promise };
}

async function drainQueue() {
  if (schedulerBusy || destroyed || preemptionActive.value) return;
  schedulerBusy = true;
  try {
    while (!destroyed && !preemptionActive.value) {
      schedulerPending = false;
      let launched = false;

      while (!preemptionActive.value && onlineCount.value < safeOnlineLimit.value) {
        const index = queueOrder.value.findIndex((tokenId) => canAutoQueue(runningStates[tokenId]));
        if (index < 0) break;

        const [tokenId] = queueOrder.value.splice(index, 1);
        const state = ensureState(tokenId);
        launchAccountSession(tokenId, state);
        launched = true;

        if (onlineCount.value < safeOnlineLimit.value) {
          await sleep(START_STAGGER_MS);
        }
      }

      if (!schedulerPending && !launched) break;
      if (!schedulerPending && launched && onlineCount.value >= safeOnlineLimit.value) break;
    }
  } finally {
    schedulerBusy = false;
    if (schedulerPending && !destroyed) requestSchedule();
  }
}

async function enterReconnectCooldown(state, error) {
  if (
    !state
    || preemptionActive.value
    || state.preempted
    || state.manualStopped
    || state.failureLocked
    || state.rotationPending
  ) return;
  const delayMs = safeReconnectMinutes.value * 60 * 1000;
  state.lastError = sanitizeError(error || "异常断线");
  state.reconnectDelayMs = delayMs;
  state.reconnectAt = Date.now() + delayMs;
  state.reconnectAttempts += 1;
  state.status = STATUS.COOLDOWN;
  state.stopFlag = true;
  state.running = false;
  state.countdown = 0;
  removeFromQueue(state.tokenId);
  addLog(
    state.tokenId,
    state.tokenName,
    `疑似顶号/异常断线，${safeReconnectMinutes.value} 分钟后重新排队（不占在线名额）`,
    "warning",
  );
  try {
    setManagedReconnect(state.tokenId, true);
    await closeConnectionAndWait(state.tokenId);
  } catch {}
}

function processCooldowns() {
  if (preemptionActive.value) return;
  const now = Date.now();
  Object.values(runningStates).forEach((state) => {
    if (!state || state.status !== STATUS.COOLDOWN) return;
    if (state.manualStopped || state.failureLocked || state.rotationPending) return;
    if (now < Number(state.reconnectAt || 0)) return;

    state.reconnectAt = 0;
    state.reconnectDelayMs = 0;
    state.stopFlag = false;
    state.status = STATUS.IDLE;
    state.lastError = "冷却结束，等待在线名额";
    addLog(state.tokenId, state.tokenName, "自动重连冷却结束，已重新加入推图队列", "info");
    enqueue(state.tokenId);
  });
}

async function fetchTorchInfo(tokenId, tokenName, { silent = false, signal = null } = {}) {
  if (!isConnected(tokenId)) return null;
  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
      10000,
      signal,
    );
    const state = ensureState(tokenId);
    applyTorchInfo(state, readTorchFromResponse(response));
    if (!silent) {
      addLog(
        tokenId,
        tokenName,
        state.torchType > 0
          ? `火把状态：${state.torchTypeName} ${formatTorchTime(state.torchRemaining)}`
          : "当前没有使用中的火把",
        "info",
      );
    }
    return state;
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (!silent) addLog(tokenId, tokenName, `获取火把信息失败：${sanitizeError(error)}`, "warning");
    return null;
  }
}

async function initializeBattleData(tokenId, tokenName, signal) {
  try {
    await tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}, 10000, signal);
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_startlevel",
      {},
      10000,
      signal,
    );
    const version = response?.battleData?.version || response?.body?.battleData?.version;
    if (version) {
      tokenStore.setBattleVersion(version);
      addLog(tokenId, tokenName, `battleVersion: ${version}`, "info");
    }
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (isSocketError(error)) throw error;
    addLog(tokenId, tokenName, `初始化战斗数据失败：${sanitizeError(error)}`, "warning");
  }
}

async function syncAccountState(tokenId, tokenName, state, signal) {
  const roleInfo = await tokenStore.sendMessageWithPromise(
    tokenId,
    "role_getroleinfo",
    {},
    10000,
    signal,
  );
  const body = responseBody(roleInfo);
  const level = pickNumber(body.levelId, body.body?.levelId, body.currLevel);
  if (level !== null) {
    applyLevel(state, level);
    addLog(tokenId, tokenName, `当前关卡：${level}`, "info");
  }

  try {
    const levelInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_level",
      {},
      10000,
      signal,
    );
    const bossName = levelInfo?.bossName || levelInfo?.body?.bossName || levelInfo?.role?.bossName || "";
    applyLevel(state, level || state.level, bossName);
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (isSocketError(error)) throw error;
    addLog(tokenId, tokenName, `获取BOSS信息失败：${sanitizeError(error)}`, "info");
  }

  await fetchTorchInfo(tokenId, tokenName, { silent: true, signal });
}

async function upgradeHangupReward(tokenId, tokenName, state, runId, signal) {
  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
      5000,
      signal,
    );
    const items = roleInfo?.role?.items || roleInfo?.body?.role?.items || roleInfo?.items || [];
    let coinCount = 0;
    if (Array.isArray(items)) {
      const coin = items.find((entry) => Number(entry.id ?? entry.itemId) === KNOWLEDGE_COIN_ITEM_ID);
      coinCount = Number(coin?.num ?? coin?.count ?? coin?.quantity ?? 0);
    } else if (items && typeof items === "object") {
      coinCount = Number(items[KNOWLEDGE_COIN_ITEM_ID]?.num ?? items[KNOWLEDGE_COIN_ITEM_ID] ?? 0);
    }

    let used = 0;
    while (coinCount > 0 && isCurrentRun(state, runId, signal) && isConnected(tokenId)) {
      const upgradeNum = coinCount >= 50 ? 50 : coinCount >= 10 ? 10 : 1;
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "system_hangupupgrade",
        { upgradeNum },
        5000,
        signal,
      );
      coinCount -= upgradeNum;
      used += upgradeNum;
      await sleep(1200, signal);
    }
    if (used > 0) addLog(tokenId, tokenName, `升级挂机奖励完成，共用 ${used} 个知识币`, "success");
  } catch (error) {
    if (isAbortError(error)) throw error;
    if (isSocketError(error)) throw error;
    addLog(tokenId, tokenName, `升级挂机奖励异常：${sanitizeError(error)}`, "warning");
  }
}

function recordLevelFailure(state) {
  const currentLevel = Number(state.level || 0);
  if (state.failureLevel !== currentLevel) {
    state.failureLevel = currentLevel;
    state.sameLevelFailures = 0;
  }
  state.sameLevelFailures += 1;
  state.losses += 1;
}

function lockForLevelFailures(state) {
  state.failureLocked = true;
  state.manualStopped = false;
  state.status = STATUS.BLOCKED;
  state.stopFlag = true;
  state.running = false;
  state.reconnectAt = 0;
  removeFromQueue(state.tokenId);
  addLog(
    state.tokenId,
    state.tokenName,
    `同一关卡连续失败 ${state.sameLevelFailures} 次，已锁停；仅可手动继续`,
    "error",
  );
}

function rotateAfterWins(state) {
  const completedRoundWins = Number(state.roundWins || 0);
  state.rotationPending = true;
  state.manualStopped = false;
  state.status = STATUS.ROTATED;
  state.stopFlag = true;
  state.running = false;
  removeFromQueue(state.tokenId);
  addLog(
    state.tokenId,
    state.tokenName,
    `本轮已胜利 ${completedRoundWins} 次，释放在线名额并回到候选队尾`,
    "success",
  );
}

async function runOneBattle(tokenId, tokenName, state, runId, signal) {
  if (!isCurrentRun(state, runId, signal)) return { stopped: true };
  if (!isConnected(tokenId)) return { disconnected: true, error: "WebSocket 已断开" };

  let battleTime = 0;
  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_calcleveltime",
      {},
      15000,
      signal,
    );
    const body = responseBody(response);
    battleTime = pickNumber(body.battleTime, body.body?.battleTime) || 0;
    const syncedLevel = pickNumber(body.currLevel, body.levelId, body.body?.currLevel);
    const syncedBossName = body.bossName || body.body?.bossName || body.role?.bossName || "";
    if (syncedLevel !== null) applyLevel(state, syncedLevel, syncedBossName);
    else applyLevel(state, state.level, syncedBossName);
  } catch (error) {
    if (isAbortError(error)) return { stopped: true };
    if (isSocketError(error) || !isConnected(tokenId)) {
      return { disconnected: true, error };
    }
    state.consecutiveErrors += 1;
    state.lastError = sanitizeError(error);
    addLog(tokenId, tokenName, `计算战斗时间异常：${state.lastError}`, "error");
    return { success: false, retryable: true };
  }

  if (battleTime <= 0) {
    state.consecutiveErrors += 1;
    state.lastError = "服务器未返回有效战斗时间";
    addLog(tokenId, tokenName, state.lastError, "warning");
    return { success: false, retryable: true };
  }

  state.totalTime = battleTime;
  state.countdown = battleTime;
  state.battles += 1;
  addLog(tokenId, tokenName, `开始关卡 ${state.level || 0}，预计 ${battleTime}s`, "info");

  if (state.level > 0 && state.level % 100 === 1) {
    try {
      await upgradeHangupReward(tokenId, tokenName, state, runId, signal);
    } catch (error) {
      if (isAbortError(error)) return { stopped: true };
      return { disconnected: true, error };
    }
  }

  const startedAt = Date.now();
  let heartbeatTick = 0;
  while (state.countdown > 0 && isCurrentRun(state, runId, signal)) {
    try {
      await sleep(1000, signal);
    } catch (error) {
      if (isAbortError(error)) return { stopped: true };
      throw error;
    }
    if (!isCurrentRun(state, runId, signal)) return { stopped: true };
    if (!isConnected(tokenId)) return { disconnected: true, error: "战斗中连接断开" };
    heartbeatTick += 1;
    state.countdown = Math.max(
      0,
      Math.ceil((battleTime * 1000 - (Date.now() - startedAt)) / 1000),
    );
    if (heartbeatTick % 25 === 0) {
      try {
        tokenStore.sendMessage(tokenId, "heart_beat");
      } catch {}
    }
  }

  if (!isCurrentRun(state, runId, signal)) return { stopped: true };

  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "fight_level",
      {},
      15000,
      signal,
    );
    const body = responseBody(response);
    const success = Boolean(body.success || body.isWin);
    const nextLevel = pickNumber(body.currLevel, body.nextLevel, body.levelId);
    const nextBossName = body.bossName || body.body?.bossName || body.role?.bossName || "";

    if (success) {
      state.wins += 1;
      state.roundWins = Number(state.roundWins || 0) + 1;
      state.sameLevelFailures = 0;
      state.failureLevel = Number(nextLevel || state.level + 1);
      state.consecutiveErrors = 0;
      state.lastError = "";
      applyLevel(state, nextLevel || state.level + 1, nextBossName);
      addLog(tokenId, tokenName, `胜利，当前关卡 ${state.level}`, "success");
      fetchTorchInfo(tokenId, tokenName, { silent: true, signal }).catch(() => {});
      return { success: true };
    }

    recordLevelFailure(state);
    state.lastError = body.code || body.msg || "服务器判定失败";
    if (state.sameLevelFailures >= safeFailureLimit.value) {
      lockForLevelFailures(state);
      return { success: false, blocked: true };
    }
    addLog(
      tokenId,
      tokenName,
      `本关失败 ${state.sameLevelFailures}/${safeFailureLimit.value} 次`,
      "warning",
    );
    return { success: false };
  } catch (error) {
    if (isAbortError(error)) return { stopped: true };
    if (isSocketError(error) || !isConnected(tokenId)) {
      return { disconnected: true, error };
    }
    state.consecutiveErrors += 1;
    state.lastError = sanitizeError(error);
    addLog(tokenId, tokenName, `战斗结算异常：${state.lastError}`, "error");
    if (state.consecutiveErrors >= 5) {
      return { disconnected: true, error: `连续战斗异常 ${state.consecutiveErrors} 次` };
    }
    return { success: false, retryable: true };
  }
}

async function runAccountSession(tokenId, runId, signal) {
  const state = ensureState(tokenId);
  const tokenName = state.tokenName;
  state.startTime = state.startTime || Date.now();
  addLog(tokenId, tokenName, state.reconnectAttempts > 0 ? "开始自动重连并恢复推图" : "开始推图", "success");

  try {
    if (!await connectForPush(tokenId, state, runId, signal)) return;
    if (!isCurrentRun(state, runId, signal)) return;

    await initializeBattleData(tokenId, tokenName, signal);
    if (!isCurrentRun(state, runId, signal)) return;
    await syncAccountState(tokenId, tokenName, state, signal);
    if (!isCurrentRun(state, runId, signal)) return;

    state.status = STATUS.RUNNING;
    state.lastError = "";
    addLog(tokenId, tokenName, "连接及关卡同步完成，开始主线循环", "info");

    while (isCurrentRun(state, runId, signal)) {
      if (!isConnected(tokenId)) {
        await enterReconnectCooldown(state, "WebSocket 异常断开");
        break;
      }

      if (Date.now() - (state.lastTorchFetch || 0) > TORCH_REFRESH_INTERVAL) {
        fetchTorchInfo(tokenId, tokenName, { silent: true, signal }).catch(() => {});
      }

      const result = await runOneBattle(tokenId, tokenName, state, runId, signal);
      if (result.stopped || state.failureLocked || state.rotationPending || state.manualStopped) break;
      if (result.disconnected) {
        await enterReconnectCooldown(state, result.error);
        break;
      }

      if (result.success && state.roundWins >= safeWinLimit.value) {
        if (hasQueuedReplacement(tokenId)) {
          rotateAfterWins(state);
          break;
        }

        addLog(
          tokenId,
          tokenName,
          `本轮已胜利 ${state.roundWins} 次，但当前没有候补账号，清零本轮计数并继续推图`,
          "info",
        );
        state.roundWins = 0;
      }

      if (result.success && !autoContinue.value) {
        state.manualStopped = true;
        state.stopFlag = true;
        state.status = STATUS.STOPPED;
        addLog(tokenId, tokenName, "自动继续已关闭，单场结束后停止", "warning");
        break;
      }

      await sleep(result.success ? 2000 : 3000, signal);
    }
  } catch (error) {
    if (isAbortError(error) || state.preempted || preemptionActive.value) {
      // 抢占或手动停止属于预期控制流，不进入异常重连。
    } else if (
      isCurrentRun(state, runId, signal)
      || (!state.manualStopped && !state.failureLocked && !state.rotationPending)
    ) {
      await enterReconnectCooldown(state, error);
    }
  } finally {
    if (state.runId !== runId) return;
    const wasPreempted = Boolean(state.preempted && preemptionActive.value);
    const shouldRequeueAfterRotation = Boolean(
      state.rotationPending
      && !state.manualStopped
      && !state.failureLocked
      && campaignTokenIds.value.includes(tokenId)
      && !destroyed
      && !preemptionActive.value,
    );
    const completedRoundWins = Number(state.roundWins || 0);
    state.slotHeld = false;
    state.running = false;
    if (wasPreempted) {
      state.status = STATUS.PREEMPTED;
      state.stopFlag = true;
      state.countdown = 0;
      state.lastError = "批量日常任务抢占，等待恢复";
    } else if (
      state.status !== STATUS.COOLDOWN
      && state.status !== STATUS.BLOCKED
      && state.status !== STATUS.ROTATED
    ) {
      if (state.manualStopped || state.stopFlag) state.status = STATUS.STOPPED;
    }
    if (state.status !== STATUS.COOLDOWN) state.countdown = 0;

    try {
      setManagedReconnect(tokenId, true);
      await closeConnectionAndWait(tokenId);
    } catch {}

    if (wasPreempted) {
      addLog(tokenId, tokenName, "推图会话已中断并释放连接，等待批量日常完成", "warning");
      return;
    }

    const elapsed = state.startTime ? Math.round((Date.now() - state.startTime) / 1000) : 0;
    addLog(
      tokenId,
      tokenName,
      shouldRequeueAfterRotation
        ? `本轮在线结束：${completedRoundWins} 胜，累计 ${state.wins} 胜；已排到候选队尾`
        : `本次在线结束：累计 ${state.wins}胜 ${state.losses}负，共 ${state.battles} 场，耗时 ${elapsed}s`,
      state.status === STATUS.BLOCKED ? "error" : "info",
    );

    if (shouldRequeueAfterRotation) {
      state.rotationPending = false;
      state.status = STATUS.IDLE;
      state.stopFlag = false;
      state.roundWins = 0;
      state.startTime = 0;
      state.consecutiveErrors = 0;
      state.lastError = "轮换完成，等待在线名额";
      enqueue(tokenId);
    }
    requestSchedule();
  }
}

const SNAPSHOT_STATE_FIELDS = [
  "status",
  "manualStopped",
  "failureLocked",
  "rotationPending",
  "level",
  "bossName",
  "bossLevel",
  "wins",
  "roundWins",
  "losses",
  "sameLevelFailures",
  "failureLevel",
  "battles",
  "totalTime",
  "lastError",
  "startTime",
  "consecutiveErrors",
  "reconnectAt",
  "reconnectDelayMs",
  "reconnectAttempts",
  "torchType",
  "torchTypeName",
  "torchRemaining",
  "torchSettleTime",
  "torchActive",
  "torchBaseTimestamp",
  "torchBaseRemaining",
  "lastTorchFetch",
];

function snapshotState(state) {
  return SNAPSHOT_STATE_FIELDS.reduce((result, field) => {
    result[field] = state?.[field];
    return result;
  }, {});
}

function buildPreemptionSnapshot(payload) {
  const campaignIds = [...campaignTokenIds.value];
  const activeTokenIds = campaignIds.filter((tokenId) => {
    const state = runningStates[tokenId];
    return Boolean(
      state?.slotHeld
      || state?.running
      || state?.status === STATUS.STARTING
      || state?.status === STATUS.RUNNING,
    );
  });

  return {
    version: 1,
    requestId: payload.requestId,
    requestIds: [payload.requestId],
    taskId: payload.taskId || null,
    taskName: payload.taskName || "批量日常",
    createdAt: Date.now(),
    campaignTokenIds: campaignIds,
    selectedTokenIds: [...selectedTokenIds.value],
    queueOrder: [...queueOrder.value],
    activeTokenIds,
    settings: {
      autoContinue: autoContinue.value,
      onlineAccountLimit: safeOnlineLimit.value,
      sameLevelFailureLimit: safeFailureLimit.value,
      winRotationLimit: safeWinLimit.value,
      reconnectDelayMinutes: safeReconnectMinutes.value,
    },
    states: Object.fromEntries(
      campaignIds.map((tokenId) => [tokenId, snapshotState(ensureState(tokenId))]),
    ),
  };
}

function persistPreemptionSnapshot(snapshot) {
  try {
    sessionStorage.setItem(PREEMPTION_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.warn("保存推图抢占快照失败", error);
  }
}

function clearPreemptionSnapshot() {
  preemptionSnapshot.value = null;
  try {
    sessionStorage.removeItem(PREEMPTION_SNAPSHOT_KEY);
  } catch {}
}

function updatePushPresence() {
  taskPreemptionCoordinator.setPushPresence({
    active: campaignTokenIds.value.length > 0 && !preemptionActive.value,
    preempted: preemptionActive.value && Boolean(preemptionSnapshot.value),
    campaignSize: campaignTokenIds.value.length,
  });
}

function serializePreemptionOperation(operation) {
  const next = preemptionChain.then(operation, operation);
  preemptionChain = next.catch(() => {});
  return next;
}

async function preemptPushSessions(payload) {
  if (preemptionActive.value && preemptionSnapshot.value) {
    if (!preemptionSnapshot.value.requestIds.includes(payload.requestId)) {
      preemptionSnapshot.value.requestIds.push(payload.requestId);
      persistPreemptionSnapshot(preemptionSnapshot.value);
    }
    return {
      requestId: payload.requestId,
      acknowledged: true,
      ready: true,
      hadActivePush: preemptionSnapshot.value.campaignTokenIds.length > 0,
      activeTokenIds: [...preemptionSnapshot.value.activeTokenIds],
    };
  }

  if (!campaignTokenIds.value.length) {
    return {
      requestId: payload.requestId,
      acknowledged: true,
      ready: true,
      hadActivePush: false,
      activeTokenIds: [],
    };
  }

  const snapshot = buildPreemptionSnapshot(payload);
  preemptionActive.value = true;
  preemptionSnapshot.value = snapshot;
  persistPreemptionSnapshot(snapshot);
  queueOrder.value = [];
  schedulerPending = false;

  addLog(
    "system",
    "系统",
    `定时任务「${snapshot.taskName}」即将执行，正在中断 ${snapshot.activeTokenIds.length} 个推图会话`,
    "warning",
  );

  snapshot.campaignTokenIds.forEach((tokenId) => {
    const state = ensureState(tokenId);
    if (state.failureLocked || state.manualStopped) return;
    state.preempted = true;
    state.stopFlag = true;
    state.running = false;
    state.status = STATUS.PREEMPTED;
    state.countdown = 0;
    const controller = sessionControllers.get(tokenId);
    if (controller && !controller.signal.aborted) {
      controller.abort(createAbortError("批量日常任务抢占"));
    }
  });

  const runningPromises = snapshot.activeTokenIds
    .map((tokenId) => sessionPromises.get(tokenId))
    .filter(Boolean);
  await Promise.allSettled(runningPromises);

  // runAccountSession 的 finally 已关闭连接；这里再次确认，避免旧 Session 残留。
  for (const tokenId of snapshot.activeTokenIds) {
    await closeConnectionAndWait(tokenId);
    const state = ensureState(tokenId);
    state.slotHeld = false;
    state.running = false;
    state.status = STATUS.PREEMPTED;
  }

  updatePushPresence();
  return {
    requestId: payload.requestId,
    acknowledged: true,
    ready: true,
    hadActivePush: snapshot.campaignTokenIds.length > 0,
    activeTokenIds: [...snapshot.activeTokenIds],
  };
}

async function waitForSessionRestart(state, runId, timeoutMs = SESSION_RESTART_TIMEOUT_MS) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (state.runId !== runId) return false;
    if (state.status === STATUS.RUNNING && isConnected(state.tokenId)) return true;
    if ([STATUS.COOLDOWN, STATUS.BLOCKED, STATUS.STOPPED].includes(state.status)) return false;
    await sleep(200);
  }
  return state.status === STATUS.RUNNING && isConnected(state.tokenId);
}

async function resumePushSessions(payload) {
  const snapshot = preemptionSnapshot.value;
  if (!snapshot || !snapshot.requestIds.includes(payload.requestId)) {
    return {
      requestId: payload.requestId,
      resumed: false,
      reason: "snapshot-not-found",
    };
  }

  const validCampaignIds = snapshot.campaignTokenIds.filter((tokenId) => {
    const state = ensureState(tokenId);
    const savedState = snapshot.states[tokenId] || {};
    const stoppedWhilePreempted = state.manualStopped && !savedState.manualStopped;
    return Boolean(getToken(tokenId) && !stoppedWhilePreempted);
  });

  campaignTokenIds.value = [...validCampaignIds];
  selectedTokenIds.value = snapshot.selectedTokenIds.filter((tokenId) => getToken(tokenId));
  queueOrder.value = [];

  validCampaignIds.forEach((tokenId) => {
    const state = ensureState(tokenId);
    const savedState = snapshot.states[tokenId];
    if (savedState) Object.assign(state, savedState);
    state.slotHeld = false;
    state.running = false;
    state.countdown = 0;
    state.preempted = false;
    state.stopFlag = false;
  });

  const activeIds = snapshot.activeTokenIds.filter((tokenId) => {
    const state = runningStates[tokenId];
    return validCampaignIds.includes(tokenId) && state && !state.failureLocked && !state.manualStopped;
  });

  let resumedCount = 0;
  for (const tokenId of activeIds) {
    const state = ensureState(tokenId);
    await closeConnectionAndWait(tokenId);
    const { runId } = launchAccountSession(tokenId, state);
    const ready = await waitForSessionRestart(state, runId);
    if (ready) resumedCount += 1;
    await sleep(300);
  }

  const activeSet = new Set(activeIds);
  const savedQueue = snapshot.queueOrder.filter(
    (tokenId) => validCampaignIds.includes(tokenId) && !activeSet.has(tokenId),
  );
  const remainingIds = validCampaignIds.filter(
    (tokenId) => !activeSet.has(tokenId) && !savedQueue.includes(tokenId),
  );

  preemptionActive.value = false;
  [...savedQueue, ...remainingIds].forEach((tokenId) => {
    const state = ensureState(tokenId);
    state.preempted = false;
    if (state.failureLocked) {
      state.status = STATUS.BLOCKED;
      return;
    }
    if (state.status === STATUS.COOLDOWN && Number(state.reconnectAt || 0) > Date.now()) return;
    state.status = STATUS.IDLE;
    state.stopFlag = false;
    enqueue(tokenId);
  });

  clearPreemptionSnapshot();
  updatePushPresence();
  requestSchedule();
  addLog(
    "system",
    "系统",
    `批量日常已结束，已串行重建 ${resumedCount}/${activeIds.length} 个推图会话`,
    "success",
  );

  return {
    requestId: payload.requestId,
    resumed: true,
    resumedCount,
    activeCount: activeIds.length,
  };
}

function handlePreemptionRequest(payload) {
  serializePreemptionOperation(() => preemptPushSessions(payload))
    .then((result) => {
      taskPreemptionCoordinator.publish(PREEMPTION_EVENTS.PREEMPT_READY, result);
    })
    .catch((error) => {
      taskPreemptionCoordinator.publish(PREEMPTION_EVENTS.PREEMPT_READY, {
        requestId: payload.requestId,
        acknowledged: true,
        ready: false,
        hadActivePush: true,
        error: sanitizeError(error),
      });
    });
}

function handleResumeRequest(payload) {
  serializePreemptionOperation(() => resumePushSessions(payload))
    .then((result) => {
      taskPreemptionCoordinator.publish(PREEMPTION_EVENTS.RESUME_COMPLETE, result);
    })
    .catch((error) => {
      taskPreemptionCoordinator.publish(PREEMPTION_EVENTS.RESUME_COMPLETE, {
        requestId: payload.requestId,
        resumed: false,
        error: sanitizeError(error),
      });
    });
}

function startSelected() {
  if (!selectedTokenIds.value.length) return;
  if (preemptionActive.value) {
    message.warning("批量日常正在抢占推图，请等待任务完成后再启动");
    return;
  }
  let queued = 0;
  let skipped = 0;
  selectedTokenIds.value.forEach((tokenId) => {
    addToCampaign(tokenId);
    const state = ensureState(tokenId);
    if (state.failureLocked) {
      skipped += 1;
      return;
    }
    if (state.slotHeld || state.status === STATUS.COOLDOWN || state.status === STATUS.QUEUED) return;
    state.manualStopped = false;
    state.stopFlag = false;
    if (enqueue(tokenId)) queued += 1;
  });
  message.success(`已加入推图队列 ${queued} 个${skipped ? `，失败锁停跳过 ${skipped} 个` : ""}`);
  updatePushPresence();
  requestSchedule();
}

function manualContinue(tokenId) {
  const state = ensureState(tokenId);
  const controller = sessionControllers.get(tokenId);
  if (controller && !controller.signal.aborted) {
    controller.abort(createAbortError("手动重新启动推图"));
  }
  state.runId = ++runSerial;
  removeFromQueue(tokenId);
  try {
    tokenStore.closeWebSocketConnection(tokenId);
  } catch {}
  resetStateForManualRun(state);
  addToCampaign(tokenId);
  enqueue(tokenId, { front: true });
  addLog(tokenId, state.tokenName, "已手动解除停止状态并重新排队", "info");
}

function stopOne(tokenId, { silent = false } = {}) {
  const state = ensureState(tokenId);
  const controller = sessionControllers.get(tokenId);
  if (controller && !controller.signal.aborted) {
    controller.abort(createAbortError("手动停止推图"));
  }
  state.runId = ++runSerial;
  state.stopFlag = true;
  state.manualStopped = true;
  state.running = false;
  state.slotHeld = false;
  state.reconnectAt = 0;
  state.reconnectDelayMs = 0;
  state.status = STATUS.STOPPED;
  removeFromQueue(tokenId);
  campaignTokenIds.value = campaignTokenIds.value.filter((id) => id !== tokenId);
  if (!silent) addLog(tokenId, state.tokenName, "手动停止推图", "warning");
  try {
    setManagedReconnect(tokenId, true);
    tokenStore.closeWebSocketConnection(tokenId);
  } catch {}
  updatePushPresence();
  requestSchedule();
}

function stopSelected() {
  selectedTokenIds.value.forEach((tokenId) => stopOne(tokenId));
}

function clearSelection() {
  const ids = new Set([
    ...selectedTokenIds.value,
    ...campaignTokenIds.value,
    ...Object.keys(runningStates),
  ]);
  ids.forEach((tokenId) => stopOne(tokenId, { silent: true }));
  queueOrder.value = [];
  campaignTokenIds.value = [];
  selectedTokenIds.value = [];
  selectedGroupIds.value = [];
  Object.keys(runningStates).forEach((tokenId) => delete runningStates[tokenId]);
}

function canManualContinue(card) {
  return [STATUS.IDLE, STATUS.STOPPED, STATUS.BLOCKED, STATUS.COOLDOWN]
    .includes(card.status);
}

function canStopCard(card) {
  return [STATUS.QUEUED, STATUS.STARTING, STATUS.RUNNING, STATUS.PREEMPTED, STATUS.COOLDOWN]
    .includes(card.status);
}

async function useTorchForSelected() {
  if (!selectedTokenIds.value.length) return;
  if (preemptionActive.value) {
    message.warning("批量日常正在执行，暂时不能使用火把");
    return;
  }
  const option = torchOptions.find((item) => item.value === torchItemId.value);
  const itemName = option?.label || `#${torchItemId.value}`;
  const quantity = clampInteger(torchQuantity.value, 1, 999, 1);
  torchRunning.value = true;
  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;

  for (const tokenId of selectedTokenIds.value) {
    const state = ensureState(tokenId);
    const tokenName = state.tokenName;
    const managedOnline = state.slotHeld && isConnected(tokenId);
    const managedButOffline = campaignTokenIds.value.includes(tokenId) && !managedOnline;

    if (managedButOffline) {
      skippedCount += 1;
      addLog(tokenId, tokenName, "账号处于排队/冷却/锁停状态，跳过火把，避免绕过在线上限", "warning");
      continue;
    }

    let temporaryConnection = false;
    try {
      if (!isConnected(tokenId)) {
        const token = getToken(tokenId);
        if (!token) throw new Error("未找到账号数据");
        await tokenStore.createWebSocketConnection(tokenId, token.token, token.wsUrl);
        const temporaryState = ensureState(tokenId);
        temporaryState.runId = ++runSerial;
        temporaryState.stopFlag = false;
        if (!await waitConnected(tokenId, temporaryState, temporaryState.runId, 8000)) {
          throw new Error("WebSocket 连接失败");
        }
        temporaryConnection = true;
      }

      await tokenStore.sendMessageWithPromise(
        tokenId,
        "item_consume",
        { itemId: torchItemId.value, quantity },
        10000,
      );
      const roleInfo = await tokenStore.sendMessageWithPromise(tokenId, "role_getroleinfo", {}, 10000);
      applyTorchInfo(state, readTorchFromResponse(roleInfo));
      addLog(tokenId, tokenName, `使用 ${itemName} x${quantity} 完成`, "success");
      successCount += 1;
    } catch (error) {
      addLog(tokenId, tokenName, `使用 ${itemName} 失败：${sanitizeError(error)}`, "error");
      failCount += 1;
    } finally {
      if (temporaryConnection) {
        try {
          tokenStore.closeWebSocketConnection(tokenId);
        } catch {}
      }
    }
  }

  torchRunning.value = false;
  message.success(`火把完成：成功 ${successCount}，失败 ${failCount}，跳过 ${skippedCount}`);
}

onMounted(() => {
  destroyed = false;
  loadSettings();
  unsubscribePreemption = taskPreemptionCoordinator.subscribe(
    PREEMPTION_EVENTS.PREEMPT_REQUEST,
    handlePreemptionRequest,
  );
  unsubscribeResume = taskPreemptionCoordinator.subscribe(
    PREEMPTION_EVENTS.RESUME_REQUEST,
    handleResumeRequest,
  );
  updatePushPresence();
  presenceTimer = setInterval(updatePushPresence, 5000);
  tickTimer = setInterval(() => {
    tickNow.value = Date.now();
    processCooldowns();
  }, 1000);
});

onBeforeUnmount(() => {
  destroyed = true;
  unsubscribePreemption?.();
  unsubscribeResume?.();
  unsubscribePreemption = null;
  unsubscribeResume = null;
  if (presenceTimer) {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }
  taskPreemptionCoordinator.clearPushPresence();
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  const ids = new Set([...campaignTokenIds.value, ...Object.keys(runningStates)]);
  ids.forEach((tokenId) => {
    const state = runningStates[tokenId];
    if (state) {
      state.runId = ++runSerial;
      state.stopFlag = true;
      state.manualStopped = true;
    }
    const controller = sessionControllers.get(tokenId);
    if (controller && !controller.signal.aborted) {
      controller.abort(createAbortError("推图页面卸载"));
    }
    try {
      tokenStore.closeWebSocketConnection(tokenId);
    } catch {}
  });
});
</script>

<style scoped>
.pushing-levels-page {
  height: 100%;
  min-height: 0;
  padding: 16px;
  background: #f6f8fb;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pl-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.pl-header h2 {
  margin: 0;
  color: #1f2937;
  font-size: 22px;
  font-weight: 700;
}

.pl-header p {
  margin: 2px 0 0;
  color: #667085;
  font-size: 13px;
}

.pl-header-actions,
.account-toolbar,
.log-header,
.log-actions,
.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.scheduler-settings {
  justify-content: flex-end;
}

.setting-field {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #667085;
  font-size: 12px;
}

.setting-input {
  width: 92px;
}

.scheduler-hint {
  font-size: 12px;
}

.account-card-top,
.control-card,
.log-card,
.running-card {
  border-radius: 8px;
}

.account-card-top :deep(.n-card__content) {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
}

.search-input {
  width: 180px;
}

.group-list-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.group-chip {
  border: 1px solid;
  border-radius: 999px;
  padding: 2px 8px;
  background: #fff;
  font-size: 11px;
  cursor: pointer;
  line-height: 1.4;
}

.token-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.token-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid #e4e7ec;
  background: #fff;
  font-size: 12px;
  line-height: 1.4;
  transition: border-color 0.2s, background 0.2s;
  cursor: pointer;
}

.token-cell:hover {
  border-color: #98a2b3;
}

.token-cell.selected {
  background: #eef2ff;
  border-color: #c7d2fe;
}

.token-server {
  color: #667085;
  font-weight: 500;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.token-sep {
  color: #98a2b3;
}

.token-name {
  color: #101828;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #d0d5dd;
  display: inline-block;
  flex-shrink: 0;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.status-gray { background: #d0d5dd; }
.status-green { background: #12b76a; }
.status-red { background: #f04438; }
.status-orange { background: #f79009; }
.status-purple { background: #7f56d9; }

.status-blue {
  background: #2e90fa;
  box-shadow: 0 0 0 3px rgba(46, 144, 250, 0.2);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(46, 144, 250, 0.2); }
  50% { box-shadow: 0 0 0 6px rgba(46, 144, 250, 0.05); }
}

.control-row {
  align-items: flex-end;
}

.torch-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #344054;
  font-size: 11px;
}

.torch-label { color: #667085; }
.torch-select, .torch-input { width: 120px; }
.control-spacer { flex: 1; }

.status-text {
  font-size: 12px;
  color: #667085;
}

.running-section {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap: 10px;
}

.running-card {
  min-height: 190px;
  border: 1px solid #e4e7ec;
}

.running-card.active { border-color: #12b76a; }
.running-card.cooldown { border-color: #f79009; }
.running-card.blocked { border-color: #f04438; }

.running-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.card-title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 130px;
}

.level-line,
.waiting-line,
.countdown-text,
.card-actions {
  color: #667085;
  font-size: 12px;
  line-height: 1.6;
}

.level-line { color: #344054; }
.torch-line { color: #b54708; font-weight: 500; }
.running-body { margin-top: 8px; }

.countdown-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.countdown-text {
  color: #1d2939;
  font-weight: 600;
  white-space: nowrap;
}

.inline-progress { flex: 1; min-width: 0; }

.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
}

.err-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
}

.log-card { min-height: 320px; }

.log-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.log-filter-label { color: #667085; font-size: 12px; }
.log-filter-select { width: 200px; }
.log-filter-count { color: #98a2b3; font-size: 11px; }

.log-container {
  height: 300px;
  overflow-y: auto;
  padding: 2px;
  font-family: Consolas, "Courier New", monospace;
  font-size: 12px;
}

.log-item {
  display: grid;
  grid-template-columns: 74px minmax(110px, 180px) minmax(0, 1fr);
  gap: 8px;
  padding: 3px 6px;
  border-radius: 4px;
  color: #344054;
}

.log-item.success { color: #047857; }
.log-item.warning { color: #b54708; }
.log-item.error { background: #fff1f3; color: #b42318; }
.log-name, .log-msg { overflow-wrap: anywhere; }

@media (max-width: 1100px) {
  .pl-header { flex-direction: column; }
  .scheduler-settings { justify-content: flex-start; }
  .token-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (max-width: 760px) {
  .token-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .pushing-levels-page { padding: 10px; }
  .log-item { grid-template-columns: 64px minmax(80px, 110px) minmax(0, 1fr); }
  .torch-select, .torch-input, .log-filter-select { width: 100px; }
  .setting-field { flex-direction: column; align-items: flex-start; }
}

@media (max-width: 480px) {
  .token-grid { grid-template-columns: 1fr; }
}
</style>
