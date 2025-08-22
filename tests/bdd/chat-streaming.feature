Feature: Chat Streaming Functionality
  As a user
  I want to see AI responses stream smoothly in real-time
  So that I have a fluid conversational experience

  Background:
    Given the RoboChat application is running
    And I am on the main chat interface

  Scenario: Successful message streaming
    Given I have typed a message "Hello, can you hear me?"
    When I submit the message
    Then I should see my message appear in the chat history
    And I should see the AI response start streaming within 2 seconds
    And the response should appear character by character smoothly
    And the response should contain relevant RoboRail information

  Scenario: Smooth streaming animation
    Given I have submitted a message to the AI
    When the AI response starts streaming
    Then the text should appear at a consistent rate
    And there should be no jarring text bursts
    And the animation should run at approximately 60fps
    And the cursor should indicate active streaming

  Scenario: Network resilience during streaming
    Given I have submitted a message to the AI
    And the response is currently streaming
    When the network connection is temporarily disrupted
    Then the streaming should pause gracefully
    And when the connection is restored
    Then streaming should resume from where it left off
    And no content should be lost

  Scenario: Multiple concurrent streams
    Given I have multiple chat conversations open
    When I submit messages in different conversations
    Then each conversation should stream independently
    And one slow stream should not block others
    And each stream should maintain smooth animation

  Scenario: Error handling during streaming
    Given I have submitted a message to the AI
    When an error occurs during the streaming process
    Then I should see a clear error message
    And the partial response should remain visible
    And I should have the option to retry the request
    And the chat interface should remain responsive

  Scenario: Stream completion and interaction
    Given I have submitted a message to the AI
    When the AI response finishes streaming
    Then the streaming indicator should disappear
    And I should see action buttons (copy, regenerate, etc.)
    And I should be able to submit a new message
    And the response should be saved to chat history

  Scenario: Voice integration with streaming
    Given I have enabled voice input
    When I speak a message and it's transcribed
    Then the message should submit automatically
    And the AI response should stream as normal
    And voice controls should remain available during streaming

  Scenario: File attachment with streaming response
    Given I have attached a file to my message
    When I submit the message with attachment
    Then the file should be processed successfully
    And the AI response should reference the file content
    And the streaming should work normally with file context

  Scenario: Real-time typing indicators
    Given another user is in the same chat session
    When they start typing a message
    Then I should see a typing indicator
    And when they stop typing
    Then the indicator should disappear
    And this should not interfere with AI streaming

  Scenario: Performance under load
    Given the system is experiencing high traffic
    When I submit a message
    Then the response should still start streaming within 5 seconds
    And the streaming quality should not degrade significantly
    And the user interface should remain responsive
    And appropriate loading indicators should be shown