#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════╗
//  LinkedIn DS — Seed Data Script
//
//  TWO MODES — choose based on what you need:
//
//    node databases/seed.js          ← FRESH (default)
//      Wipes everything and inserts clean data.
//      Use this before a demo or after schema changes.
//
//    node databases/seed.js --keep   ← KEEP existing data
//      Skips existing records, only adds what's missing.
//      Use this when you just want to top up data without
//      losing accounts you've already created in the UI.
//
//  What this script does:
//    0. Clears all data (unless --keep flag is passed)
//    1. Creates DEMO accounts you can actually log in with
//    2. Creates 50 recruiters across 10 real-looking tech companies
//    3. Creates 200 members (job seekers) with realistic profiles
//    4. Posts 100 jobs with proper descriptions
//    5. Creates ~400 job applications with mixed statuses
//    6. Connects members together (like real LinkedIn connections)
//    7. Seeds chat messages in MongoDB
//    8. Seeds analytics events in MongoDB (for charts)
//
//  HOW TO RUN:
//    Step 1:  Make sure Docker is running
//             docker-compose up -d
//    Step 2:  Go to project root folder
//             cd /path/to/project
//    Step 3:  Install required packages
//             npm install bcryptjs mysql2 mongodb uuid
//    Step 4:  Run the seeder
//             node databases/seed.js
//
//  Demo login credentials (password: Demo@1234):
//
//  MEMBER ACCOUNTS (job seekers):
//    alice@demo.com    / Demo@1234
//    bob@demo.com      / Demo@1234
//    carol@demo.com    / Demo@1234
//    david@demo.com    / Demo@1234
//    emma@demo.com     / Demo@1234
//
//  RECRUITER ACCOUNTS:
//    recruiter1@google.com  / Demo@1234
//    recruiter1@meta.com    / Demo@1234
//    recruiter1@amazon.com  / Demo@1234
// ╚══════════════════════════════════════════════════════════════════╝

'use strict';

// ── Run mode ──────────────────────────────────────────────────────────────────
// Pass --keep to skip the wipe step and only add missing records.
// Default (no flag) = fresh wipe before inserting.
const KEEP_EXISTING = process.argv.includes('--keep');

// ── Packages we need ──────────────────────────────────────────────────────────
// mysql2  → talks to our MySQL database
// mongodb → talks to our MongoDB database
// bcryptjs → hashes passwords (converts "Demo@1234" into a safe scrambled string)
// uuid    → generates unique IDs like "a1b2c3d4-e5f6-..."
const fs         = require('fs');
const path       = require('path');
const mysql      = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const bcrypt     = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── Database connection settings ──────────────────────────────────────────────
// Reads from environment variables — set these in project.env before running.
// Fallback values are only used if the env var is not set (local dev convenience).
const MYSQL_CONFIG = {
  host:     process.env.MYSQL_HOST     || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT || '3307'), // Docker maps 3307 → 3306 inside container
  user:     process.env.MYSQL_USER     || 'appuser',
  password: process.env.MYSQL_PASSWORD || 'apppassword',
  database: process.env.MYSQL_DATABASE || 'linkedin_ds',
  waitForConnections: true,
  connectionLimit: 5,
};

const MONGO_URI = process.env.MONGO_URI ||
  `mongodb://${process.env.MONGO_USER || 'appuser'}:${process.env.MONGO_PASSWORD || 'apppassword'}@${process.env.MONGO_HOST || 'localhost'}:${process.env.MONGO_PORT || 27017}/linkedin_ds_logs?authSource=admin`;

// ── How many records to create ────────────────────────────────────────────────
// You can change these numbers to make the dataset bigger or smaller
// Scale targets — meets the 10k minimum requirement from the spec
const NUM_EXTRA_MEMBERS    = 9995;  // + 5 demo = 10,000 total members
const NUM_EXTRA_RECRUITERS = 9997;  // + 3 demo = 10,000 total recruiters
const NUM_JOBS             = 10000; // 10,000 job postings
const APPS_PER_MEMBER      = 2;     // how many jobs each member applies to

// ── All the fake data we pick from randomly ───────────────────────────────────

const FIRST_NAMES = [
  'Alice','Bob','Carol','David','Emma','Frank','Grace','Henry','Ivy','Jack',
  'Karen','Liam','Maya','Noah','Olivia','Paul','Quinn','Rachel','Sam','Tara',
  'Uma','Victor','Wendy','Xander','Yara','Zoe','Aaron','Bella','Carlos','Diana',
  'Ethan','Fiona','George','Hannah','Ian','Julia','Kevin','Luna','Marcus','Nina',
  'Oscar','Priya','Ryan','Sofia','Tyler','Uma','Vance','Whitney','Xena','Yasmin',
];

const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Rodriguez','Martinez','Hernandez','Lopez','Wilson','Anderson','Thomas',
  'Taylor','Moore','Jackson','Martin','Lee','Perez','White','Harris','Clark',
  'Lewis','Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen',
  'Hill','Flores','Green','Adams','Nelson','Baker','Hall','Rivera','Campbell',
  'Mitchell','Carter','Roberts','Evans','Turner','Parker','Collins','Edwards',
];

// Major US tech hub cities with their state abbreviations
const CITIES = [
  { city: 'San Jose',       state: 'CA' },
  { city: 'San Francisco',  state: 'CA' },
  { city: 'Seattle',        state: 'WA' },
  { city: 'Austin',         state: 'TX' },
  { city: 'New York',       state: 'NY' },
  { city: 'Boston',         state: 'MA' },
  { city: 'Chicago',        state: 'IL' },
  { city: 'Los Angeles',    state: 'CA' },
  { city: 'Denver',         state: 'CO' },
  { city: 'Atlanta',        state: 'GA' },
  { city: 'Portland',       state: 'OR' },
  { city: 'Raleigh',        state: 'NC' },
];

// Tech skills used for member profiles and job requirements
const SKILLS = [
  'Python','JavaScript','TypeScript','Java','Go','Rust','C++',
  'React','Node.js','Vue.js','Angular','Next.js',
  'MySQL','PostgreSQL','MongoDB','Redis','Elasticsearch',
  'Kafka','RabbitMQ','Docker','Kubernetes','AWS','GCP','Azure',
  'Machine Learning','TensorFlow','PyTorch','Spark','Scala',
  'GraphQL','REST APIs','gRPC','Microservices','System Design',
  'Git','Linux','CI/CD','Terraform','Ansible','Jenkins',
  'Data Engineering','ETL','Tableau','Figma','Agile','Scrum',
];

