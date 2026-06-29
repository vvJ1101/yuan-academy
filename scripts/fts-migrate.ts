import Database from 'better-sqlite3'

const DB_PATH = 'prisma/dev.db'
const db = new Database(DB_PATH)

// Enable FTS5
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(
    doc_id UNINDEXED,
    title,
    content,
    department,
    audience_slug UNINDEXED,
    type,
    tokenize='trigram'
  )
`)

// Sync data from Document table
const count = db.prepare(`SELECT COUNT(*) as cnt FROM Document WHERE slug != ''`).get() as { cnt: number }
console.log(`Documents to sync: ${count.cnt}`)

db.exec(`
  INSERT INTO document_fts(doc_id, title, content, department, audience_slug, type)
  SELECT d.id, d.title, COALESCE(NULLIF(d.fullContent, ''), d.content), dep.name,
    COALESCE((SELECT dep2.slug FROM DocumentAudience da JOIN Department dep2 ON dep2.id = da.departmentId WHERE da.documentId = d.id LIMIT 1), dep.slug),
    d.category
  FROM Document d
  JOIN Department dep ON d.ownerDeptId = dep.id
  WHERE d.slug != ''
    AND d.id NOT IN (SELECT doc_id FROM document_fts)
`)

const total = db.prepare(`SELECT COUNT(*) as cnt FROM document_fts`).get() as { cnt: number }
console.log(`FTS index: ${total.cnt} documents`)

db.close()
console.log('FTS migration complete')
