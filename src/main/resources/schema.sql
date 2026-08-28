-- One JSON document per draft. The (id, doc) shape is portable across H2 and Postgres
-- and mirrors how the Control Plane persists its aggregates.
CREATE TABLE IF NOT EXISTS studio_draft (
    id  VARCHAR(64) PRIMARY KEY,
    doc VARCHAR(1000000) NOT NULL
);

-- Single-row-per-key settings (e.g. the editable launch command template). Same
-- portable shape as studio_draft.
CREATE TABLE IF NOT EXISTS studio_settings (
    k VARCHAR(64) PRIMARY KEY,
    v VARCHAR(10000) NOT NULL
);

-- One JSON document per skill draft. Same portable (id, doc) shape as studio_draft —
-- a skill is not published to the Registry, but it is durable editing state.
CREATE TABLE IF NOT EXISTS studio_skill (
    id  VARCHAR(64) PRIMARY KEY,
    doc VARCHAR(1000000) NOT NULL
);
