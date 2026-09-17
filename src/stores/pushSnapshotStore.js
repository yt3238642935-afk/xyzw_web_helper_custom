import { reactive } from "vue";

const snapshot = reactive({
  createdAt: 0,
  accounts: [],
});


export function usePushSnapshotStore() {

  function saveSnapshot(states) {

    snapshot.createdAt = Date.now();

    snapshot.accounts = JSON.parse(
      JSON.stringify(states)
    );
  }


  function getSnapshot() {
    return snapshot.accounts;
  }


  function clearSnapshot() {
    snapshot.accounts = [];
    snapshot.createdAt = 0;
  }


  return {
    snapshot,
    saveSnapshot,
    getSnapshot,
    clearSnapshot,
  };
}