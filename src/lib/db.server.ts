import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.resolve(process.cwd(), '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Resumes storage
const uploadDir = path.resolve(dataDir, 'resumes');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, 'hire_sense.db'));
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'candidate',
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    headline TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT,
    raw_text TEXT,
    structured TEXT, -- JSON
    embedding TEXT, -- JSON Array for JS vector math
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS resume_analyses (
    id TEXT PRIMARY KEY,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL,
    ats_score INTEGER,
    clarity INTEGER,
    impact INTEGER,
    strengths TEXT, -- JSON
    gaps TEXT, -- JSON
    roadmap TEXT, -- JSON
    summary TEXT,
    raw TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    recruiter_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT, -- JSON
    embedding TEXT, -- JSON Array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS job_matches (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    resume_id TEXT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    matching_skills TEXT, -- JSON
    missing_skills TEXT, -- JSON
    reasoning TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, resume_id)
  );

  CREATE TABLE IF NOT EXISTS interviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    role_target TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS interview_turns (
    id TEXT PRIMARY KEY,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    question TEXT NOT NULL,
    answer_transcript TEXT,
    evaluation TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(interview_id, idx)
  );

  CREATE TABLE IF NOT EXISTS interview_results (
    id TEXT PRIMARY KEY,
    interview_id TEXT NOT NULL REFERENCES interviews(id) ON DELETE CASCADE UNIQUE,
    overall_score INTEGER NOT NULL,
    communication INTEGER,
    technical INTEGER,
    star INTEGER,
    confidence INTEGER,
    clarity INTEGER,
    summary TEXT,
    strengths TEXT, -- JSON
    improvements TEXT, -- JSON
    raw TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    recruiter_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    stage TEXT NOT NULL DEFAULT 'Applied',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recruiter_id, candidate_id, job_id)
  );

  CREATE TABLE IF NOT EXISTS outreach_emails (
    id TEXT PRIMARY KEY,
    recruiter_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    candidate_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interview_preps (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
    role_target TEXT NOT NULL,
    experience_level TEXT,
    company_type TEXT,
    mode TEXT NOT NULL DEFAULT 'Mixed',
    jd_text TEXT,
    jd_analysis TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Additive migrations (SQLite has no IF NOT EXISTS for columns, so try/catch).
function safeAlter(sql: string) {
  try { db.exec(sql); } catch { /* column already exists */ }
}
safeAlter("ALTER TABLE profiles ADD COLUMN coach_memory TEXT");
safeAlter("ALTER TABLE resumes ADD COLUMN parent_id TEXT");
safeAlter("ALTER TABLE resumes ADD COLUMN label TEXT");
safeAlter("ALTER TABLE interviews ADD COLUMN prep_id TEXT");
safeAlter("ALTER TABLE interviews ADD COLUMN mode TEXT");
safeAlter("ALTER TABLE interview_turns ADD COLUMN difficulty INTEGER DEFAULT 50");
safeAlter("ALTER TABLE interview_results ADD COLUMN problem_solving INTEGER");
safeAlter("ALTER TABLE interview_results ADD COLUMN leadership INTEGER");
safeAlter("ALTER TABLE interview_results ADD COLUMN behavioral INTEGER");
safeAlter("ALTER TABLE interview_results ADD COLUMN culture_fit INTEGER");
safeAlter("ALTER TABLE interview_results ADD COLUMN readiness INTEGER");
safeAlter("ALTER TABLE resumes ADD COLUMN recruiter_status TEXT DEFAULT 'needs_review'");
safeAlter("ALTER TABLE resumes ADD COLUMN recruiter_notes TEXT");
safeAlter("ALTER TABLE resumes ADD COLUMN uploader_id TEXT");


