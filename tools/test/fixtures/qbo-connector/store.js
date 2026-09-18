const maps = new Map();
export const store = { async getMap(k, id) { return maps.get(k + ':' + id) || null; }, async setMap(k, id, v) { maps.set(k + ':' + id, v); }, reset() { maps.clear(); } };
