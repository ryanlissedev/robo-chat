-- Create message feedback table for storing user feedback on assistant messages
CREATE TABLE IF NOT EXISTS message_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,
  user_id UUID NOT NULL,
  feedback VARCHAR(20) CHECK (feedback IN ('upvote', 'downvote')),
  comment TEXT,
  langsmith_run_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one feedback per user per message
  UNIQUE(message_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON message_feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON message_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_created_at ON message_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_langsmith_run_id ON message_feedback(langsmith_run_id);

-- Add reasoning effort column to messages table if it doesn't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS reasoning_effort VARCHAR(10) DEFAULT 'medium' CHECK (reasoning_effort IN ('low', 'medium', 'high'));

-- Add langsmith_run_id to messages table for tracking
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS langsmith_run_id VARCHAR(255);

-- Create index for langsmith_run_id on messages
CREATE INDEX IF NOT EXISTS idx_messages_langsmith_run_id ON messages(langsmith_run_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only insert/update/delete their own feedback
CREATE POLICY "Users can manage their own feedback" ON message_feedback
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view feedback for messages in their chats
CREATE POLICY "Users can view feedback for their chat messages" ON message_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN chats c ON m.chat_id = c.id
      WHERE m.id = message_feedback.message_id
      AND c.user_id = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_message_feedback_updated_at
  BEFORE UPDATE ON message_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE message_feedback IS 'Stores user feedback (upvote/downvote) for assistant messages with optional comments and LangSmith integration';
COMMENT ON COLUMN message_feedback.langsmith_run_id IS 'LangSmith run ID for tracking feedback in the LangSmith platform';
COMMENT ON COLUMN messages.reasoning_effort IS 'GPT-5 reasoning effort level: low (fast), medium (balanced), high (thorough)';
COMMENT ON COLUMN messages.langsmith_run_id IS 'LangSmith run ID for message tracing and analytics';