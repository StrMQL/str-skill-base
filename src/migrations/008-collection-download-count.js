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
  addColumnIfMissing(db, 'ALTER TABLE collections ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0');

  db.exec(`
    UPDATE collections
    SET download_count = COALESCE(download_count, 0);
  `);
}

module.exports = {
  version: '008-collection-download-count',
  up
};
