import { openDB } from 'idb';

const DB_NAME = 'golf_tracker_local';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Drills store
        if (!db.objectStoreNames.contains('drills')) {
          db.createObjectStore('drills', { keyPath: 'id' });
        }

        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('drill_type_id', 'drill_type_id');
          sessionStore.createIndex('started_at', 'started_at');
        }

        // Results store
        if (!db.objectStoreNames.contains('results')) {
          const resultStore = db.createObjectStore('results', { keyPath: 'id' });
          resultStore.createIndex('session_id', 'session_id');
        }

        // Sync queue store - for changes made while offline
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

// Drills
export const storage = {
  // Drills
  async getDrills() {
    const db = await getDB();
    return db.getAll('drills');
  },

  async getDrill(id) {
    const db = await getDB();
    return db.get('drills', id);
  },

  async saveDrill(drill) {
    const db = await getDB();
    await db.put('drills', drill);
  },

  async deleteDrill(id) {
    const db = await getDB();
    await db.delete('drills', id);
  },

  // Sessions
  async getSessions() {
    const db = await getDB();
    return db.getAll('sessions');
  },

  async getSession(id) {
    const db = await getDB();
    const session = await db.get('sessions', id);
    if (session) {
      session.results = await this.getResultsBySession(id);
    }
    return session;
  },

  async saveSession(session) {
    const db = await getDB();
    await db.put('sessions', session);
  },

  async deleteSession(id) {
    const db = await getDB();
    await db.delete('sessions', id);
    // Also delete related results
    const results = await this.getResultsBySession(id);
    for (const result of results) {
      await db.delete('results', result.id);
    }
  },

  // Results
  async getResultsBySession(sessionId) {
    const db = await getDB();
    const tx = db.transaction('results', 'readonly');
    const index = tx.store.index('session_id');
    return index.getAll(sessionId);
  },

  async saveResult(result) {
    const db = await getDB();
    await db.put('results', result);
  },

  async deleteResult(id) {
    const db = await getDB();
    await db.delete('results', id);
  },

  // Sync Queue
  async addToSyncQueue(action) {
    const db = await getDB();
    await db.add('sync_queue', {
      action: action.action, // 'create', 'update', 'delete'
      type: action.type, // 'drill', 'session', 'result'
      data: action.data,
      timestamp: Date.now()
    });
  },

  async getSyncQueue() {
    const db = await getDB();
    return db.getAll('sync_queue');
  },

  async clearSyncQueue() {
    const db = await getDB();
    await db.clear('sync_queue');
  },

  async removeFromSyncQueue(id) {
    const db = await getDB();
    await db.delete('sync_queue', id);
  },

  // Sync Metadata
  async getLastSyncTime() {
    const db = await getDB();
    const record = await db.get('sync_metadata', 'lastSyncAt');
    return record?.value || 0;
  },

  async setLastSyncTime(timestamp) {
    const db = await getDB();
    await db.put('sync_metadata', { key: 'lastSyncAt', value: timestamp });
  },

  async getDeviceId() {
    const db = await getDB();
    let record = await db.get('sync_metadata', 'deviceId');

    if (!record) {
      // Generate new device ID
      const deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.put('sync_metadata', { key: 'deviceId', value: deviceId });
      return deviceId;
    }

    return record.value;
  }
};
