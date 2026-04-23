USE linkedin_ds;

-- Job Postings
CREATE TABLE IF NOT EXISTS jobs (
    job_id              VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    company_id          VARCHAR(36)  NOT NULL,
    recruiter_id        VARCHAR(36)  NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         LONGTEXT,
    seniority_level     ENUM('Internship','Entry level','Associate','Mid-Senior level','Director','Executive') DEFAULT 'Entry level',
    employment_type     ENUM('Full-time','Part-time','Contract','Temporary','Volunteer','Internship') DEFAULT 'Full-time',
    city                VARCHAR(100),
    state               VARCHAR(100),
    country             VARCHAR(100),
    work_mode           ENUM('onsite','remote','hybrid') DEFAULT 'onsite',
    salary_min          DECIMAL(12,2),
    salary_max          DECIMAL(12,2),
    industry            VARCHAR(100),
    status              ENUM('open','closed','draft') DEFAULT 'open',
    views_count         INT DEFAULT 0,
    applicants_count    INT DEFAULT 0,
    saves_count         INT DEFAULT 0,
    posted_at           DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at           DATETIME,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (recruiter_id) REFERENCES recruiters(recruiter_id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_recruiter (recruiter_id),
    INDEX idx_company (company_id),
    INDEX idx_location (city, state, country),
    INDEX idx_posted_at (posted_at),
    FULLTEXT INDEX ft_job_search (title, description)
);

-- Job Skills Required
CREATE TABLE IF NOT EXISTS job_skills (
    id      INT AUTO_INCREMENT PRIMARY KEY,
    job_id  VARCHAR(36) NOT NULL,
    skill   VARCHAR(100) NOT NULL,
    FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
    INDEX idx_job_skills (job_id),
    INDEX idx_skill (skill)
);

-- Saved Jobs
CREATE TABLE IF NOT EXISTS saved_jobs (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    member_id   VARCHAR(36) NOT NULL,
    job_id      VARCHAR(36) NOT NULL,
    saved_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_saved (member_id, job_id),
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    FOREIGN KEY (job_id)    REFERENCES jobs(job_id)    ON DELETE CASCADE,
    INDEX idx_member_saved (member_id)
);
