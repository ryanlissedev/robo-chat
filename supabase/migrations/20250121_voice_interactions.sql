-- Create voice_interactions table for tracking speech-to-speech interactions
CREATE TABLE IF NOT EXISTS voice_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    transcription TEXT NOT NULL,
    response_text TEXT NOT NULL,
    audio_duration_ms INTEGER,
    processing_time_ms INTEGER,
    model_used TEXT DEFAULT 'gpt-4o',
    voice_model TEXT DEFAULT 'nova',
    safety_warning_triggered BOOLEAN DEFAULT FALSE,
    error_occurred BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_voice_interactions_user_id ON voice_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_chat_id ON voice_interactions(chat_id);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_session_id ON voice_interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_created_at ON voice_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_voice_interactions_safety_warning ON voice_interactions(safety_warning_triggered) WHERE safety_warning_triggered = TRUE;

-- Create RLS policies
ALTER TABLE voice_interactions ENABLE ROW LEVEL SECURITY;

-- Users can only see their own voice interactions
CREATE POLICY "Users can view own voice interactions" ON voice_interactions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert their own voice interactions
CREATE POLICY "Users can insert own voice interactions" ON voice_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only update their own voice interactions
CREATE POLICY "Users can update own voice interactions" ON voice_interactions
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can only delete their own voice interactions
CREATE POLICY "Users can delete own voice interactions" ON voice_interactions
    FOR DELETE USING (auth.uid() = user_id);

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_voice_interactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_voice_interactions_updated_at
    BEFORE UPDATE ON voice_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_voice_interactions_updated_at();

-- Create a view for voice interaction analytics
CREATE OR REPLACE VIEW voice_interaction_analytics AS
SELECT 
    user_id,
    chat_id,
    DATE(created_at) as interaction_date,
    COUNT(*) as total_interactions,
    COUNT(*) FILTER (WHERE safety_warning_triggered = TRUE) as safety_warnings_count,
    COUNT(*) FILTER (WHERE error_occurred = TRUE) as error_count,
    AVG(processing_time_ms) as avg_processing_time_ms,
    AVG(audio_duration_ms) as avg_audio_duration_ms,
    ARRAY_AGG(DISTINCT model_used) as models_used,
    MAX(created_at) as last_interaction_at
FROM voice_interactions
GROUP BY user_id, chat_id, DATE(created_at);

-- Grant necessary permissions
GRANT SELECT ON voice_interaction_analytics TO authenticated;

-- Comment on the table
COMMENT ON TABLE voice_interactions IS 'Records all speech-to-speech interactions with the RoboRail Assistant for analytics and improvement purposes';
COMMENT ON COLUMN voice_interactions.transcription IS 'The transcribed text from user speech input';
COMMENT ON COLUMN voice_interactions.response_text IS 'The generated text response before TTS conversion';
COMMENT ON COLUMN voice_interactions.safety_warning_triggered IS 'Whether the interaction triggered any safety-related warnings';
COMMENT ON COLUMN voice_interactions.processing_time_ms IS 'Total time from audio input to audio output in milliseconds';
COMMENT ON COLUMN voice_interactions.metadata IS 'Additional metadata about the interaction (JSON format)';