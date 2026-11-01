// A small in-memory stand-in for the Supabase client: just the query-builder calls the app's sync
// code makes (select, eq, is, in, order, range, limit, upsert, update, delete, and head counts).
// Not a test file (no .test in the name), so `node --test` doesn't run it on its own.
//
//   const db = fakeSupabase({ sessions: [row, ...] }, { schema: { sessions: ['id', ...] } });
//   db.client.from('sessions').select('id').eq('user_id', 'u1')
//   db.log   every request made: { table, mode, columns, filters }
//   db.tables  the rows as they stand now

// Reads a column, or a JSON path like 'data->>deletedAt' (text), from a row.
function read(row, path) {
  const m = /^(\w+)->>(\w+)$/.exec(path);
  if (!m) return row[path];
  const inner = row[m[1]];
  if (!inner || typeof inner !== 'object') return null;
  const v = inner[m[2]];
  return v === undefined || v === null ? null : String(v);
}

export function fakeSupabase(initial = {}, { schema = {}, failOn = {} } = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(initial)) tables[name] = rows.map(r => ({ ...r }));
  const log = [];

  class Query {
    constructor(table) {
      this.table = table;
      this.mode = 'select';
      this.filters = [];
      this.filterDescs = [];
      this.range_ = null;
      this.limit_ = null;
      this.opts = {};
      this.sortKeys = [];
    }
    select(columns = '*', opts = {}) { this.columns = columns; this.opts = opts; return this; }
    upsert(row) { this.mode = 'upsert'; this.payload = row; return this; }
    update(patch) { this.mode = 'update'; this.payload = patch; return this; }
    delete() { this.mode = 'delete'; return this; }
    eq(c, v) { this.filters.push(r => read(r, c) === v); this.filterDescs.push(`${c}=${v}`); return this; }
    is(c, v) { this.filters.push(r => (v === null ? read(r, c) == null : read(r, c) === v)); this.filterDescs.push(`${c} is ${v}`); return this; }
    in(c, vs) { this.filters.push(r => vs.includes(read(r, c))); this.filterDescs.push(`${c} in [${vs.join(',')}]`); this.inValues = vs; return this; }
    order(c, { ascending = true } = {}) { this.sortKeys.push([c, ascending]); return this; }
    range(a, b) { this.range_ = [a, b]; return this; }
    limit(n) { this.limit_ = n; return this; }
    then(resolve, reject) { return Promise.resolve(this.run()).then(resolve, reject); }

    run() {
      log.push({ table: this.table, mode: this.mode, columns: this.columns, filters: [...this.filterDescs], inValues: this.inValues });
      const forced = failOn[`${this.table}:${this.mode}`];
      if (forced) return { data: null, error: { message: forced } };
      const rows = tables[this.table] || (tables[this.table] = []);
      const known = schema[this.table];
      const checkColumns = names => {
        if (!known) return null;
        const bad = names.find(n => !known.includes(n.split('->')[0]));
        return bad ? { message: `Could not find the '${bad}' column of '${this.table}' in the schema cache` } : null;
      };

      if (this.mode === 'upsert') {
        const bad = checkColumns(Object.keys(this.payload));
        if (bad) return { data: null, error: bad };
        const i = rows.findIndex(r => r.id === this.payload.id);
        if (i >= 0) rows[i] = { ...rows[i], ...this.payload }; else rows.push({ ...this.payload });
        return { data: null, error: null };
      }
      if (this.mode === 'update') {
        rows.forEach((r, i) => { if (this.filters.every(f => f(r))) rows[i] = { ...r, ...this.payload }; });
        return { data: null, error: null };
      }
      if (this.mode === 'delete') {
        tables[this.table] = rows.filter(r => !this.filters.every(f => f(r)));
        return { data: null, error: null };
      }

      // select
      let cols = null;
      if (this.columns && this.columns !== '*') {
        cols = this.columns.split(',').map(s => s.trim()).filter(Boolean).map(s => {
          const m = /^(\w+):(.+)$/.exec(s);
          return m ? { alias: m[1], path: m[2] } : { alias: s, path: s };
        });
        const bad = checkColumns(cols.map(c => c.path));
        if (bad) return { data: null, error: bad };
      }
      let out = rows.filter(r => this.filters.every(f => f(r)));
      for (const [c, asc] of [...this.sortKeys].reverse()) {
        out = [...out].sort((a, b) => (String(read(a, c)) < String(read(b, c)) ? -1 : String(read(a, c)) > String(read(b, c)) ? 1 : 0) * (asc ? 1 : -1));
      }
      if (this.opts.head) return { data: null, count: out.length, error: null };
      if (this.range_) out = out.slice(this.range_[0], this.range_[1] + 1);
      if (this.limit_ != null) out = out.slice(0, this.limit_);
      const data = cols ? out.map(r => Object.fromEntries(cols.map(c => [c.alias, read(r, c.path)]))) : out.map(r => ({ ...r }));
      return { data, error: null };
    }
  }

  const client = { from: table => new Query(table) };
  return { client, log, tables };
}
