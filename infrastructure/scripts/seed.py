"""
Seeder Script — LinkedIn DS Project
Inserts a small, clean dataset for demo:
  - 3 recruiters (Google, Meta, Microsoft)
  - 10 members
  - 10 jobs (diverse titles/locations)
  - 12 applications
  - 6 connections
  - 3 message threads

Usage:
  source projectDS/bin/activate
  python infrastructure/scripts/seed.py
"""

import uuid
import sys
import subprocess

# ── Auto-install dependencies ─────────────────────────────────────────────────
subprocess.run([sys.executable, "-m", "pip", "install", "-q",
                "mysql-connector-python", "pymongo", "bcrypt"], check=True)

import mysql.connector
import bcrypt
from pymongo import MongoClient
from datetime import datetime, timedelta
import random

# All seeded members use this password (change per member below)
DEFAULT_PASSWORD = "Test@1234"

# ── Config ────────────────────────────────────────────────────────────────────
MYSQL_CONFIG = {
    "host":     "127.0.0.1",
    "port":     3307,
    "user":     "appuser",
    "password": "apppassword",
    "database": "linkedin_ds",
}
MONGO_URI = "mongodb://appuser:apppassword@127.0.0.1:27017/linkedin_ds_logs?authSource=admin"

# ── Fixed seed data ────────────────────────────────────────────────────────────

RECRUITERS = [
    # (first, last, email, company_name, industry, size)
    ("Sarah",   "Chen",    "sarah.chen@google.com",     "Google",    "Technology",  "10001+"),
    ("James",   "Patel",   "james.patel@meta.com",      "Meta",      "Technology",  "10001+"),
    ("Maria",   "Lopez",   "maria.lopez@microsoft.com", "Microsoft", "Technology",  "10001+"),
]

MEMBERS = [
    # (first, last, email, city, state, headline)
    ("Alice",   "Johnson",  "alice.johnson@gmail.com",   "San Francisco", "CA", "Software Engineer | Python & React"),
    ("Bob",     "Smith",    "bob.smith@gmail.com",       "Seattle",       "WA", "Data Scientist | ML & NLP"),
    ("Carol",   "Williams", "carol.w@gmail.com",         "New York",      "NY", "Full Stack Engineer | Node & Vue"),
    ("David",   "Brown",    "david.b@gmail.com",         "Austin",        "TX", "DevOps Engineer | Kubernetes & AWS"),
    ("Emma",    "Davis",    "emma.davis@gmail.com",      "Boston",        "MA", "Frontend Engineer | React & TypeScript"),
    ("Frank",   "Miller",   "frank.m@gmail.com",         "Chicago",       "IL", "Backend Engineer | Java & Spring"),
    ("Grace",   "Wilson",   "grace.w@gmail.com",         "San Jose",      "CA", "ML Engineer | TensorFlow & PyTorch"),
    ("Henry",   "Moore",    "henry.m@gmail.com",         "Denver",        "CO", "Cloud Architect | AWS & Terraform"),
    ("Isabella","Taylor",   "isabella.t@gmail.com",      "Los Angeles",   "CA", "Product Manager | Agile & Scrum"),
    ("Jack",    "Anderson", "jack.a@gmail.com",          "Portland",      "OR", "Site Reliability Engineer | Linux & Go"),
]

