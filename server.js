const express = require('express');
const path = require('path');
const fs = require('fs');
const { MediaModel } = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// CORS headers for development/flexibility
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbType: MediaModel.dbType
  });
});

// GET /api/media - Retrieve media with search, filter, sort, and pagination
app.get('/api/media', (req, res) => {
  try {
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
    } = req.query;

    const result = MediaModel.getAll({
      category,
      type,
      status,
      favorite,
      search,
      genre,
      sortBy,
      sortDir,
      page,
      limit
    });

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Error fetching media:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch media records.' });
  }
});

// GET /api/media/:id - Retrieve single media record
app.get('/api/media/:id', (req, res) => {
  try {
    const item = MediaModel.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Entry not found.' });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    console.error('Error getting media by id:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve media.' });
  }
});

// POST /api/media/check-duplicate - Check if title already exists
app.post('/api/media/check-duplicate', (req, res) => {
  try {
    const { name, category, excludeId } = req.body;
    if (!name || !category) {
      return res.json({ duplicate: false });
    }
    const dup = MediaModel.findDuplicate(name, category, excludeId);
    res.json({
      duplicate: Boolean(dup),
      existing: dup || null
    });
  } catch (err) {
    res.json({ duplicate: false });
  }
});

// POST /api/media/clean-duplicates - Remove redundant duplicate entries
app.post('/api/media/clean-duplicates', (req, res) => {
  try {
    const result = MediaModel.deduplicate();
    res.json({
      success: true,
      message: result.removedCount > 0 
        ? `Cleaned up ${result.removedCount} duplicate record${result.removedCount === 1 ? '' : 's'}.` 
        : 'Your library is already clean. No duplicate entries found.',
      removedCount: result.removedCount
    });
  } catch (err) {
    console.error('Error cleaning duplicates:', err);
    res.status(500).json({ success: false, error: 'Failed to clean duplicates.' });
  }
});

// POST /api/media - Create new media entry
app.post('/api/media', (req, res) => {
  try {
    const { name, category, type, seasons, year, watched, status, rating, genres, tags, platform, episodes, poster_url, notes, alt_name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    if (!category) {
      return res.status(400).json({ success: false, error: 'Category is required.' });
    }

    // Check duplicate
    const existing = MediaModel.findDuplicate(name, category);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `An entry named "${name}" already exists in ${category}.`,
        existing
      });
    }

    const created = MediaModel.create({
      name,
      alt_name,
      category,
      type: type || 'Other',
      seasons: seasons || 1,
      year: year || 'N/A',
      watched: watched || [],
      status,
      rating,
      genres,
      tags,
      platform,
      episodes,
      poster_url,
      notes
    });

    res.status(201).json({ success: true, data: created, message: 'Entry added successfully.' });
  } catch (err) {
    console.error('Error creating media:', err);
    res.status(500).json({ success: false, error: 'Failed to create media entry.' });
  }
});

// PUT /api/media/:id - Update existing entry
app.put('/api/media/:id', (req, res) => {
  try {
    const id = req.params.id;
    const existing = MediaModel.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Entry not found.' });
    }

    const { name, category } = req.body;
    const targetCategory = category || existing.category;
    const targetName = name || existing.name;

    // Check duplicate if title or category changed
    if (targetName.trim().toLowerCase() !== existing.name.trim().toLowerCase() || targetCategory !== existing.category) {
      const dup = MediaModel.findDuplicate(targetName, targetCategory, id);
      if (dup) {
        return res.status(409).json({
          success: false,
          error: `An entry named "${targetName}" already exists in ${targetCategory}.`,
          existing: dup
        });
      }
    }

    const updated = MediaModel.update(id, req.body);
    res.json({ success: true, data: updated, message: 'Entry updated successfully.' });
  } catch (err) {
    console.error('Error updating media:', err);
    res.status(500).json({ success: false, error: 'Failed to update media entry.' });
  }
});

// PATCH /api/media/:id/watched - Update watched array
app.patch('/api/media/:id/watched', (req, res) => {
  try {
    const { watched } = req.body;
    if (!Array.isArray(watched)) {
      return res.status(400).json({ success: false, error: 'Watched must be an array of booleans.' });
    }
    const updated = MediaModel.updateWatched(req.params.id, watched);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Entry not found.' });
    }
    res.json({ success: true, data: updated, message: 'Season status updated.' });
  } catch (err) {
    console.error('Error updating watched:', err);
    res.status(500).json({ success: false, error: 'Failed to update watched status.' });
  }
});

