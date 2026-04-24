USE linkedin_ds;

CREATE TABLE IF NOT EXISTS saved_posts (
    save_id       VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id       VARCHAR(36) NOT NULL,
    member_id     VARCHAR(36) NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_saved_post_member (post_id, member_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_saved_member (member_id),
    INDEX idx_saved_post (post_id)
);
