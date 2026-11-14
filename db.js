const path = require('path');
const fs = require('fs');

let DB_PATH = process.env.DB_PATH || path.join(__dirname, 'media_tracker.db');

// Vercel Serverless environment: filesystem in __dirname is read-only.
// Copy initial database to /tmp so both reads and writes work seamlessly.
if (process.env.VERCEL) {
  try {
    const tmpDbPath = path.join('/tmp', 'media_tracker.db');
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, tmpDbPath);
    }
    DB_PATH = tmpDbPath;
  } catch (err) {
    console.warn('Vercel /tmp copy warning:', err.message);
  }
}

let db = null;
let dbType = 'better-sqlite3';

try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  try {
    db.pragma('journal_mode = WAL');
  } catch (e) {
    // WAL mode fallback for serverless
  }
  dbType = 'better-sqlite3';
} catch (err) {
  // Fallback to Node's built-in node:sqlite
  try {
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    try {
      db.exec('PRAGMA journal_mode = WAL;');
    } catch (e) {}
    dbType = 'node:sqlite';
  } catch (err2) {
    console.error('Fatal: Failed to initialize SQLite database with better-sqlite3 and node:sqlite:', err2);
    throw err2;
  }
}

// Initialize tables and indexes if they don't exist
function initSchema() {
  const schema = `
    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      alt_name TEXT DEFAULT '',
      type TEXT NOT NULL,
      seasons INTEGER NOT NULL DEFAULT 1,
      year TEXT NOT NULL DEFAULT 'N/A',
      watched TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'Plan to Watch',
      rating REAL DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      genres TEXT DEFAULT '[]',
      tags TEXT DEFAULT '',
      platform TEXT DEFAULT '',
      episodes INTEGER DEFAULT 0,
      current_episode INTEGER DEFAULT 0,
      poster_url TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
    CREATE INDEX IF NOT EXISTS idx_media_type ON media(type);
    CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
    CREATE INDEX IF NOT EXISTS idx_media_name ON media(name);
    CREATE INDEX IF NOT EXISTS idx_media_year ON media(year);
    CREATE INDEX IF NOT EXISTS idx_media_rating ON media(rating);
    CREATE INDEX IF NOT EXISTS idx_media_favorite ON media(favorite);
  `;
  db.exec(schema);
}

initSchema();

// Helper to query all rows
function queryAll(sql, params = []) {
  if (dbType === 'better-sqlite3') {
    return db.prepare(sql).all(...params);
  } else {
    return db.prepare(sql).all(...params);
  }
}

// Helper to query single row
function queryOne(sql, params = []) {
  if (dbType === 'better-sqlite3') {
    return db.prepare(sql).get(...params);
  } else {
    return db.prepare(sql).get(...params);
  }
}

// Helper to execute run (insert, update, delete)
function executeRun(sql, params = []) {
  if (dbType === 'better-sqlite3') {
    return db.prepare(sql).run(...params);
  } else {
    return db.prepare(sql).run(...params);
  }
}

// Format media record for client output
function formatRecord(row) {
  if (!row) return null;
  let watched = [];
  try {
    watched = typeof row.watched === 'string' ? JSON.parse(row.watched) : (row.watched || []);
  } catch (e) {
    watched = [];
  }

  let genres = [];
  try {
    genres = typeof row.genres === 'string' ? JSON.parse(row.genres) : (row.genres || []);
  } catch (e) {
    genres = [];
  }

  return {
    ...row,
    seasons: Number(row.seasons) || 1,
    rating: Number(row.rating) || 0,
    favorite: Boolean(row.favorite),
    episodes: Number(row.episodes) || 0,
    current_episode: Number(row.current_episode) || 0,
    watched,
    genres
  };
}

// Intelligent status recalculation from watched seasons
function calculateStatus(watched, seasons) {
  if (!Array.isArray(watched) || watched.length === 0) return 'Plan to Watch';
  const trueCount = watched.filter(Boolean).length;
  if (trueCount >= seasons && seasons > 0) return 'Completed';
  if (trueCount > 0) return 'Watching';
  return 'Plan to Watch';
}

