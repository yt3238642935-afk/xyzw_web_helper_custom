const CHANNEL_NAME = "xyzw-task-preemption-v1";
const STORAGE_MESSAGE_KEY = "xyzw_task_preemption_message_v1";
const PUSH_PRESENCE_KEY = "xyzw_push_runtime_presence_v1";

export const PREEMPTION_EVENTS = Object.freeze({
  PREEMPT_REQUEST: "daily:preempt-request",
  PREEMPT_READY: "push:preempt-ready",
  RESUME_REQUEST: "daily:resume-request",
  RESUME_COMPLETE: "push:resume-complete",
});

function createId(prefix = "msg") {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

class TaskPreemptionCoordinator {
  constructor() {
    this.instanceId = createId("runtime");
    this.listeners = new Map();
    this.seenMessageIds = new Set();
    this.channel = null;

    if (typeof window === "undefined") return;

    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.addEventListener("message", (event) => {
        this.dispatch(event.data);
      });
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== STORAGE_MESSAGE_KEY || !event.newValue) return;
      try {
        this.dispatch(JSON.parse(event.newValue));
      } catch (error) {
        console.warn("解析任务抢占消息失败", error);
      }
    });
  }

  rememberMessage(messageId) {
    if (!messageId) return false;
    if (this.seenMessageIds.has(messageId)) return true;
    this.seenMessageIds.add(messageId);
    if (this.seenMessageIds.size > 500) {
      const oldest = this.seenMessageIds.values().next().value;
      this.seenMessageIds.delete(oldest);
    }
    return false;
  }

  dispatch(message) {
    if (!message || !message.type || this.rememberMessage(message.messageId)) return;
    const handlers = this.listeners.get(message.type);
    if (!handlers) return;
    [...handlers].forEach((handler) => {
      try {
        handler(message.payload || {}, message);
      } catch (error) {
        console.error(`处理任务抢占事件失败: ${message.type}`, error);
      }
    });
  }

  publish(type, payload = {}) {
    const message = {
      messageId: createId("event"),
      senderId: this.instanceId,
      type,
      payload,
      timestamp: Date.now(),
    };

    // BroadcastChannel 不会把消息回送给发送者，因此先分发给同一页面的订阅者。
    this.dispatch(message);

    if (this.channel) {
      this.channel.postMessage(message);
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_MESSAGE_KEY, JSON.stringify(message));
        localStorage.removeItem(STORAGE_MESSAGE_KEY);
      } catch (error) {
        console.warn("写入任务抢占广播失败", error);
      }
    }

    return message;
  }

  subscribe(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
    return () => {
      const handlers = this.listeners.get(type);
      handlers?.delete(handler);
      if (handlers?.size === 0) this.listeners.delete(type);
    };
  }

  waitFor(type, predicate, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      let timer = null;
      const unsubscribe = this.subscribe(type, (payload, message) => {
        if (predicate && !predicate(payload, message)) return;
        if (timer) clearTimeout(timer);
        unsubscribe();
        resolve(payload);
      });

      timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`等待任务抢占事件超时: ${type}`));
      }, timeoutMs);
    });
  }

  async requestPreemption(payload = {}, timeoutMs = 30000) {
    const requestId = payload.requestId || createId("preempt");
    if (!this.hasActivePushPresence()) {
      return {
        requestId,
        acknowledged: false,
        hadActivePush: false,
        reason: "no-active-push",
      };
    }

    const responsePromise = this.waitFor(
      PREEMPTION_EVENTS.PREEMPT_READY,
      (response) => response.requestId === requestId,
      timeoutMs,
    );
    this.publish(PREEMPTION_EVENTS.PREEMPT_REQUEST, {
      ...payload,
      requestId,
    });
    return responsePromise;
  }

  async requestResume(payload = {}, timeoutMs = 45000) {
    const requestId = payload.requestId;
    if (!requestId) throw new Error("恢复推图缺少 requestId");

    const responsePromise = this.waitFor(
      PREEMPTION_EVENTS.RESUME_COMPLETE,
      (response) => response.requestId === requestId,
      timeoutMs,
    );
    this.publish(PREEMPTION_EVENTS.RESUME_REQUEST, payload);
    return responsePromise;
  }

  setPushPresence(details = {}) {
    if (typeof window === "undefined") return;
    const presence = {
      instanceId: this.instanceId,
      active: Boolean(details.active),
      preempted: Boolean(details.preempted),
      campaignSize: Number(details.campaignSize || 0),
      updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(PUSH_PRESENCE_KEY, JSON.stringify(presence));
    } catch (error) {
      console.warn("更新推图运行状态失败", error);
    }
  }

  clearPushPresence() {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(PUSH_PRESENCE_KEY);
      const presence = raw ? JSON.parse(raw) : null;
      if (!presence || presence.instanceId === this.instanceId) {
        localStorage.removeItem(PUSH_PRESENCE_KEY);
      }
    } catch {}
  }

  hasActivePushPresence(maxAgeMs = 15000) {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(PUSH_PRESENCE_KEY);
      if (!raw) return false;
      const presence = JSON.parse(raw);
      const fresh = Date.now() - Number(presence.updatedAt || 0) <= maxAgeMs;
      return fresh && Boolean(presence.active || presence.preempted);
    } catch {
      return false;
    }
  }

  createRequestId(prefix = "preempt") {
    return createId(prefix);
  }
}

export const taskPreemptionCoordinator = new TaskPreemptionCoordinator();