# Job titles paired with which recruiter posts them (index 0=Google, 1=Meta, 2=Microsoft)
JOBS = [
    # (recruiter_idx, title, description, seniority, emp_type, city, state, mode, salary_min, salary_max, industry, skills)
    (0, "Senior Software Engineer",
     "Build and scale distributed systems that serve billions of users. Work on Search, Ads, or Cloud infra.",
     "Mid-Senior level", "Full-time", "Mountain View", "CA", "hybrid",
     160000, 220000, "Technology", ["Python", "Go", "Distributed Systems", "Kafka"]),

    (0, "Machine Learning Engineer",
     "Develop ML models for ranking, recommendation, and natural language understanding at Google scale.",
     "Mid-Senior level", "Full-time", "San Francisco", "CA", "onsite",
     170000, 230000, "Technology", ["Python", "TensorFlow", "Machine Learning", "NLP"]),

    (0, "Site Reliability Engineer",
     "Own the reliability of Google's production systems. Drive SLO definition, incident response, and automation.",
     "Associate", "Full-time", "Seattle", "WA", "hybrid",
     140000, 190000, "Technology", ["Go", "Linux", "Kubernetes", "Docker"]),

    (1, "Backend Engineer – Instagram",
     "Design APIs and backend services powering Instagram Stories, Reels, and DMs for 2 billion users.",
     "Mid-Senior level", "Full-time", "Menlo Park", "CA", "onsite",
     155000, 210000, "Technology", ["Python", "Django", "MySQL", "Redis"]),

    (1, "Data Engineer – Analytics",
     "Build real-time and batch data pipelines to power Meta's business analytics and ads measurement.",
     "Associate", "Full-time", "New York", "NY", "remote",
     130000, 175000, "Technology", ["Spark", "Kafka", "Python", "Data Engineering"]),

    (1, "Frontend Engineer – React",
     "Build the next generation of Meta's consumer products with React, TypeScript, and GraphQL.",
     "Entry level", "Full-time", "Seattle", "WA", "hybrid",
     120000, 160000, "Technology", ["React", "TypeScript", "GraphQL", "JavaScript"]),

    (2, "Cloud Solutions Architect",
     "Help enterprise customers design and migrate workloads to Microsoft Azure.",
     "Director", "Full-time", "Redmond", "WA", "hybrid",
     180000, 250000, "Technology", ["Azure", "Kubernetes", "Terraform", "Microservices"]),

    (2, "Software Engineer – Azure",
     "Work on Azure Storage, Networking, or Compute. Ship features used by millions of developers worldwide.",
     "Associate", "Full-time", "San Francisco", "CA", "onsite",
     140000, 195000, "Technology", ["C#", "Go", "Distributed Systems", "REST"]),

    (2, "DevOps Engineer",
     "Build CI/CD pipelines, infrastructure-as-code, and developer productivity tooling for Azure teams.",
     "Mid-Senior level", "Full-time", "Austin", "TX", "remote",
     130000, 180000, "Technology", ["Docker", "Kubernetes", "CI/CD", "Terraform", "Azure"]),

    (2, "Product Manager – AI",
     "Drive product strategy for Microsoft Copilot AI features across Office 365 and Teams.",
     "Director", "Full-time", "Chicago", "IL", "hybrid",
     160000, 220000, "Technology", ["Machine Learning", "Microservices", "REST"]),
]


