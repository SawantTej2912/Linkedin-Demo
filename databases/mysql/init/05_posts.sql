USE linkedin_ds;

CREATE TABLE IF NOT EXISTS posts (
    post_id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    author_id        VARCHAR(36) NOT NULL,
    content          TEXT NOT NULL,
    post_type        ENUM('general','job_update','project','hiring','learning','career_update') DEFAULT 'general',
    likes_count      INT DEFAULT 0,
    comments_count   INT DEFAULT 0,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_author (author_id),
    INDEX idx_created_at (created_at),
    INDEX idx_post_type (post_type)
);
