USE linkedin_ds;

-- Job Applications
CREATE TABLE IF NOT EXISTS applications (
    application_id      VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    job_id              VARCHAR(36)  NOT NULL,
    member_id           VARCHAR(36)  NOT NULL,
    resume_url          VARCHAR(500),
    resume_text         LONGTEXT,
    cover_letter        TEXT,
    status              ENUM('submitted','reviewing','interview','offer','rejected') DEFAULT 'submitted',
    idempotency_key     VARCHAR(64)  UNIQUE,
    applied_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_application (job_id, member_id),
    FOREIGN KEY (job_id)     REFERENCES jobs(job_id)       ON DELETE CASCADE,
    FOREIGN KEY (member_id)  REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_job    (job_id),
    INDEX idx_member (member_id),
    INDEX idx_status (status),
    INDEX idx_applied_at (applied_at)
);

-- Recruiter Notes on Applications
CREATE TABLE IF NOT EXISTS application_notes (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    application_id  VARCHAR(36) NOT NULL,
    recruiter_id    VARCHAR(36) NOT NULL,
    note            TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
    INDEX idx_app_notes (application_id)
);

-- Application Status History (audit trail)
CREATE TABLE IF NOT EXISTS application_status_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    application_id  VARCHAR(36) NOT NULL,
    old_status      VARCHAR(50),
    new_status      VARCHAR(50) NOT NULL,
    changed_by      VARCHAR(36),
    changed_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(application_id) ON DELETE CASCADE,
    INDEX idx_app_history (application_id)
);
