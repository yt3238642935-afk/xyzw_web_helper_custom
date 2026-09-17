<template>
  <div class="identity-export-card">
    <!-- 顶部标题 -->
    <div class="card-header">
      <div class="title-area">
        <h3 class="card-title">
          批量导出身份牌
        </h3>

        <p class="card-subtitle">
          导出所有已导入角色的信息
        </p>
      </div>

      <!-- 右上角状态 -->
      <div class="status-area">
        <span
          class="status-dot"
          :class="{ running: running }"
        ></span>

        <span class="status-text">
          {{ running ? "导出中" : "就绪" }}
        </span>
      </div>
    </div>

    <!-- 中间内容 -->
    <div class="card-content">

      <!-- 角色数量 -->
      <div class="info-row">
        <span class="info-label">
          当前角色数量
        </span>

        <span class="role-count">
          {{ tokenCount }}
        </span>
      </div>

      <!-- 导出过程中显示 -->
      <div
        v-if="running"
        class="progress-section"
      >
        <div class="progress-header">
          <span>
            正在读取角色信息
          </span>

          <span>
            {{ progress.current }}/{{ progress.total }}
          </span>
        </div>

        <n-progress
          type="line"
          :percentage="progressPercentage"
          :show-indicator="false"
          :height="7"
          :border-radius="4"
        />

        <div
          v-if="progress.tokenName"
          class="current-role"
        >
          当前：
          {{ progress.tokenName }}
        </div>
      </div>

      <!-- 未执行时的提示 -->
      <div
        v-else
        class="ready-info"
      >
        将依次读取所有角色身份牌数据，并生成 Excel 文件
      </div>

      <!-- 按钮固定到底部 -->
      <div class="export-action">
        <n-button
          type="primary"
          size="large"
          block
          :loading="running"
          :disabled="running || tokenCount === 0"
          @click="startExport"
        >
          <span v-if="!running" class="button-content">
            <span class="download-icon">
              ↓
            </span>

            <span>
              导出身份牌 Excel
            </span>
          </span>

          <span v-else>
            正在导出
            {{ progress.current }}/{{ progress.total }}
          </span>
        </n-button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  NButton,
  NProgress,
  useMessage,
} from "naive-ui";

import { useTokenStore } from "@/stores/tokenStore";

import {
  fetchIdentityCards,
} from "@/utils/identityExport";

import {
  exportIdentityExcel,
} from "@/utils/identityExcel";


/* =========================
 * Store
 * ========================= */

const tokenStore = useTokenStore();
const message = useMessage();


/* =========================
 * 页面状态
 * ========================= */

const running = ref(false);

const progress = ref({
  current: 0,
  total: 0,
  tokenName: "",
});


/* =========================
 * 角色数量
 * ========================= */

const tokenCount = computed(() => {
  return tokenStore.gameTokens?.length ?? 0;
});


/* =========================
 * 进度百分比
 * ========================= */

const progressPercentage = computed(() => {
  if (!progress.value.total) {
    return 0;
  }

  return Math.round(
    (
      progress.value.current /
      progress.value.total
    ) * 100
  );
});


/* =========================
 * 批量导出
 * ========================= */

const startExport = async () => {

  if (running.value) {
    return;
  }

  const tokens = tokenStore.gameTokens || [];

  if (!tokens.length) {
    message.warning("当前没有可以导出的角色");
    return;
  }


  running.value = true;

  progress.value = {
    current: 0,
    total: tokens.length,
    tokenName: "",
  };


  try {

    const {
      results,
      errors,
    } = await fetchIdentityCards(
      tokenStore,
      tokens,

      (value) => {

        progress.value = {
          current: value.current ?? 0,
          total: value.total ?? tokens.length,
          tokenName: value.tokenName ?? "",
        };

      }
    );


    /* =========================
     * 没有成功数据
     * ========================= */

    if (!results || results.length === 0) {

      message.error(
        "没有成功读取任何角色信息"
      );

      if (errors?.length) {
        console.error(
          "[IdentityExport] 导出失败：",
          errors
        );
      }

      return;
    }


    /* =========================
     * 导出 Excel
     * ========================= */

    exportIdentityExcel(results);


    /* =========================
     * 结果提示
     * ========================= */

    if (errors?.length) {

      console.warn(
        "[IdentityExport] 部分角色读取失败：",
        errors
      );

      message.warning(
        `导出完成：成功 ${results.length} 个，失败 ${errors.length} 个`
      );

    } else {

      message.success(
        `成功导出 ${results.length} 个角色的身份牌信息`
      );

    }

  } catch (error) {

    console.error(
      "[IdentityExport] 导出异常：",
      error
    );

    message.error(
      `导出失败：${error?.message || "未知错误"}`
    );

  } finally {

    running.value = false;

    progress.value.tokenName = "";

  }
};
</script>