const MediaModel = {
  dbType,

  getAll(options = {}) {
    const {
      category,
      type,
      status,
      favorite,
      search,
      genre,
      sortBy = 'name',
      sortDir = 'asc',
      page = 1,
      limit = 50
    } = options;

    let whereClauses = [];
    let params = [];

    if (category && category !== 'All') {
      whereClauses.push('category = ?');
      params.push(category);
    }

    if (type && type !== 'All') {
      whereClauses.push('type = ?');
      params.push(type);
    }

    if (status && status !== 'All') {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (favorite === 'true' || favorite === '1' || favorite === true) {
      whereClauses.push('favorite = 1');
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(name) LIKE ? OR LOWER(alt_name) LIKE ? OR LOWER(tags) LIKE ? OR LOWER(notes) LIKE ? OR year LIKE ?)');
      params.push(term, term, term, term, term);
    }

    if (genre && genre !== 'All') {
      whereClauses.push('LOWER(genres) LIKE ?');
      params.push(`%"${genre.toLowerCase()}"%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Count query for pagination
    const countRow = queryOne(`SELECT COUNT(*) as total FROM media ${whereSql}`, params);
    const total = countRow ? Number(countRow.total) : 0;

    // Allowed sort columns
    const allowedSorts = {
      name: 'name COLLATE NOCASE',
      year: 'year',
      seasons: 'seasons',
      rating: 'rating',
      status: 'status',
      updated: 'updated_at',
      created: 'created_at',
      id: 'id'
    };

    const sortColumn = allowedSorts[sortBy] || 'name COLLATE NOCASE';
    const direction = sortDir.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    let dataSql = `SELECT * FROM media ${whereSql} ORDER BY ${sortColumn} ${direction}`;
    
    // Pagination
    const numLimit = Math.max(1, Math.min(500, Number(limit) || 50));
    const numPage = Math.max(1, Number(page) || 1);
    const offset = (numPage - 1) * numLimit;

    dataSql += ` LIMIT ${numLimit} OFFSET ${offset}`;

    const rows = queryAll(dataSql, params);
    return {
      total,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(total / numLimit),
      items: rows.map(formatRecord)
    };
  },

  getById(id) {
    const row = queryOne('SELECT * FROM media WHERE id = ?', [String(id)]);
    return formatRecord(row);
  },

  findDuplicate(name, category, excludeId = null) {
    if (!name || !name.trim()) return null;
    const normalized = (name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    if (!normalized) return null;

    let sql = 'SELECT * FROM media WHERE category = ?';
    let params = [category];
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(String(excludeId));
    }

    const rows = queryAll(sql, params);
    for (const r of rows) {
      const rNameNorm = (r.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      const rAltNorm = (r.alt_name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (rNameNorm === normalized || (rAltNorm && rAltNorm === normalized)) {
        return formatRecord(r);
      }
    }
    return null;
  },

  deduplicate() {
    const all = queryAll('SELECT id, category, name, alt_name, watched, rating, favorite, notes, created_at FROM media ORDER BY created_at ASC');
    const seen = new Map();
    const toRemove = [];

    for (const item of all) {
      const norm = (item.name || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (!norm) continue;
      const key = `${item.category}_${norm}`;

      if (seen.has(key)) {
        const existing = seen.get(key);
        let existingWatched = 0;
        try { existingWatched = JSON.parse(existing.watched || '[]').filter(Boolean).length; } catch (e) {}
        let itemWatched = 0;
        try { itemWatched = JSON.parse(item.watched || '[]').filter(Boolean).length; } catch (e) {}

        if (itemWatched > existingWatched || (item.rating > 0 && !existing.rating) || (item.notes && !existing.notes)) {
          toRemove.push(existing.id);
          seen.set(key, item);
        } else {
          toRemove.push(item.id);
        }
      } else {
        seen.set(key, item);
      }
    }

    if (toRemove.length > 0) {
      for (const id of toRemove) {
        executeRun('DELETE FROM media WHERE id = ?', [id]);
      }
    }

    return {
      removedCount: toRemove.length,
      removedIds: toRemove
    };
  },

  create(data) {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = data.id ? String(data.id) : `${data.category ? data.category.toLowerCase() : 'item'}_${Date.now()}`;
    const seasons = Math.max(1, Number(data.seasons) || 1);

    let watched = Array.isArray(data.watched) ? data.watched : [];
    while (watched.length < seasons) watched.push(false);
    if (watched.length > seasons) watched = watched.slice(0, seasons);

    const calculatedStatus = data.status || calculateStatus(watched, seasons);
    const genres = Array.isArray(data.genres) ? data.genres : [];

    const params = [
      id,
      data.category || 'Movie',
      (data.name || '').trim(),
      (data.alt_name || '').trim(),
      (data.type || 'Other').trim(),
      seasons,
      data.year ? String(data.year).trim() : 'N/A',
      JSON.stringify(watched),
      calculatedStatus,
      Number(data.rating) || 0,
      data.favorite ? 1 : 0,
      JSON.stringify(genres),
      (data.tags || '').trim(),
      (data.platform || '').trim(),
      Number(data.episodes) || 0,
      Number(data.current_episode) || 0,
      (data.poster_url || '').trim(),
      (data.notes || '').trim(),
      data.created_at || now,
      now
    ];

    executeRun(`
      INSERT INTO media (
        id, category, name, alt_name, type, seasons, year,
        watched, status, rating, favorite, genres, tags,
        platform, episodes, current_episode, poster_url, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, params);

    return this.getById(id);
  },

  update(id, data) {
    const existing = this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const seasons = data.seasons !== undefined ? Math.max(1, Number(data.seasons) || 1) : existing.seasons;

    let watched = existing.watched;
    if (data.watched !== undefined && Array.isArray(data.watched)) {
      watched = data.watched;
    }
    // Resize watched array if seasons changed
    while (watched.length < seasons) watched.push(false);
    if (watched.length > seasons) watched = watched.slice(0, seasons);

    let status = data.status || existing.status;
    if (!data.status && data.watched !== undefined) {
      status = calculateStatus(watched, seasons);
    }

    const category = data.category || existing.category;
    const name = data.name !== undefined ? (data.name || '').trim() : existing.name;
    const alt_name = data.alt_name !== undefined ? (data.alt_name || '').trim() : existing.alt_name;
    const type = data.type !== undefined ? (data.type || '').trim() : existing.type;
    const year = data.year !== undefined ? String(data.year).trim() : existing.year;
    const rating = data.rating !== undefined ? Number(data.rating) : existing.rating;
    const favorite = data.favorite !== undefined ? (data.favorite ? 1 : 0) : (existing.favorite ? 1 : 0);
    const genres = data.genres !== undefined ? (Array.isArray(data.genres) ? data.genres : []) : existing.genres;
    const tags = data.tags !== undefined ? (data.tags || '').trim() : existing.tags;
    const platform = data.platform !== undefined ? (data.platform || '').trim() : existing.platform;
    const episodes = data.episodes !== undefined ? Number(data.episodes) : existing.episodes;
    const current_episode = data.current_episode !== undefined ? Number(data.current_episode) : existing.current_episode;
    const poster_url = data.poster_url !== undefined ? (data.poster_url || '').trim() : existing.poster_url;
    const notes = data.notes !== undefined ? (data.notes || '').trim() : existing.notes;

    executeRun(`
      UPDATE media SET
        category = ?, name = ?, alt_name = ?, type = ?, seasons = ?, year = ?,
        watched = ?, status = ?, rating = ?, favorite = ?, genres = ?, tags = ?,
        platform = ?, episodes = ?, current_episode = ?, poster_url = ?, notes = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      category, name, alt_name, type, seasons, year,
      JSON.stringify(watched), status, rating, favorite, JSON.stringify(genres), tags,
      platform, episodes, current_episode, poster_url, notes,
      now, String(id)
    ]);

    return this.getById(id);
  },

  updateWatched(id, watchedArray) {
    const existing = this.getById(id);
    if (!existing) return null;

    const seasons = existing.seasons;
    let watched = Array.isArray(watchedArray) ? watchedArray.map(Boolean) : [];
    while (watched.length < seasons) watched.push(false);
    if (watched.length > seasons) watched = watched.slice(0, seasons);

    const status = calculateStatus(watched, seasons);
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    executeRun(`
      UPDATE media SET watched = ?, status = ?, updated_at = ? WHERE id = ?
    `, [JSON.stringify(watched), status, now, String(id)]);

    return this.getById(id);
  },

  toggleSeason(id, seasonIndex) {
    const existing = this.getById(id);
    if (!existing) return null;

    const idx = Number(seasonIndex);
    if (idx < 0 || idx >= existing.seasons) return null;

    const watched = [...existing.watched];
    watched[idx] = !watched[idx];

    return this.updateWatched(id, watched);
  },

  delete(id) {
    const existing = this.getById(id);
    if (!existing) return false;
    executeRun('DELETE FROM media WHERE id = ?', [String(id)]);
    return true;
  },

  getStats() {
    const totalRow = queryOne('SELECT COUNT(*) as total FROM media');
    const total = totalRow ? Number(totalRow.total) : 0;

    const categoryRows = queryAll(`
      SELECT category,
             COUNT(*) as count,
             SUM(case when status = 'Completed' then 1 else 0 end) as completed,
             SUM(case when status = 'Watching' then 1 else 0 end) as watching,
             SUM(case when status = 'Plan to Watch' then 1 else 0 end) as plan
      FROM media
      GROUP BY category
    `);

    const typeRows = queryAll(`
      SELECT type, COUNT(*) as count FROM media GROUP BY type ORDER BY count DESC LIMIT 10
    `);

    const statusRows = queryAll(`
      SELECT status, COUNT(*) as count FROM media GROUP BY status
    `);

    const favRow = queryOne('SELECT COUNT(*) as count FROM media WHERE favorite = 1');
    const completedRow = queryOne("SELECT COUNT(*) as count FROM media WHERE status = 'Completed'");
    const watchingRow = queryOne("SELECT COUNT(*) as count FROM media WHERE status = 'Watching'");

    return {
      total,
      completed: completedRow ? Number(completedRow.count) : 0,
      watching: watchingRow ? Number(watchingRow.count) : 0,
      favorites: favRow ? Number(favRow.count) : 0,
      categories: categoryRows,
      topTypes: typeRows,
      statuses: statusRows
    };
  },

  getWheelCandidates(category = 'All', type = 'All') {
    let sql = "SELECT id, category, name, alt_name, type, seasons, year, poster_url FROM media WHERE status != 'Completed'";
    let params = [];

    if (category && category !== 'All') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (type && type !== 'All') {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY RANDOM() LIMIT 50';
    return queryAll(sql, params).map(formatRecord);
  },

  exportAll() {
    return queryAll('SELECT * FROM media ORDER BY category, name').map(formatRecord);
  }
};

module.exports = {
  db,
  MediaModel
};
