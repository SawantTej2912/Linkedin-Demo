USE linkedin_ds;

CREATE TABLE IF NOT EXISTS post_likes (
    like_id      VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id      VARCHAR(36) NOT NULL,
    member_id    VARCHAR(36) NOT NULL,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_post_member_like (post_id, member_id),
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_like_post (post_id),
    INDEX idx_like_member (member_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
    comment_id    VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    post_id       VARCHAR(36) NOT NULL,
    author_id     VARCHAR(36) NOT NULL,
    content       TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_comment_post (post_id),
    INDEX idx_comment_author (author_id),
    INDEX idx_comment_created (created_at)
);
