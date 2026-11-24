import { createHash } from "node:crypto";

// Copies every collection (documents and indexes) from one MongoDB database
// to another and proves the copy is complete. Takes two native `Db` objects
// (e.g. mongoose connection.db). The source is only ever read.

const BATCH = 1000;

export async function listCollections(db) {
  const all = await db.listCollections({}, { nameOnly: true }).toArray();
  return all
    .filter((c) => (c.type ?? "collection") === "collection" && !c.name.startsWith("system."))
    .map((c) => c.name)
    .sort();
}

// Count plus a fingerprint of every document id, so "same number of
// documents" can't hide one missing and another duplicated.
export async function fingerprint(db, name) {
  const ids = await db.collection(name).find({}, { projection: { _id: 1 } }).map((d) => String(d._id)).toArray();
  ids.sort();
  return { count: ids.length, idHash: createHash("sha256").update(ids.join("\n")).digest("hex").slice(0, 16) };
}

// Business figures that must match exactly after the copy.
export async function businessTotals(db) {
  const sumOf = async (collection, field, match = {}) => {
    const [r] = await db.collection(collection)
      .aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }])
      .toArray();
    return r?.total ?? 0;
  };
  return {
    paidRevenue: await sumOf("orders", "totalPrice", { isPaid: true, status: { $ne: "cancelled" } }),
    totalStock: await sumOf("products", "stock"),
    loyaltyPoints: await sumOf("users", "loyaltyPoints"),
    admins: await db.collection("users").countDocuments({ isAdmin: true }),
  };
}

export async function targetHasData(db) {
  for (const name of await listCollections(db)) {
    if ((await db.collection(name).estimatedDocumentCount()) > 0) return true;
  }
  return false;
}

export async function copyDatabase(source, target, { replace = false, log = () => {} } = {}) {
  if (!replace && (await targetHasData(target))) {
    throw new Error("The new database already has data. Nothing was copied.");
  }
  const names = await listCollections(source);

  for (const name of names) {
    if (replace) await target.collection(name).drop().catch(() => {});
    const from = source.collection(name);
    const to = target.collection(name);

    let batch = [];
    let copied = 0;
    for await (const doc of from.find({})) {
      batch.push(doc);
      if (batch.length === BATCH) {
        await to.insertMany(batch, { ordered: true });
        copied += batch.length;
        batch = [];
      }
    }
    if (batch.length) {
      await to.insertMany(batch, { ordered: true });
      copied += batch.length;
    }
    if (copied === 0) await target.createCollection(name).catch(() => {});

    // Indexes after the data (faster). Unique indexes are recreated too, so
    // the new database enforces the same rules (one account per email…).
    const indexes = (await from.indexes()).filter((ix) => ix.name !== "_id_");
    for (const ix of indexes) {
      const { key, v: _v, ns: _ns, ...options } = ix;
      await to.createIndex(key, options);
    }
    log(`${name}: ${copied} documents, ${indexes.length} indexes`);
  }
  return names;
}

// Compares source and target collection by collection, plus the business
// totals. Returns a list of differences; empty means identical.
export async function verifyCopy(source, target) {
  const differences = [];
  const sourceNames = await listCollections(source);
  const targetNames = new Set(await listCollections(target));
  const report = [];
  for (const name of sourceNames) {
    if (!targetNames.has(name)) {
      differences.push(`${name}: missing in the new database`);
      continue;
    }
    const [a, b] = await Promise.all([fingerprint(source, name), fingerprint(target, name)]);
    report.push({ collection: name, old: a.count, new: b.count, match: a.count === b.count && a.idHash === b.idHash });
    if (a.count !== b.count) differences.push(`${name}: ${a.count} documents before, ${b.count} after`);
    else if (a.idHash !== b.idHash) differences.push(`${name}: same count but different documents`);
  }
  const [ta, tb] = await Promise.all([businessTotals(source), businessTotals(target)]);
  for (const key of Object.keys(ta)) {
    if (ta[key] !== tb[key]) differences.push(`${key}: ${ta[key]} before, ${tb[key]} after`);
  }
  return { differences, report, totals: ta };
}