// Template phrases to build realistic headline text
// {X} gets replaced with a real value when we build the string
const HEADLINE_TEMPLATES = [
  'Software Engineer | {skill} & {skill2}',
  'Senior {role} at {company}',
  '{role} | Building scalable systems with {skill}',
  'Full Stack Engineer | {skill} enthusiast',
  '{role} | Open to new opportunities',
  'Passionate {role} | {skill} & {skill2}',
  'Ex-{company} · Now {role} at {company2}',
  '{role} | {city} | {skill} expert',
];

// Well-known tech companies for realistic job postings
const COMPANIES = [
  { name: 'Google',      industry: 'Technology'   },
  { name: 'Meta',        industry: 'Technology'   },
  { name: 'Amazon',      industry: 'Technology'   },
  { name: 'Microsoft',   industry: 'Technology'   },
  { name: 'Apple',       industry: 'Technology'   },
  { name: 'Netflix',     industry: 'Media'        },
  { name: 'Uber',        industry: 'Technology'   },
  { name: 'Airbnb',      industry: 'Technology'   },
  { name: 'Stripe',      industry: 'Finance'      },
  { name: 'Salesforce',  industry: 'Technology'   },
];

const JOB_TITLES = [
  'Software Engineer','Senior Software Engineer','Staff Engineer',
  'Backend Engineer','Frontend Engineer','Full Stack Engineer',
  'Data Engineer','ML Engineer','DevOps Engineer',
  'Site Reliability Engineer','Platform Engineer',
  'Data Scientist','Data Analyst','Product Manager',
  'Solutions Architect','Security Engineer',
];

// Realistic multi-line job descriptions
// {title}, {company}, {skill1}, {skill2} get filled in
const JOB_DESC_TEMPLATES = [
  `About the Role:
We are looking for a talented {title} to join our growing engineering team at {company}.

What you'll do:
• Design and build high-performance, scalable {skill1} systems
• Collaborate with cross-functional teams to define and ship features
• Write clean, maintainable code with strong test coverage
• Participate in code reviews and mentor junior engineers

What we're looking for:
• 3+ years of experience with {skill1} and {skill2}
• Strong understanding of distributed systems and microservices
• BS/MS in Computer Science or equivalent practical experience

We offer competitive salary, equity, and great benefits.`,

  `{company} is hiring a {title}!

You'll be joining a world-class team working on problems that impact millions of users.

Responsibilities:
• Build and maintain production {skill1} services
• Improve system reliability, scalability, and performance
• Work with data using {skill2}
• Drive technical decisions from design to deployment

Requirements:
• Proficiency in {skill1} and {skill2}
• Experience with cloud platforms (AWS / GCP / Azure)
• Strong problem-solving skills and attention to detail

This is a {work_mode} position based in our {city} office.`,
];

const WORK_MODES = ['onsite', 'remote', 'hybrid'];

// Sample conversation messages for the messaging feature
const CHAT_MESSAGES = [
  "Hi! I saw you're hiring for a {role} position. I'd love to learn more.",
  "Thanks for reaching out! Yes, we have an opening. Can you share your resume?",
  "Absolutely, I've attached it. I have 4 years of experience with {skill}.",
  "Great background! Would you be available for a 30-minute call this week?",
  "Sure! Thursday at 2pm works for me. Looking forward to it.",
  "Perfect, I'll send a calendar invite. See you then!",
  "Just wanted to follow up on my application for the {role} role.",
  "We're still reviewing candidates. We'll be in touch by end of week.",
  "Sounds good, thank you for the update!",
  "I wanted to congratulate you — we'd like to move forward to the next round!",
  "That's amazing news! I'm very excited about this opportunity.",
  "We were really impressed with your {skill} experience in the interview.",
];

// ── Utility / Helper Functions ────────────────────────────────────────────────
// These small functions help us avoid repeating code

