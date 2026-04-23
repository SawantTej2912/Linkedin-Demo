USE linkedin_ds;

-- Connection Requests
CREATE TABLE IF NOT EXISTS connection_requests (
    request_id      VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    requester_id    VARCHAR(36) NOT NULL,
    receiver_id     VARCHAR(36) NOT NULL,
    status          ENUM('pending','accepted','rejected') DEFAULT 'pending',
    message         VARCHAR(300),
    idempotency_key VARCHAR(64) UNIQUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_connection_request (requester_id, receiver_id),
    FOREIGN KEY (requester_id) REFERENCES members(member_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id)  REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_requester (requester_id),
    INDEX idx_receiver  (receiver_id),
    INDEX idx_status    (status)
);

-- Accepted Connections (bidirectional adjacency list)
CREATE TABLE IF NOT EXISTS connections (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    member_a    VARCHAR(36) NOT NULL,
    member_b    VARCHAR(36) NOT NULL,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_connection (member_a, member_b),
    FOREIGN KEY (member_a) REFERENCES members(member_id) ON DELETE CASCADE,
    FOREIGN KEY (member_b) REFERENCES members(member_id) ON DELETE CASCADE,
    INDEX idx_member_a (member_a),
    INDEX idx_member_b (member_b)
);
