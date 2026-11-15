-- The chat migration enables RLS and revokes anon access, but never grants the
-- authenticated role table privileges. Projects without default Data API grants
-- then reject direct reads with 42501 "permission denied", so the conversation
-- view could not load messages or events (the list works because it goes
-- through the security definer list_conversations() function).
--
-- RLS policies from 20250201000000_chat_messaging.sql still decide which rows
-- each user sees; these grants only let the policies run.

grant select on public.conversations,
                public.conversation_participants,
                public.messages,
                public.conversation_events
  to authenticated;

-- Sending a message is a direct insert (policy messages_insert).
grant insert on public.messages to authenticated;
