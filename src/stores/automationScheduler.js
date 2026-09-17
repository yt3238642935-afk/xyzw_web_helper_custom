import { reactive } from "vue";

const state = reactive({
  phase: "IDLE",
  interruptRequested: false,
  dailyTaskRunning: false,
  mainlinePaused: false,
});

export function useAutomationScheduler() {

  function requestDailyInterrupt() {
    state.interruptRequested = true;
    state.phase = "DAILY_PREPARE";
  }


  function markMainlinePaused() {
    state.mainlinePaused = true;
    state.phase = "DAILY_RUNNING";
  }


  function finishDailyTask() {
    state.dailyTaskRunning = false;
    state.phase = "RESTORING";
  }


  function restoreFinished() {
    state.mainlinePaused = false;
    state.interruptRequested = false;
    state.phase = "IDLE";
  }


  return {
    state,
    requestDailyInterrupt,
    markMainlinePaused,
    finishDailyTask,
    restoreFinished,
  };
}