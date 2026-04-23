USE linkedin_ds;

-- Members (Applicants)
CREATE TABLE IF NOT EXISTS members (
    member_id         VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    phone             VARCHAR(20),
    city              VARCHAR(100),
    state             VARCHAR(100),
    country           VARCHAR(100),
    headline          VARCHAR(255),
    about             TEXT,
    profile_photo_url VARCHAR(500),
    resume_url        VARCHAR(500),
    resume_text       LONGTEXT,
    connections_count INT DEFAULT 0,
    is_deleted        TINYINT(1) DEFAULT 0,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_location (city, state, country),
    INDEX idx_deleted (is_deleted)
);

CREATE TABLE IF NOT EXISTS member_skills (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    member_id   VARCHAR(36) NOT NULL,
    skill       VARCHAR(100) NOT NULL,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    UNIQUE KEY uq_member_skill (member_id, skill),
    INDEX idx_member_skills (member_id),
    INDEX idx_skill (skill)
);

CREATE TABLE IF NOT EXISTS member_experience (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    member_id       VARCHAR(36) NOT NULL,
    title           VARCHAR(200) NOT NULL,
    company         VARCHAR(200) NOT NULL,
    location        VARCHAR(200),
    start_date      DATE,
    end_date        DATE,
    is_current      BOOLEAN DEFAULT FALSE,
    description     TEXT,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_member_exp (member_id)
);

CREATE TABLE IF NOT EXISTS member_education (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    member_id       VARCHAR(36) NOT NULL,
    school          VARCHAR(200) NOT NULL,
    degree          VARCHAR(200),
    field_of_study  VARCHAR(200),
    start_year      YEAR,
    end_year        YEAR,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_member_edu (member_id)
);

CREATE TABLE IF NOT EXISTS recruiters (
    recruiter_id      VARCHAR(36)  PRIMARY KEY DEFAULT (UUID()),
    company_id        VARCHAR(36)  NOT NULL,
    first_name        VARCHAR(100) NOT NULL,
    last_name         VARCHAR(100) NOT NULL,
    email             VARCHAR(255) NOT NULL UNIQUE,
    password_hash     VARCHAR(255),
    phone             VARCHAR(20),
    company_name      VARCHAR(200) NOT NULL,
    company_industry  VARCHAR(100),
    company_size      VARCHAR(50),
    role              VARCHAR(100) DEFAULT 'recruiter',
    is_deleted        TINYINT(1)   DEFAULT 0,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_recruiter_email (email),
    INDEX idx_company (company_id)
);

CREATE TABLE IF NOT EXISTS profile_views (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    member_id   VARCHAR(36) NOT NULL,
    viewer_id   VARCHAR(36),
    viewed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_member_views (member_id),
    INDEX idx_viewed_at (viewed_at)
);
