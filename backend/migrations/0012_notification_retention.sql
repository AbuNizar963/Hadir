-- Notifications are ephemeral inbox records: keep them for 30 days.
-- Requests are historical records and are intentionally not deleted by retention jobs.
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- The cleanup endpoint/job deletes only notifications older than 30 days.
-- There is deliberately no DELETE policy for requests.