<style scoped>

/* =========================
 * 整体卡片
 * ========================= */

.identity-export-card {
  height: 100%;
  min-height: 310px;

  box-sizing: border-box;

  display: flex;
  flex-direction: column;

  background: #ffffff;

  border-radius: 18px;

  padding: 24px;

  box-shadow:
    0 6px 18px
    rgba(15, 23, 42, 0.08);
}


/* =========================
 * 顶部
 * ========================= */

.card-header {
  display: flex;

  align-items: flex-start;
  justify-content: space-between;

  gap: 16px;
}


.title-area {
  min-width: 0;
}


.card-title {
  margin: 0;

  font-size: 18px;
  line-height: 1.4;

  font-weight: 700;

  color: #1f2937;
}


.card-subtitle {
  margin: 4px 0 0;

  font-size: 14px;
  line-height: 1.5;

  color: #555f70;
}


/* =========================
 * 状态
 * ========================= */

.status-area {
  display: flex;

  align-items: center;

  flex-shrink: 0;

  padding-top: 3px;

  font-size: 13px;

  color: #4b5563;
}


.status-dot {
  width: 8px;
  height: 8px;

  margin-right: 5px;

  border-radius: 50%;

  background: #22c55e;
}


.status-dot.running {
  background: #2563eb;

  animation:
    statusPulse
    1.2s
    infinite;
}


@keyframes statusPulse {

  0% {
    opacity: 0.4;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 0.4;
  }

}


/* =========================
 * 内容区
 * ========================= */

.card-content {
  flex: 1;

  display: flex;
  flex-direction: column;

  padding-top: 34px;
}


/* =========================
 * 角色数量
 * ========================= */

.info-row {
  display: flex;

  align-items: center;
  justify-content: space-between;

  padding: 13px 16px;

  border-radius: 8px;

  background: #f7f9fc;
}


.info-label {
  font-size: 14px;

  color: #606b7a;
}


.role-count {
  min-width: 28px;

  text-align: center;

  font-size: 20px;
  line-height: 1;

  font-weight: 700;

  color: #2563eb;
}


/* =========================
 * 未运行提示
 * ========================= */

.ready-info {
  margin-top: 16px;

  font-size: 13px;
  line-height: 1.6;

  color: #8a94a4;
}


/* =========================
 * 进度
 * ========================= */

.progress-section {
  margin-top: 18px;
}


.progress-header {
  display: flex;

  justify-content: space-between;

  margin-bottom: 9px;

  font-size: 13px;

  color: #5f6877;
}


.current-role {
  margin-top: 9px;

  overflow: hidden;

  white-space: nowrap;

  text-overflow: ellipsis;

  font-size: 12px;

  color: #8a94a4;
}


/* =========================
 * 底部按钮
 * ========================= */

.export-action {
  margin-top: auto;

  padding-top: 26px;
}


.export-action :deep(.n-button) {
  height: 42px;

  border-radius: 5px;

  font-size: 14px;

  font-weight: 500;
}


.button-content {
  display: flex;

  align-items: center;
  justify-content: center;

  gap: 8px;
}


.download-icon {
  display: inline-flex;

  align-items: center;
  justify-content: center;

  width: 20px;
  height: 20px;

  font-size: 19px;
  line-height: 1;

  font-weight: 700;

  transform: translateY(-1px);
}


/* =========================
 * 移动端
 * ========================= */

@media (max-width: 768px) {

  .identity-export-card {
    min-height: 280px;

    padding: 20px;
  }


  .card-content {
    padding-top: 24px;
  }

}

</style>
