/**
 * Session list row fields without scanning all chat_messages via JOIN.
 * Uses indexed lookups per session (fast with idx_session on chat_messages).
 */
const SESSION_AGGREGATES_SQL = `
  (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id) AS message_count,
  (SELECT MAX(cm.created_at) FROM chat_messages cm WHERE cm.session_id = cs.id) AS last_message_time,
  (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.id AND cm.sender_type = 'user' AND cm.is_read = FALSE) AS unread_count,
  CASE WHEN EXISTS (
    SELECT 1 FROM user_online_status uos
    WHERE uos.session_id = cs.id AND uos.user_type = 'user'
    AND TIMESTAMPDIFF(SECOND, uos.last_seen, NOW()) <= 30
  ) THEN TRUE ELSE FALSE END AS is_online
`.replace(/\s+/g, ' ').trim();

function selectSessionWithAggregates(extraWhere = '') {
  return `SELECT cs.*, ${SESSION_AGGREGATES_SQL} FROM chat_sessions cs ${extraWhere}`;
}

module.exports = {
  SESSION_AGGREGATES_SQL,
  selectSessionWithAggregates,
};
