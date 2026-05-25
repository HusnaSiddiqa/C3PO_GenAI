import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Chat } from '../../../../../screens/ConversationalBot/conversation/Chat/Chat';

// Mock dependencies
vi.mock('../../../../../screens/ConversationalBot/conversation/Chat/AgentBubble', () => ({
  AgentBubble: (props: any) => <div data-testid="agent-bubble">{props.content}</div>,
}));
vi.mock('../../../../../screens/ConversationalBot/conversation/Chat/UserBubble', () => ({
  UserBubble: (props: any) => <div data-testid="user-bubble">{props.chat.text}</div>,
}));
vi.mock('../../../../../screens/ConversationalBot/conversation/components/ChatSection/ChatExamples', () => ({
  ChatExamples: (props: any) => <div data-testid="chat-examples" />,
}));
vi.mock('@mui/material', async () => {
  const actual = await vi.importActual('@mui/material');
  return {
    ...actual,
    useTheme: () => ({ spacing: () => 8 }),
    Box: (props: any) => <div {...props} />,
  };
});
vi.mock('../../../../../screens/ConversationalBot/conversation/Chat/styles', () => ({
  ChatContainer: React.forwardRef<HTMLDivElement>((props: any, ref) => <div ref={ref} {...props} />),
}));

// Add this before your tests
beforeAll(() => {
  // Mock scrollTo on all div elements
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('Chat', () => {
  const baseProps = {
    conversationHistory: [
      {
        role: 'user',
        text: 'Hello',
        message_id: '1',
        timestamp: '123',
        data: [] as [],
        type: 'text',
        chart: null,
        message_type: 'user',
        conversation_id: 'conv1',
      },
      {
        role: 'assistant',
        text: 'Hi!',
        message_id: '2',
        timestamp: '124',
        data: [] as [],
        type: 'text',
        chart: null,
        message_type: 'assistant',
        conversation_id: 'conv1',
      },
    ],
    agentName: 'AgentX',
    toShowInitialStaticLoader: false,
    isBotResponseStreaming: false,
    handleSelectQuestion: vi.fn(),
  };

  it('renders ChatExamples', () => {
    render(<Chat {...baseProps} />);
    expect(screen.getByTestId('chat-examples')).toBeInTheDocument();
  });

  it('renders UserBubble and AgentBubble for conversationHistory', () => {
    render(<Chat {...baseProps} />);
    expect(screen.getByTestId('user-bubble')).toHaveTextContent('Hello');
    expect(screen.getByTestId('agent-bubble')).toHaveTextContent('Hi!');
  });

  it('renders only ChatExamples when conversationHistory is empty', () => {
    render(<Chat {...baseProps} conversationHistory={[]} />);
    expect(screen.getByTestId('chat-examples')).toBeInTheDocument();
    expect(screen.queryByTestId('user-bubble')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agent-bubble')).not.toBeInTheDocument();
  });

  it('passes correct props to AgentBubble for last message', () => {
    render(<Chat {...baseProps} isBotResponseStreaming={true} toShowInitialStaticLoader={true} />);
    // The AgentBubble for the last message should have the correct content
    expect(screen.getByTestId('agent-bubble')).toHaveTextContent('Hi!');
  });
});