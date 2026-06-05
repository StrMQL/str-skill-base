const AdmZip = require('adm-zip');

/** macOS zip 元数据目录，上传时应丢弃 */
function isJunkZipPath(entryPath) {
  const normalized = String(entryPath || '').replace(/\\/g, '/');
  return normalized.split('/').some((seg) => seg === '__MACOSX');
}

/**
 * 去掉 zip 中的 __MACOSX 条目；无垃圾条目时返回原 buffer。
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
function sanitizeZipBuffer(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return buffer;
  }
  const entries = zip.getEntries();
  const keep = entries.filter((e) => !isJunkZipPath(e.entryName));
  if (keep.length === entries.length) {
    return buffer;
  }

  const out = new AdmZip();
  for (const entry of keep) {
    if (entry.isDirectory) continue;
    out.addFile(entry.entryName.replace(/\\/g, '/'), entry.getData());
  }
  return out.toBuffer();
}

module.exports = { isJunkZipPath, sanitizeZipBuffer };
