// @ts-check
// The shapes of the records the app stores and syncs, as JSDoc types. Nothing here runs: it is read by the
// editor and by `tsc -p jsconfig.json` (npm run typecheck, and the lint job in CI), which check that code
// annotated with these types uses them the way they are defined.
//
// The two kinds are kept apart on purpose, because mixing them is the app's recurring bug:
//  - local records are camelCase (timeSigs, createdAt, tomorrowFocus) and OPEN: any other field may ride
//    along (that is how a new field travels without anyone listing it), so they allow extra keys;
//  - Supabase rows are snake_case (time_sigs, created_at, data) and CLOSED: they are exactly the table's
//    columns, so a field that is not a column is an error at the place it is written.
// What this catches: camelCase written into a row, a value of the wrong type in a row (a tempo kept as
// text), a wrongly typed field on a record. What it cannot: a misspelt field name on a local record,
// because those are open. tests/recordRoundTrip.test.mjs covers that side, by sending every field of a
// record through a push and a pull and checking it comes back.

/** @typedef {'sessions' | 'lessons' | 'compositions'} Table */

/**
 * One block of a session or lesson: a piece, or some technique.
 * @typedef {{
 *   id: string,
 *   type: 'technique' | 'repertoire',
 *   group?: string | null,
 *   title?: string | null,
 *   compositionId?: string | null,
 *   section?: string | null,
 *   notes?: string | null,
 *   duration?: number | null,
 *   feltDifficulty?: number | null,
 *   liking?: number | null,
 *   scales?: Array<string | Record<string, any>>,
 *   octaves?: number | null,
 *   tempo?: number | string | null,
 *   feedback?: string | null,
 *   assignment?: string | null,
 *   challenges?: string[],
 *   progress?: string[],
 * } & Record<string, any>} Segment
 */

/**
 * A practice session, as the app holds it.
 * @typedef {{
 *   id: string,
 *   date: string,
 *   duration?: number | null,
 *   energy?: number | null,
 *   enjoyment?: number | null,
 *   wins?: string | null,
 *   tomorrowFocus?: string,
 *   segments?: Segment[],
 *   createdAt?: string,
 *   updated_at?: string,
 * } & Record<string, any>} Session
 */

/**
 * A lesson, as the app holds it.
 * @typedef {{
 *   id: string,
 *   date: string,
 *   duration?: number | null,
 *   teacher?: string | null,
 *   wins?: string | null,
 *   overallNotes?: string,
 *   nextFocus?: string,
 *   segments?: Segment[],
 *   createdAt?: string,
 *   updated_at?: string,
 * } & Record<string, any>} Lesson
 */

/**
 * A piece in the library, as the app holds it. `tempo` may be text while a form is being edited.
 * @typedef {{
 *   id: string,
 *   title: string,
 *   composer?: string | null,
 *   status?: string | null,
 *   keys?: Array<{ root: string, mode: string }>,
 *   timeSigs?: string[],
 *   tempo?: number | string | null,
 *   notes?: string | null,
 *   createdAt?: string,
 *   updated_at?: string,
 * } & Record<string, any>} Composition
 */

/** @typedef {Session | Lesson | Composition} LocalRecord */

// ── Supabase rows: exactly the columns (see REMOTE_COLUMNS in records.js) ──

/**
 * @typedef {{
 *   id: string, user_id: string | null, date: string,
 *   duration?: number | null, energy?: number | null, enjoyment?: number | null, wins?: string | null,
 *   segments?: Segment[], created_at?: string, updated_at: string, data?: Record<string, any> | null,
 * }} RemoteSessionRow
 */

/**
 * @typedef {{
 *   id: string, user_id: string | null, date: string,
 *   duration?: number | null, teacher?: string | null, wins?: string | null,
 *   segments?: Segment[], created_at?: string, updated_at: string, data?: Record<string, any> | null,
 * }} RemoteLessonRow
 */

/**
 * @typedef {{
 *   id: string, user_id: string | null, title: string,
 *   composer?: string | null, status?: string | null, keys?: Array<{ root: string, mode: string }>,
 *   time_sigs?: string[], tempo?: number | null, notes?: string | null,
 *   created_at?: string, updated_at: string, data?: Record<string, any> | null,
 * }} RemoteCompositionRow
 */

/** @typedef {RemoteSessionRow | RemoteLessonRow | RemoteCompositionRow} RemoteRow */

export {};