// Pick one random item from an array
// Example: pick(['a','b','c']) → could return 'b'
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick N random items from an array (no duplicates)
// Example: pickN(['a','b','c','d'], 2) → could return ['c','a']
function pickN(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

// Pick a random whole number between min and max (inclusive)
// Example: randInt(1, 10) → could return 7
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Build an email address from a first name, last name, and optional suffix
// Example: makeEmail('Alice', 'Smith', '_42') → 'alice.smith_42@gmail.com'
function makeEmail(first, last, suffix = '') {
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  return `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@${pick(domains)}`;
}

// Build a realistic headline by filling template placeholders
// Example: 'Senior {role} at {company}' → 'Senior Data Engineer at Google'
function makeHeadline(role, skills, location) {
  const tpl = pick(HEADLINE_TEMPLATES);
  return tpl
    .replace('{role}',     role)
    .replace('{skill}',    skills[0] || 'Python')
    .replace('{skill2}',   skills[1] || 'JavaScript')
    .replace('{company}',  pick(COMPANIES).name)
    .replace('{company2}', pick(COMPANIES).name)
    .replace('{city}',     location.city);
}

// Build a realistic job description by filling template placeholders
function makeJobDesc(title, companyName, skills, workMode, city) {
  const tpl = pick(JOB_DESC_TEMPLATES);
  return tpl
    .replace(/{title}/g,    title)
    .replace(/{company}/g,  companyName)
    .replace('{skill1}',    skills[0] || 'Python')
    .replace('{skill2}',    skills[1] || 'SQL')
    .replace('{work_mode}', workMode)
    .replace('{city}',      city);
}

// Print a progress bar in the terminal so we know the script isn't frozen
// Example output:  Members: 150/200 (75%) ████████░░░░
function showProgress(label, current, total) {
  const pct   = Math.round((current / total) * 100);
  const filled = Math.round(pct / 5);
  const bar   = '█'.repeat(filled) + '░'.repeat(20 - filled);
  process.stdout.write(`\r  ${label}: ${current}/${total} [${bar}] ${pct}%`);
  if (current === total) console.log(' ✓');
}

// ── Password Hashing ──────────────────────────────────────────────────────────
// We can't store "password123" in the database — that's a security risk.
// bcrypt converts it into a scrambled string like "$2a$10$xyz..." that can't
// be reversed. We hash it once here so we don't repeat the slow work in the loop.
async function hashPassword(plain) {
  // 10 = "salt rounds" — higher = slower but safer. 10 is the industry standard.
  return bcrypt.hash(plain, 10);
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN SEED FUNCTION
//  This is where all the work happens. We wrap it in async/await so we can
//  wait for each database call to finish before starting the next one.
// ══════════════════════════════════════════════════════════════════════════════

async function seed() {
  console.log('\n🌱  LinkedIn DS — Professional Seed Script');
  console.log('═'.repeat(55));

  // ── Step 0: Connect to both databases ───────────────────────────────────────
  console.log('\n📡 Connecting to databases...');

  // MySQL connection pool: a pool lets us reuse connections efficiently
  const pool = await mysql.createPool(MYSQL_CONFIG);
  console.log('  ✓ MySQL connected');

  // MongoDB client
  const mongoClient = new MongoClient(MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db('linkedin_ds_logs');
  console.log('  ✓ MongoDB connected');

  // Get a single MySQL connection for our bulk inserts
  const conn = await pool.getConnection();

  // Pre-hash the shared demo password once (saves time — hashing is slow by design)
  // Password meets signup requirements: uppercase, number, special character, 8+ chars
  const DEMO_HASH = await hashPassword('Demo@1234');

  try {

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 0: CLEAN DATABASE  (skipped when --keep flag is passed)
    //  Wipe all existing data so every seed run starts fresh.
    //  We disable FK checks temporarily so we can truncate in any order.
    // ──────────────────────────────────────────────────────────────────────────
    if (KEEP_EXISTING) {
      console.log('\n⏭  Skipping clean — keeping existing data (--keep mode)');
    } else {
      console.log('\n🧹 Cleaning existing data...');

      // Turn off foreign-key checks so TRUNCATE doesn't complain about related rows
      await conn.execute('SET FOREIGN_KEY_CHECKS = 0');

      // MySQL tables — ordered doesn't matter with FK checks off
      const mysqlTables = [
        'application_status_history',
        'application_notes',
        'applications',
        'saved_jobs',
        'job_skills',
        'jobs',
        'connections',
        'connection_requests',
        'profile_views',
        'member_education',
        'member_experience',
        'member_skills',
        'recruiters',
        'members',
      ];

      for (const table of mysqlTables) {
        await conn.execute(`TRUNCATE TABLE ${table}`);
      }

      // Turn FK checks back on — important for data integrity going forward
      await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('  ✓ MySQL tables cleared');

      // MongoDB collections
      await db.collection('threads').deleteMany({});
      await db.collection('messages').deleteMany({});
      await db.collection('event_logs').deleteMany({});
      await db.collection('ai_task_traces').deleteMany({});
      console.log('  ✓ MongoDB collections cleared');
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 1: DEMO ACCOUNTS
    //  These are the accounts you'll use to demo the project.
    //  They have known emails and passwords, and rich profile data.
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n👤 Creating demo member accounts...');

    // Each demo member has a fully-filled profile so it looks great in the UI
    const demoMembers = [
      {
        id: uuidv4(), email: 'alice@demo.com',
        first: 'Alice', last: 'Johnson',
        city: 'San Francisco', state: 'CA',
        headline: 'Senior Software Engineer | Python & React | Building scalable APIs',
        about: 'I am a software engineer with 6 years of experience building full-stack web applications. I specialize in Python backends and React frontends. Currently looking for my next exciting challenge in a high-growth startup or big tech company.',
        skills: ['Python','React','Node.js','MySQL','Docker','AWS','Redis','Kafka'],
      },
      {
        id: uuidv4(), email: 'bob@demo.com',
        first: 'Bob', last: 'Chen',
        city: 'Seattle', state: 'WA',
        headline: 'Data Engineer at Amazon | Kafka, Spark & Python enthusiast',
        about: 'Data engineer with 4 years of experience building real-time data pipelines at scale. Passionate about distributed systems and helping teams make data-driven decisions. Expert in Apache Kafka and Spark.',
        skills: ['Python','Kafka','Spark','SQL','AWS','Docker','Airflow','Scala'],
      },
      {
        id: uuidv4(), email: 'carol@demo.com',
        first: 'Carol', last: 'Patel',
        city: 'Austin', state: 'TX',
        headline: 'ML Engineer | TensorFlow & PyTorch | Open to opportunities',
        about: 'Machine learning engineer with a passion for NLP and computer vision. I have deployed production ML models serving 10M+ requests per day. Looking for roles where I can apply ML to solve real business problems.',
        skills: ['Python','Machine Learning','TensorFlow','PyTorch','SQL','Docker','Kubernetes','GCP'],
      },
      {
        id: uuidv4(), email: 'david@demo.com',
        first: 'David', last: 'Kim',
        city: 'New York', state: 'NY',
        headline: 'Full Stack Engineer | TypeScript, React & Node.js',
        about: 'Full stack developer who loves building beautiful, performant user interfaces backed by robust Node.js APIs. 5 years in fintech, deeply familiar with security and compliance requirements.',
        skills: ['TypeScript','React','Node.js','PostgreSQL','Redis','Docker','AWS','GraphQL'],
      },
      {
        id: uuidv4(), email: 'emma@demo.com',
        first: 'Emma', last: 'Rodriguez',
        city: 'San Jose', state: 'CA',
        headline: 'DevOps Engineer | Kubernetes, Terraform & CI/CD pipelines',
        about: 'DevOps engineer specializing in cloud infrastructure and developer productivity. I automate everything — from infrastructure provisioning with Terraform to zero-downtime deployments. Big believer in GitOps.',
        skills: ['Kubernetes','Docker','Terraform','AWS','GCP','Jenkins','CI/CD','Linux','Python'],
      },
    ];

    // Save the IDs so we can reference them later (for connections, applications, etc.)
    const demoMemberIds = [];

    for (const m of demoMembers) {
      try {
        // Insert the member row into MySQL
        await conn.execute(
          `INSERT INTO members
             (member_id, first_name, last_name, email, password_hash,
              city, state, country, headline, about)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [m.id, m.first, m.last, m.email, DEMO_HASH,
           m.city, m.state, 'USA', m.headline, m.about]
        );

        // Insert each skill into the member_skills table
        // (skills are stored separately because one member can have many skills)
        for (const skill of m.skills) {
          await conn.execute(
            'INSERT IGNORE INTO member_skills (member_id, skill) VALUES (?, ?)',
            [m.id, skill]
          );
        }

        demoMemberIds.push(m.id);
        console.log(`  ✓ ${m.first} ${m.last} — ${m.email}`);
      } catch (e) {
        // ER_DUP_ENTRY means this email already exists → skip it (safe to re-run)
        if (e.code === 'ER_DUP_ENTRY') {
          console.log(`  ⚠ Skipped ${m.email} (already exists)`);
          // Still fetch the ID so later steps work
          const [rows] = await conn.execute(
            'SELECT member_id FROM members WHERE email = ?', [m.email]
          );
          if (rows.length) demoMemberIds.push(rows[0].member_id);
        } else throw e;
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 2: DEMO RECRUITERS
    //  These recruiter accounts come with jobs attached, so the demo looks full.
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n🏢 Creating demo recruiter accounts...');

    const demoRecruiters = [
      {
        id: uuidv4(), email: 'recruiter1@google.com',
        first: 'Priya', last: 'Sharma',
        company: COMPANIES[0], // Google
      },
      {
        id: uuidv4(), email: 'recruiter1@meta.com',
        first: 'James', last: 'Wilson',
        company: COMPANIES[1], // Meta
      },
      {
        id: uuidv4(), email: 'recruiter1@amazon.com',
        first: 'Sarah', last: 'Lee',
        company: COMPANIES[2], // Amazon
      },
    ];

    const demoRecruiterIds = [];

    for (const r of demoRecruiters) {
      try {
        const company_id = uuidv4(); // every company gets a unique ID
        await conn.execute(
          `INSERT INTO recruiters
             (recruiter_id, company_id, first_name, last_name, email, password_hash,
              company_name, company_industry, company_size, role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [r.id, company_id, r.first, r.last, r.email, DEMO_HASH,
           r.company.name, r.company.industry, '5000+', 'recruiter']
        );
        demoRecruiterIds.push({ id: r.id, company_id, company: r.company });
        console.log(`  ✓ ${r.first} ${r.last} (${r.company.name}) — ID: ${r.id}`);
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          console.log(`  ⚠ ${r.email} already exists — updating password hash...`);
          const [rows] = await conn.execute(
            'SELECT recruiter_id, company_id FROM recruiters WHERE email = ?', [r.email]
          );
          if (rows.length) {
            // Always refresh the password_hash so it matches the current DEMO_HASH
            // This fixes accounts created before the password_hash column existed
            await conn.execute(
              'UPDATE recruiters SET password_hash = ? WHERE email = ?',
              [DEMO_HASH, r.email]
            );
            demoRecruiterIds.push({ id: rows[0].recruiter_id, company_id: rows[0].company_id, company: r.company });
          }
        } else throw e;
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 3: BULK MEMBERS
    //  200 extra realistic-looking member profiles to fill search results
    // ──────────────────────────────────────────────────────────────────────────
    console.log(`\n👥 Creating ${NUM_EXTRA_MEMBERS} additional members...`);

    const allMemberIds = [...demoMemberIds]; // start with demo members
    const allMemberEntries = demoMembers.map(m => ({ member_id: m.id, city: m.city, state: m.state, country: 'USA' }));

    for (let i = 0; i < NUM_EXTRA_MEMBERS; i++) {
      const first     = pick(FIRST_NAMES);
      const last      = pick(LAST_NAMES);
      const member_id = uuidv4();
      const email     = makeEmail(first, last, `_${i}`);
      const loc       = pick(CITIES);
      const role      = pick(JOB_TITLES);
      const skills    = pickN(SKILLS, randInt(4, 9));
      const headline  = makeHeadline(role, skills, loc);
      const yearsExp  = randInt(1, 12);

      try {
        await conn.execute(
          `INSERT INTO members
             (member_id, first_name, last_name, email, password_hash,
              city, state, country, headline, about, resume_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            member_id, first, last, email, DEMO_HASH,
            loc.city, loc.state, 'USA',
            headline,
            // "about" — a short professional summary
            `${yearsExp}-year ${role.toLowerCase()} specializing in ${skills.slice(0,3).join(', ')}. ` +
            `Based in ${loc.city}, ${loc.state}. Passionate about building robust, scalable systems.`,
            // "resume_text" — plain text resume stored for keyword search
            `${first} ${last} | ${email}\n` +
            `SKILLS: ${skills.join(', ')}\n` +
            `EXPERIENCE: ${role} at ${pick(COMPANIES).name} (${2024 - yearsExp}–present)\n` +
            `EDUCATION: B.S. Computer Science`,
          ]
        );

        // Add this member's skills to the junction table
        for (const skill of skills) {
          await conn.execute(
            'INSERT IGNORE INTO member_skills (member_id, skill) VALUES (?, ?)',
            [member_id, skill]
          );
        }

        allMemberIds.push(member_id);
        allMemberEntries.push({ member_id, city: loc.city, state: loc.state, country: 'USA' });
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }

      showProgress('Members', i + 1, NUM_EXTRA_MEMBERS);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 4: BULK RECRUITERS
    //  47 more recruiters spread across the 10 companies
    // ──────────────────────────────────────────────────────────────────────────
    console.log(`\n📋 Creating ${NUM_EXTRA_RECRUITERS} additional recruiters...`);

    const allRecruiterEntries = [...demoRecruiterIds];

    for (let i = 0; i < NUM_EXTRA_RECRUITERS; i++) {
      const first        = pick(FIRST_NAMES);
      const last         = pick(LAST_NAMES);
      const recruiter_id = uuidv4();
      const company_id   = uuidv4();
      const email        = makeEmail(first, last, `_rec${i}`);
      const company      = pick(COMPANIES);

      try {
        await conn.execute(
          `INSERT INTO recruiters
             (recruiter_id, company_id, first_name, last_name, email, password_hash,
              company_name, company_industry, company_size, role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recruiter_id, company_id, first, last, email, DEMO_HASH,
           company.name, company.industry,
           pick(['50-200','200-500','500-1000','5000+']), 'recruiter']
        );
        allRecruiterEntries.push({ id: recruiter_id, company_id, company });
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }

      showProgress('Recruiters', i + 1, NUM_EXTRA_RECRUITERS);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 5: JOB POSTINGS
    //  100 realistic job listings with proper descriptions, salaries, locations
    // ──────────────────────────────────────────────────────────────────────────
    console.log(`
💼 Creating ${NUM_JOBS} job postings...`);

    const jobIds = [];
    const jobEntries = [];
    const demoJobIds = [];

    // Salary ranges by seniority level (realistic 2024 US tech salaries)
    const SALARY_RANGES = {
      'Internship':      { min: 40000,  max: 80000   },
      'Entry level':     { min: 80000,  max: 120000  },
      'Associate':       { min: 100000, max: 150000  },
      'Mid-Senior level':{ min: 130000, max: 200000  },
      'Director':        { min: 200000, max: 320000  },
      'Executive':       { min: 280000, max: 450000  },
    };

    // These must exactly match the ENUM in the jobs table schema
    const SENIORITY_LEVELS = ['Internship', 'Entry level', 'Associate', 'Mid-Senior level', 'Director', 'Executive'];
    const EMPLOYMENT_TYPES = ['Full-time', 'Full-time', 'Full-time', 'Contract', 'Part-time', 'Internship'];

    // Guarantee a polished recruiter demo: each demo recruiter gets several visible jobs.
    const demoJobBlueprints = [
      { title: 'Senior Software Engineer', seniority: 'Mid-Senior level', employment: 'Full-time', mode: 'hybrid', city: 'Mountain View', state: 'CA', skills: ['JavaScript','React','Node.js','System Design'] },
      { title: 'Machine Learning Engineer', seniority: 'Mid-Senior level', employment: 'Full-time', mode: 'remote', city: 'Sunnyvale', state: 'CA', skills: ['Python','Machine Learning','TensorFlow','Kafka'] },
      { title: 'Software Engineer Intern', seniority: 'Internship', employment: 'Internship', mode: 'onsite', city: 'San Francisco', state: 'CA', skills: ['Python','JavaScript','Git','Docker'] },
      { title: 'Backend Engineer – Instagram', seniority: 'Associate', employment: 'Full-time', mode: 'hybrid', city: 'Menlo Park', state: 'CA', skills: ['Go','Kafka','MySQL','Redis'] },
      { title: 'Data Engineer – Analytics', seniority: 'Associate', employment: 'Full-time', mode: 'remote', city: 'Seattle', state: 'WA', skills: ['Python','Spark','ETL','SQL'] },
      { title: 'Frontend Engineer – React', seniority: 'Entry level', employment: 'Full-time', mode: 'hybrid', city: 'New York', state: 'NY', skills: ['React','TypeScript','Figma','REST APIs'] },
      { title: 'Cloud Solutions Architect', seniority: 'Director', employment: 'Full-time', mode: 'remote', city: 'Austin', state: 'TX', skills: ['AWS','Terraform','Kubernetes','System Design'] },
      { title: 'Software Engineer – Azure', seniority: 'Associate', employment: 'Full-time', mode: 'hybrid', city: 'Redmond', state: 'WA', skills: ['C#','Azure','Docker','Microservices'] },
      { title: 'DevOps Engineer', seniority: 'Mid-Senior level', employment: 'Contract', mode: 'remote', city: 'Boston', state: 'MA', skills: ['Docker','Kubernetes','Terraform','CI/CD'] },
    ];

    let seededJobCount = 0;
    for (let i = 0; i < demoRecruiterIds.length; i++) {
      const recruiterEntry = demoRecruiterIds[i];
      const blueprints = demoJobBlueprints.slice(i * 3, i * 3 + 3);
      for (const bp of blueprints) {
        const job_id = uuidv4();
        const salaryRange = SALARY_RANGES[bp.seniority];
        const skills = bp.skills;
        try {
          await conn.execute(
            `INSERT INTO jobs
               (job_id, company_id, recruiter_id, title, description,
                seniority_level, employment_type, city, state, country, work_mode,
                salary_min, salary_max, industry, status, views_count, saves_count)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              job_id,
              recruiterEntry.company_id,
              recruiterEntry.id,
              bp.title,
              makeJobDesc(bp.title, recruiterEntry.company.name, skills, bp.mode, bp.city),
              bp.seniority,
              bp.employment,
              bp.city,
              bp.state,
              'USA',
              bp.mode,
              salaryRange.min,
              salaryRange.max,
              recruiterEntry.company.industry,
              'open',
              randInt(80, 300),
              randInt(10, 40),
            ]
          );

          for (const skill of skills) {
            await conn.execute('INSERT IGNORE INTO job_skills (job_id, skill) VALUES (?, ?)', [job_id, skill]);
          }

          jobIds.push(job_id);
          demoJobIds.push(job_id);
          jobEntries.push({
            job_id,
            recruiter_id: recruiterEntry.id,
            company_id: recruiterEntry.company_id,
            company_name: recruiterEntry.company.name,
            industry: recruiterEntry.company.industry,
            city: bp.city,
            state: bp.state,
            country: 'USA',
            status: 'open',
            skills,
          });
          seededJobCount++;
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }
    }

    const remainingRandomJobs = Math.max(NUM_JOBS - seededJobCount, 0);
    for (let i = 0; i < remainingRandomJobs; i++) {
      const job_id      = uuidv4();
      const recruiterEntry = pick(allRecruiterEntries);
      const title       = pick(JOB_TITLES);
      const skills      = pickN(SKILLS, randInt(3, 7));
      const loc         = pick(CITIES);
      const workMode    = pick(WORK_MODES);
      const seniority   = pick(SENIORITY_LEVELS);
      const salaryRange = SALARY_RANGES[seniority];
      const salaryMin   = randInt(salaryRange.min / 1000, salaryRange.max / 1000) * 1000;
      const salaryMax   = salaryMin + randInt(15, 50) * 1000;
      const status      = Math.random() < 0.80 ? 'open' : 'closed';
      const employmentType = seniority === 'Internship' ? 'Internship' : pick(EMPLOYMENT_TYPES);

      try {
        await conn.execute(
          `INSERT INTO jobs
             (job_id, company_id, recruiter_id, title, description,
              seniority_level, employment_type, city, state, country, work_mode,
              salary_min, salary_max, industry, status, views_count, saves_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            job_id,
            recruiterEntry.company_id,
            recruiterEntry.id,
            title,
            makeJobDesc(title, recruiterEntry.company.name, skills, workMode, loc.city),
            seniority,
            employmentType,
            loc.city,
            loc.state,
            'USA',
            workMode,
            salaryMin,
            salaryMax,
            recruiterEntry.company.industry,
            status,
            randInt(20, 800),
            randInt(0,  40),
          ]
        );

        for (const skill of skills) {
          await conn.execute('INSERT IGNORE INTO job_skills (job_id, skill) VALUES (?, ?)', [job_id, skill]);
        }

        jobIds.push(job_id);
        jobEntries.push({
          job_id,
          recruiter_id: recruiterEntry.id,
          company_id: recruiterEntry.company_id,
          company_name: recruiterEntry.company.name,
          industry: recruiterEntry.company.industry,
          city: loc.city,
          state: loc.state,
          country: 'USA',
          status,
          skills,
        });
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }

      showProgress('Jobs', seededJobCount + i + 1, NUM_JOBS);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 6: JOB APPLICATIONS
    //  Each member applies to ~2 jobs. We spread statuses realistically:
    //  most are "submitted" or "reviewing", fewer make it to "offer"
    // ──────────────────────────────────────────────────────────────────────────
    const totalExpectedApps = allMemberIds.length * APPS_PER_MEMBER;
    console.log(`
📨 Creating ~${totalExpectedApps} applications...`);

    let appCount = 0;

    // Weighted statuses: real hiring funnels reject most applicants early
    // submitted=35%, reviewing=30%, interview=20%, offer=5%, rejected=10%
    const WEIGHTED_STATUSES = [
      ...Array(35).fill('submitted'),
      ...Array(30).fill('reviewing'),
      ...Array(20).fill('interview'),
      ...Array(5).fill('offer'),
      ...Array(10).fill('rejected'),
    ];

    const openJobIds = jobEntries.filter(j => j.status === 'open').map(j => j.job_id);

    // Deterministic demo applications so recruiter dashboards and talent pipeline are populated.
    const seededApplications = [
      [demoMemberIds[0], demoJobIds[0], 'reviewing'],
      [demoMemberIds[1], demoJobIds[0], 'interview'],
      [demoMemberIds[2], demoJobIds[1], 'submitted'],
      [demoMemberIds[3], demoJobIds[1], 'offer'],
      [demoMemberIds[4], demoJobIds[2], 'submitted'],
      [demoMemberIds[0], demoJobIds[3], 'reviewing'],
      [demoMemberIds[1], demoJobIds[4], 'submitted'],
      [demoMemberIds[2], demoJobIds[5], 'rejected'],
      [demoMemberIds[3], demoJobIds[6], 'interview'],
      [demoMemberIds[4], demoJobIds[7], 'submitted'],
    ];

    for (const [member_id, job_id, status] of seededApplications) {
      if (!member_id || !job_id) continue;
      try {
        await conn.execute(
          `INSERT INTO applications
             (application_id, job_id, member_id, cover_letter, status, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            job_id,
            member_id,
            'Seeded demo application for the end-to-end walkthrough.',
            status,
            uuidv4(),
          ]
        );

        await conn.execute('UPDATE jobs SET applicants_count = applicants_count + 1 WHERE job_id = ?', [job_id]);
        appCount++;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    const benchmarkDataDir = path.join(__dirname, '..', 'infrastructure', 'benchmarks', 'data');
    fs.mkdirSync(benchmarkDataDir, { recursive: true });
    const benchmarkCsvPath = path.join(benchmarkDataDir, 'application_pairs.csv');
    const benchmarkPairCount = 5000;
    const benchmarkPairs = ['member_id,job_id'];
    const seenPairs = new Set();
    while (benchmarkPairs.length - 1 < benchmarkPairCount) {
      const memberId = pick(allMemberIds);
      const jobId = pick(openJobIds);
      const key = `${memberId},${jobId}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      benchmarkPairs.push(key);
    }
    fs.writeFileSync(benchmarkCsvPath, benchmarkPairs.join('\n') + '\n', 'utf8');

    for (let i = 0; i < allMemberIds.length; i++) {
      const member_id  = allMemberIds[i];
      const targetJobs = pickN(openJobIds, APPS_PER_MEMBER);

      for (const job_id of targetJobs) {
        try {
          await conn.execute(
            `INSERT INTO applications
               (application_id, job_id, member_id, cover_letter, status, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(), job_id, member_id,
              // A short, realistic cover letter
              `I am excited to apply for this position. I bring relevant experience ` +
              `and am confident I can make a meaningful contribution to your team. ` +
              `I look forward to discussing how my background aligns with your needs.`,
              pick(WEIGHTED_STATUSES),
              uuidv4(), // idempotency_key prevents duplicate submissions
            ]
          );

          // Keep the job's applicant count accurate
          await conn.execute(
            'UPDATE jobs SET applicants_count = applicants_count + 1 WHERE job_id = ?',
            [job_id]
          );

          appCount++;
        } catch (e) {
          // ER_DUP_ENTRY here means the same member already applied to this job → skip
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }

      showProgress('Applications', i + 1, allMemberIds.length);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 7: CONNECTIONS
    //  Connect demo members to each other and to some random members.
    //  Two tables are involved:
    //    connection_requests → stores the request (pending/accepted/rejected)
    //    connections         → stores accepted connections (bidirectional)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n🤝 Creating connections between members...');

    // First, connect all 5 demo members to each other (so they appear connected)
    let connCount = 0;
    for (let a = 0; a < demoMemberIds.length; a++) {
      for (let b = a + 1; b < demoMemberIds.length; b++) {
        const request_id = uuidv4();
        try {
          // Log the request
          await conn.execute(
            `INSERT INTO connection_requests
               (request_id, requester_id, receiver_id, status, idempotency_key)
             VALUES (?, ?, ?, 'accepted', ?)`,
            [request_id, demoMemberIds[a], demoMemberIds[b], uuidv4()]
          );
          // Record the accepted connection once, with the pair sorted.
          const [memberA, memberB] = [demoMemberIds[a], demoMemberIds[b]].sort();
          await conn.execute(
            `INSERT IGNORE INTO connections (member_a, member_b) VALUES (?, ?)`,
            [memberA, memberB]
          );
          connCount++;
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }
    }

    // Also give each demo member ~10 connections to random members
    for (const demoId of demoMemberIds) {
      const randomMembers = pickN(allMemberIds.filter(id => id !== demoId), 10);
      for (const otherId of randomMembers) {
        try {
          await conn.execute(
            `INSERT INTO connection_requests
               (request_id, requester_id, receiver_id, status, idempotency_key)
             VALUES (?, ?, ?, 'accepted', ?)`,
            [uuidv4(), demoId, otherId, uuidv4()]
          );
          const [memberA, memberB] = [demoId, otherId].sort();
          await conn.execute(
            'INSERT IGNORE INTO connections (member_a, member_b) VALUES (?, ?)', [memberA, memberB]
          );
          connCount++;
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
        }
      }
    }

    await conn.execute(`
      UPDATE members m
      SET connections_count = (
        SELECT COUNT(*)
        FROM connections c
        WHERE c.member_a = m.member_id OR c.member_b = m.member_id
      )
    `);
    console.log(`  ✓ ${connCount} connections created`);

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 8: MESSAGES (MongoDB)
    //  Create realistic chat threads between demo members and recruiters.
    //  MongoDB stores messages — it's better for flexible, schema-less documents.
    //
    //  Structure:
    //    threads  → one document per conversation (who is in it, last message)
    //    messages → one document per individual message
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n💬 Seeding messages in MongoDB...');

    const threadsCol  = db.collection('threads');
    const messagesCol = db.collection('messages');

    let msgCount = 0;

    // Create a conversation between each demo member and each demo recruiter
    for (const memberId of demoMemberIds) {
      for (const recruiter of demoRecruiterIds) {
        const thread_id = uuidv4();
        const participants = [memberId, recruiter.id];

        // Pick a random job title for this conversation topic
        const role  = pick(JOB_TITLES);
        const skill = pick(SKILLS);

        // Generate 4–8 back-and-forth messages for this conversation
        const numMessages = randInt(4, 8);
        const threadMessages = [];

        for (let i = 0; i < numMessages; i++) {
          // Alternate sender: even index = member writes, odd = recruiter writes
          const sender_id  = i % 2 === 0 ? memberId : recruiter.id;
          const text = CHAT_MESSAGES[i % CHAT_MESSAGES.length]
            .replace('{role}',  role)
            .replace('{skill}', skill);

          const msgDoc = {
            message_id:      uuidv4(),   // required unique field in the schema
            thread_id,
            sender_id,
            message_text:    text,       // schema field is message_text, not text
            // Space messages a few hours apart to look like a real conversation
            sent_at:         new Date(Date.now() - (numMessages - i) * 3 * 3600 * 1000),
            idempotency_key: uuidv4(),
            read:            i < numMessages - 1, // last message is "unread"
          };
          threadMessages.push(msgDoc);
          msgCount++;
        }

        // Save the thread document — thread_id is a required unique field (separate from _id)
        await threadsCol.insertOne({
          thread_id,                // required unique field in the schema
          participant_ids:  participants,
          last_message:     threadMessages[threadMessages.length - 1].message_text,
          updated_at:       new Date(),
          created_at:       new Date(),
        });

        // Save all messages for this thread
        await messagesCol.insertMany(threadMessages);
      }
    }

    console.log(`  ✓ ${msgCount} messages across ${demoMemberIds.length * demoRecruiterIds.length} threads`);

    // ──────────────────────────────────────────────────────────────────────────
    //  STEP 9: ANALYTICS EVENTS (MongoDB)
    //  These events power the charts in the Analytics and Recruiter dashboards.
    //  Events are things like "someone viewed a job" or "someone applied".
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n📊 Seeding analytics events in MongoDB...');

    const eventLogsCol = db.collection('event_logs');

    const EVENT_TYPES = [
      ...Array(35).fill('job.viewed'),
      ...Array(18).fill('job.saved'),
      ...Array(22).fill('application.submitted'),
      ...Array(10).fill('application.status.changed'),
      ...Array(10).fill('profile.viewed'),
      ...Array(3).fill('connection.requested'),
      ...Array(1).fill('ai.requests'),
      ...Array(1).fill('ai.results'),
    ];

    const NUM_EVENTS = 10000;
    const eventsToInsert = [];

    // Deterministic demo analytics so dashboards look coherent during the walkthrough.
    for (let i = 0; i < demoMemberIds.length; i++) {
      const member_id = demoMemberIds[i];
      const viewer_id = demoMemberIds[(i + 1) % demoMemberIds.length];
      for (let d = 0; d < 6; d++) {
        eventsToInsert.push({
          trace_id: uuidv4(),
          timestamp: new Date(Date.now() - d * 86400000),
          idempotency_key: uuidv4(),
          _topic: 'profile.viewed',
          event_type: 'profile.viewed',
          actor_id: viewer_id,
          entity: { entity_type: 'member', entity_id: member_id },
          payload: { viewer_id },
        });
      }
    }

    seededApplications.forEach(([member_id, job_id, status], idx) => {
      const jobEntry = jobEntries.find(j => j.job_id === job_id);
      const memberEntry = allMemberEntries.find(m => m.member_id === member_id) || { city: 'Unknown', state: 'NA', country: 'USA' };
      if (!jobEntry) return;
      eventsToInsert.push({
        trace_id: uuidv4(),
        timestamp: new Date(Date.now() - (idx + 1) * 43200000),
        idempotency_key: uuidv4(),
        _topic: 'application.submitted',
        event_type: 'application.submitted',
        actor_id: member_id,
        entity: { entity_type: 'application', entity_id: uuidv4() },
        payload: {
          application_id: uuidv4(),
          job_id,
          member_id,
          recruiter_id: jobEntry.recruiter_id,
          city: memberEntry.city,
          state: memberEntry.state,
          country: memberEntry.country,
          location: `${memberEntry.city}, ${memberEntry.state}, ${memberEntry.country}`,
          status: 'submitted',
        },
      });
      if (status !== 'submitted') {
        eventsToInsert.push({
          trace_id: uuidv4(),
          timestamp: new Date(Date.now() - idx * 21600000),
          idempotency_key: uuidv4(),
          _topic: 'application.status.changed',
          event_type: 'application.status.changed',
          actor_id: jobEntry.recruiter_id,
          entity: { entity_type: 'application', entity_id: uuidv4() },
          payload: {
            application_id: uuidv4(),
            job_id,
            member_id,
            recruiter_id: jobEntry.recruiter_id,
            old_status: 'submitted',
            new_status: status,
          },
        });
      }
    });


    for (let i = 0; i < NUM_EVENTS; i++) {
      const daysAgo = randInt(0, 30);
      const hoursAgo = randInt(0, 23);
      const ts = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000);

      const eventType = pick(EVENT_TYPES);
      const memberEntry = pick(allMemberEntries);
      const otherMember = pick(allMemberEntries.filter(m => m.member_id !== memberEntry.member_id));
      const jobEntry = pick(jobEntries.length ? jobEntries : [{
        job_id: uuidv4(), recruiter_id: uuidv4(), company_id: uuidv4(), company_name: 'DemoCo', industry: 'Technology', city: 'San Jose', state: 'CA', country: 'USA', skills: pickN(SKILLS, 4)
      }]);

      const base = {
        trace_id: uuidv4(),
        timestamp: ts,
        idempotency_key: uuidv4(),
        _topic: eventType,
      };

      if (eventType === 'job.viewed') {
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          actor_id: memberEntry.member_id,
          entity: { entity_type: 'job', entity_id: jobEntry.job_id },
          payload: { job_id: jobEntry.job_id, recruiter_id: jobEntry.recruiter_id, source: pick(['web', 'mobile']) },
        });
      } else if (eventType === 'job.saved') {
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          actor_id: memberEntry.member_id,
          entity: { entity_type: 'job', entity_id: jobEntry.job_id },
          payload: { job_id: jobEntry.job_id, recruiter_id: jobEntry.recruiter_id, source: pick(['web', 'mobile']) },
        });
      } else if (eventType === 'application.submitted') {
        const applicationId = uuidv4();
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          actor_id: memberEntry.member_id,
          entity: { entity_type: 'application', entity_id: applicationId },
          payload: {
            application_id: applicationId,
            job_id: jobEntry.job_id,
            member_id: memberEntry.member_id,
            recruiter_id: jobEntry.recruiter_id,
            city: memberEntry.city,
            state: memberEntry.state,
            country: memberEntry.country,
            location: `${memberEntry.city}, ${memberEntry.state}, ${memberEntry.country}`,
            status: 'submitted',
          },
        });
      } else if (eventType === 'application.status.changed') {
        const applicationId = uuidv4();
        const newStatus = pick(['reviewing', 'interview', 'offer', 'rejected']);
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          actor_id: jobEntry.recruiter_id,
          entity: { entity_type: 'application', entity_id: applicationId },
          payload: {
            application_id: applicationId,
            job_id: jobEntry.job_id,
            member_id: memberEntry.member_id,
            recruiter_id: jobEntry.recruiter_id,
            old_status: pick(['submitted', 'reviewing', 'interview']),
            new_status: newStatus,
          },
        });
      } else if (eventType === 'profile.viewed') {
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          actor_id: otherMember.member_id,
          entity: { entity_type: 'member', entity_id: memberEntry.member_id },
          payload: { viewer_id: otherMember.member_id },
        });
      } else if (eventType === 'connection.requested') {
        const requestId = uuidv4();
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          actor_id: memberEntry.member_id,
          entity: { entity_type: 'connection', entity_id: requestId },
          payload: { requester_id: memberEntry.member_id, receiver_id: otherMember.member_id },
        });
      } else if (eventType === 'ai.requests') {
        const traceId = uuidv4();
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          trace_id: traceId,
          actor_id: jobEntry.recruiter_id,
          entity: { entity_type: 'ai_task', entity_id: traceId },
          payload: { job_id: jobEntry.job_id, recruiter_id: jobEntry.recruiter_id, top_k: 5 },
        });
      } else if (eventType === 'ai.results') {
        const traceId = uuidv4();
        const approvalAction = pick(['approve', 'edit', 'reject']);
        const shortlist = pickN(allMemberEntries, randInt(1, 3)).map(candidate => ({
          member_id: candidate.member_id,
          match_score: Number((Math.random() * 0.4 + 0.5).toFixed(3)),
          skills_overlap: pickN(jobEntry.skills || SKILLS, Math.min(3, (jobEntry.skills || SKILLS).length)),
          explanation: 'Synthetic shortlist generated from seeded analytics data.',
        }));
        eventsToInsert.push({
          ...base,
          event_type: eventType,
          trace_id: traceId,
          actor_id: jobEntry.recruiter_id,
          entity: { entity_type: 'ai_task', entity_id: traceId },
          payload: {
            job_id: jobEntry.job_id,
            recruiter_id: jobEntry.recruiter_id,
            status: approvalAction === 'reject' ? 'rejected' : 'approved',
            approval_action: approvalAction,
            shortlist_count: shortlist.length,
            shortlist,
          },
        });
      }
    }

    // Insert in batches of 500 (faster than one at a time)
    const BATCH_SIZE = 500;
    for (let i = 0; i < eventsToInsert.length; i += BATCH_SIZE) {
      const batch = eventsToInsert.slice(i, i + BATCH_SIZE);
      await eventLogsCol.insertMany(batch, { ordered: false });
      showProgress('Events', Math.min(i + BATCH_SIZE, eventsToInsert.length), eventsToInsert.length);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  DONE! Print a summary of everything that was created.
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n');
    console.log('═'.repeat(55));
    console.log('✅  Seed complete! Here\'s what was created:\n');
    console.log(`  👤 Demo members:      ${demoMemberIds.length}`);
    console.log(`  👥 Total members:     ${allMemberIds.length}`);
    console.log(`  🏢 Demo recruiters:   ${demoRecruiterIds.length}`);
    console.log(`  📋 Total recruiters:  ${allRecruiterEntries.length}`);
    console.log(`  💼 Job postings:      ${jobIds.length}`);
    console.log(`  📨 Applications:      ~${appCount}`);
    console.log(`  🤝 Connections:       ${connCount}`);
    console.log(`  💬 Messages:          ${msgCount}`);
    console.log(`  📊 Analytics events:  ${NUM_EVENTS}`);
    console.log('  📁 Benchmark CSV:     infrastructure/benchmarks/data/application_pairs.csv');
    console.log('\n' + '─'.repeat(55));
    console.log('🔑  Demo Login Credentials (all use password: Demo@1234)\n');
    console.log('  MEMBER ACCOUNTS (job seeker view):');
    console.log('    alice@demo.com    → Senior Software Engineer');
    console.log('    bob@demo.com      → Data Engineer');
    console.log('    carol@demo.com    → ML Engineer');
    console.log('    david@demo.com    → Full Stack Engineer');
    console.log('    emma@demo.com     → DevOps Engineer');
    console.log('\n  RECRUITER ACCOUNTS (email + Demo@1234):');
    console.log('    recruiter1@google.com  → Google');
    console.log('    recruiter1@meta.com    → Meta');
    console.log('    recruiter1@amazon.com  → Amazon');
    console.log('─'.repeat(55));
    console.log('\n💡 Tip: To see a member\'s email in MySQL, run:');
    console.log('   SELECT email, first_name, last_name FROM members LIMIT 10;\n');

  } finally {
    // Always release the database connections, even if something went wrong
    conn.release();
    await pool.end();
    await mongoClient.close();
  }
}

// ── Run it ────────────────────────────────────────────────────────────────────
// This calls our main function and handles any errors nicely
seed().catch(err => {
  console.error('\n❌  Seed failed!\n');
  console.error('Error:', err.message);
  console.error('\n🔧 Troubleshooting checklist:');
  console.error('  1. Is Docker running?     → docker-compose up -d');
  console.error('  2. Wait ~15 seconds for MySQL to finish starting up');
  console.error('  3. Check ports:');
  console.error('     MySQL   should be on localhost:3307');
  console.error('     MongoDB should be on localhost:27018');
  console.error('  4. Run:  npm install  (in the project root)');
  console.error('  5. Full error details below:\n');
  console.error(err);
  process.exit(1);
});
