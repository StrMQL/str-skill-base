function addColumnIfMissing(db, sql) {
  try {
    db.exec(sql);
  } catch (error) {
    if (!String(error && error.message ? error.message : error).includes('duplicate column name')) {
      throw error;
    }
  }
}

function up(db) {
  addColumnIfMissing(db, 'ALTER TABLE collections ADD COLUMN slug TEXT');

  db.exec(`
    UPDATE collections
    SET slug = 'collection-' || id
    WHERE slug IS NULL OR TRIM(slug) = '';
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
  `);
}

module.exports = {
  version: '009-collection-slug',
  up
};