def seed_mysql():
    conn   = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor()

    print("\n📦 Seeding MySQL...")

    # ── Recruiters ──────────────────────────────────────────────────────────────
    print("  → Inserting 3 recruiters...")
    recruiter_ids = []
    company_ids   = []
    for first, last, email, company_name, industry, size in RECRUITERS:
        rid = str(uuid.uuid4())
        cid = str(uuid.uuid4())
        recruiter_ids.append(rid)
        company_ids.append(cid)
        cursor.execute("""
            INSERT IGNORE INTO recruiters
              (recruiter_id, company_id, first_name, last_name, email,
               company_name, company_industry, company_size, role)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (rid, cid, first, last, email, company_name, industry, size, "recruiter"))
    conn.commit()
    print(f"    ✅ 3 recruiters inserted")

    # ── Members ─────────────────────────────────────────────────────────────────
    print("  → Inserting 10 members...")
    member_ids = []
    pwd_hash = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()
    for first, last, email, city, state, headline in MEMBERS:
        mid = str(uuid.uuid4())
        member_ids.append(mid)
        cursor.execute("""
            INSERT IGNORE INTO members
              (member_id, first_name, last_name, email, password_hash, city, state, country, headline, connections_count)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (mid, first, last, email, pwd_hash, city, state, "USA", headline, 0))
    conn.commit()
    print(f"    ✅ 10 members inserted")

    # ── Member skills ────────────────────────────────────────────────────────────
    member_skills_map = [
        ["Python", "React", "Node.js", "JavaScript"],
        ["Python", "Machine Learning", "NLP", "Spark"],
        ["JavaScript", "Vue", "Node.js", "MySQL"],
        ["Docker", "Kubernetes", "AWS", "Terraform"],
        ["React", "TypeScript", "JavaScript", "GraphQL"],
        ["Java", "Spring", "MySQL", "REST"],
        ["Python", "TensorFlow", "Machine Learning", "Deep Learning"],
        ["AWS", "Azure", "Terraform", "Kubernetes"],
        ["Microservices", "REST", "Agile", "CI/CD"],
        ["Go", "Linux", "Docker", "Kubernetes"],
    ]
    for mid, skills in zip(member_ids, member_skills_map):
        for skill in skills:
            cursor.execute(
                "INSERT IGNORE INTO member_skills (member_id, skill) VALUES (%s,%s)",
                (mid, skill))
    conn.commit()
    print(f"    ✅ Member skills inserted")

    # ── Jobs ─────────────────────────────────────────────────────────────────────
    print("  → Inserting 10 jobs...")
    job_ids = []
    for (ridx, title, desc, seniority, emp_type, city, state, mode,
         sal_min, sal_max, industry, skills) in JOBS:
        jid = str(uuid.uuid4())
        job_ids.append(jid)
        rid = recruiter_ids[ridx]
        cid = company_ids[ridx]
        posted = datetime.now() - timedelta(days=random.randint(1, 30))
        cursor.execute("""
            INSERT IGNORE INTO jobs
              (job_id, company_id, recruiter_id, title, description,
               seniority_level, employment_type, city, state, country,
               work_mode, salary_min, salary_max, industry, status,
               views_count, applicants_count, saves_count, posted_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (jid, cid, rid, title, desc, seniority, emp_type,
              city, state, "USA", mode, sal_min, sal_max, industry,
              "open", random.randint(50, 800), random.randint(10, 150),
              random.randint(5, 60), posted))
        for skill in skills:
            cursor.execute(
                "INSERT IGNORE INTO job_skills (job_id, skill) VALUES (%s,%s)",
                (jid, skill))
    conn.commit()
    print(f"    ✅ 10 jobs inserted")

    # ── Applications ─────────────────────────────────────────────────────────────
    print("  → Inserting 12 applications...")
    apps = [
        (0, 0, "submitted"),   # Alice → Google SWE
        (0, 1, "reviewing"),   # Alice → Google ML
        (1, 3, "interview"),   # Bob   → Meta Backend
        (1, 4, "submitted"),   # Bob   → Meta Data Eng
        (2, 5, "offer"),       # Carol → Meta Frontend
        (3, 8, "submitted"),   # David → Microsoft DevOps
        (4, 5, "reviewing"),   # Emma  → Meta Frontend
        (4, 0, "submitted"),   # Emma  → Google SWE
        (5, 7, "interview"),   # Frank → Microsoft Azure
        (6, 1, "submitted"),   # Grace → Google ML
        (7, 6, "reviewing"),   # Henry → Microsoft Cloud Arch
        (9, 2, "submitted"),   # Jack  → Google SRE
    ]
    for m_idx, j_idx, status in apps:
        cursor.execute("""
            INSERT IGNORE INTO applications
              (application_id, job_id, member_id, status, idempotency_key, applied_at)
            VALUES (%s,%s,%s,%s,%s,%s)
        """, (str(uuid.uuid4()), job_ids[j_idx], member_ids[m_idx],
              status, str(uuid.uuid4()),
              datetime.now() - timedelta(days=random.randint(1, 14))))
    conn.commit()
    print(f"    ✅ 12 applications inserted")

    # ── Connections ──────────────────────────────────────────────────────────────
    print("  → Inserting 6 connections...")
    pairs = [(0,1),(1,2),(2,3),(3,4),(4,5),(0,6)]
    for a_idx, b_idx in pairs:
        a, b = sorted([member_ids[a_idx], member_ids[b_idx]])
        cursor.execute(
            "INSERT IGNORE INTO connections (member_a, member_b) VALUES (%s,%s)",
            (a, b))
    conn.commit()
    print(f"    ✅ 6 connections inserted")

    cursor.close()
    conn.close()
    print("\n✅ MySQL seeding complete!")
    return member_ids, job_ids, recruiter_ids


def seed_mongodb(member_ids, job_ids):
    client = MongoClient(MONGO_URI)
    db     = client["linkedin_ds_logs"]

    print("\n📦 Seeding MongoDB...")

    # ── 3 message threads ────────────────────────────────────────────────────────
    threads  = []
    messages = []
    convos = [
        (0, 1, ["Hi Alice! Saw your profile — impressive React work.",
                "Thanks Bob! Happy to connect."]),
        (2, 3, ["Hey David, need help with Kubernetes setup?",
                "Sure Carol! Let's hop on a call tomorrow."]),
        (4, 5, ["Emma, great frontend skills. Working on anything exciting?",
                "Thanks Frank! Building a dashboard in React + TypeScript right now."]),
    ]
    for p1_idx, p2_idx, msgs in convos:
        tid = str(uuid.uuid4())
        p1, p2 = member_ids[p1_idx], member_ids[p2_idx]
        threads.append({
            "thread_id":       tid,
            "participant_ids": [p1, p2],
            "last_message":    msgs[-1],
            "updated_at":      datetime.now() - timedelta(days=1),
            "created_at":      datetime.now() - timedelta(days=3),
        })
        senders = [p1, p2]
        for i, text in enumerate(msgs):
            messages.append({
                "message_id":      str(uuid.uuid4()),
                "thread_id":       tid,
                "sender_id":       senders[i % 2],
                "message_text":    text,
                "idempotency_key": str(uuid.uuid4()),
                "sent_at":         datetime.now() - timedelta(hours=10 - i),
            })

    db.threads.insert_many(threads)
    db.messages.insert_many(messages)
    print(f"    ✅ 3 threads, {len(messages)} messages inserted")

    # ── Analytics events ─────────────────────────────────────────────────────────
    event_types = ["job.viewed","job.saved","application.submitted","profile.updated"]
    events = []
    for job_id in job_ids:
        for _ in range(5):
            m_id = random.choice(member_ids)
            events.append({
                "event_type":      random.choice(event_types),
                "trace_id":        str(uuid.uuid4()),
                "timestamp":       datetime.now() - timedelta(days=random.randint(0, 7)),
                "actor_id":        m_id,
                "entity":          {"entity_type": "job", "entity_id": job_id},
                "payload":         {"source": "search"},
                "idempotency_key": str(uuid.uuid4()),
            })
    db.event_logs.insert_many(events)
    print(f"    ✅ {len(events)} analytics events inserted")

    client.close()
    print("\n✅ MongoDB seeding complete!")


if __name__ == "__main__":
    print("=" * 55)
    print("  LinkedIn DS — Database Seeder  (demo dataset)")
    print("  3 recruiters · 10 members · 10 jobs")
    print("=" * 55)

    try:
        member_ids, job_ids, recruiter_ids = seed_mysql()
        seed_mongodb(member_ids, job_ids)
        print("\n🎉 Done! Use these IDs to test:")
        print(f"  member_id:    {member_ids[0]}")
        print(f"  job_id:       {job_ids[0]}")
        print(f"  recruiter_id: {recruiter_ids[0]}")
        print("\nMembers you can sign in with:")
        members_info = [
            "alice.johnson@gmail.com", "bob.smith@gmail.com",
            "carol.w@gmail.com",       "david.b@gmail.com",
            "emma.davis@gmail.com",    "frank.m@gmail.com",
            "grace.w@gmail.com",       "henry.m@gmail.com",
            "isabella.t@gmail.com",    "jack.a@gmail.com",
        ]
        for email in members_info:
            print(f"  {email}  (password: {DEFAULT_PASSWORD})")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