// PATCH /api/media/:id/toggle-season - Toggle individual season watched state
app.patch('/api/media/:id/toggle-season', (req, res) => {
  try {
    const { seasonIndex } = req.body;
    if (seasonIndex === undefined) {
      return res.status(400).json({ success: false, error: 'seasonIndex is required.' });
    }
    const updated = MediaModel.toggleSeason(req.params.id, seasonIndex);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Entry or season not found.' });
    }
    res.json({ success: true, data: updated, message: `Season ${seasonIndex + 1} toggled.` });
  } catch (err) {
    console.error('Error toggling season:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle season.' });
  }
});

// PATCH /api/media/:id/favorite - Toggle favorite state
app.patch('/api/media/:id/favorite', (req, res) => {
  try {
    const item = MediaModel.getById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Entry not found.' });
    }
    const updated = MediaModel.update(req.params.id, { favorite: !item.favorite });
    res.json({ success: true, data: updated, message: updated.favorite ? 'Added to favorites.' : 'Removed from favorites.' });
  } catch (err) {
    console.error('Error toggling favorite:', err);
    res.status(500).json({ success: false, error: 'Failed to toggle favorite.' });
  }
});

// DELETE /api/media/:id - Delete entry
app.delete('/api/media/:id', (req, res) => {
  try {
    const success = MediaModel.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Entry not found.' });
    }
    res.json({ success: true, message: 'Entry deleted successfully.' });
  } catch (err) {
    console.error('Error deleting media:', err);
    res.status(500).json({ success: false, error: 'Failed to delete entry.' });
  }
});

// GET /api/stats - Statistical analytics summary
app.get('/api/stats', (req, res) => {
  try {
    const stats = MediaModel.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('Error calculating stats:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch statistics.' });
  }
});

// GET /api/wheel - Lucky Wheel items
app.get('/api/wheel', (req, res) => {
  try {
    const { category, type } = req.query;
    const items = MediaModel.getWheelCandidates(category, type);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error('Error fetching wheel items:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch wheel items.' });
  }
});

// GET /api/export - Export database as JSON or CSV
app.get('/api/export', (req, res) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    const items = MediaModel.exportAll();

    if (format === 'csv') {
      const headers = ['ID', 'Category', 'Name', 'Alt Name', 'Type', 'Seasons', 'Year', 'Status', 'Rating', 'Favorite', 'Watched', 'Genres', 'Platform', 'Episodes', 'Notes', 'Created At', 'Updated At'];
      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = items.map(i => [
        escapeCsv(i.id),
        escapeCsv(i.category),
        escapeCsv(i.name),
        escapeCsv(i.alt_name),
        escapeCsv(i.type),
        i.seasons,
        escapeCsv(i.year),
        escapeCsv(i.status),
        i.rating,
        i.favorite ? 1 : 0,
        escapeCsv(i.watched.join(',')),
        escapeCsv(i.genres.join(',')),
        escapeCsv(i.platform),
        i.episodes,
        escapeCsv(i.notes),
        escapeCsv(i.created_at),
        escapeCsv(i.updated_at)
      ].join(','));

      const csvContent = [headers.join(','), ...rows].join('\r\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="media_tracker_export_${Date.now()}.csv"`);
      return res.send(csvContent);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="media_tracker_backup_${Date.now()}.json"`);
    res.json({
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      total_count: items.length,
      data: items
    });
  } catch (err) {
    console.error('Error exporting data:', err);
    res.status(500).json({ success: false, error: 'Export failed.' });
  }
});

// POST /api/import - Import JSON backup
app.post('/api/import', (req, res) => {
  try {
    const { items, replaceExisting = false } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or empty items array.' });
    }

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      if (!item.name || !item.category) {
        skipped++;
        continue;
      }

      const dup = MediaModel.findDuplicate(item.name, item.category);
      if (dup) {
        if (replaceExisting) {
          MediaModel.update(dup.id, item);
          inserted++;
        } else {
          skipped++;
        }
      } else {
        MediaModel.create(item);
        inserted++;
      }
    }

    res.json({
      success: true,
      message: `Import complete: ${inserted} processed, ${skipped} skipped.`,
      inserted,
      skipped
    });
  } catch (err) {
    console.error('Error importing data:', err);
    res.status(500).json({ success: false, error: 'Import failed.' });
  }
});

// Catch-all fallback to serve the Single Page App
app.use((req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('Unified Media Tracker API is active.');
  }
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Unified Media Tracker Server Running!`);
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`💾 SQLite Database: media_tracker.db`);
    console.log(`⚡ Node v${process.version} | Driver: ${MediaModel.dbType}`);
    console.log(`===============================================`);
  });
}

module.exports = app;
