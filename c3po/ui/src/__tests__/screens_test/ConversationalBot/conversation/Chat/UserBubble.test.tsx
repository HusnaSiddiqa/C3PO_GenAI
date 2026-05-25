import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserBubble } from '../../../../../screens/ConversationalBot/conversation/Chat/UserBubble';

// Mock styles and FileComponent
vi.mock('../../../../../screens/ConversationalBot/conversation/Chat/styles', () => ({
  ChatUserBallom: ({ children }: any) => <div data-testid="chat-user-ballom">{children}</div>,
  ChatContent: ({ children }: any) => <div data-testid="chat-content">{children}</div>,
}));
vi.mock('../../../../../screens/ConversationalBot/conversation/Chat/FileComponent', () => ({
  FileComponent: ({ fileId, filename }: any) => (
    <div data-testid="file-component">
      {filename} ({fileId})
    </div>
  ),
}));

describe('UserBubble', () => {
  it('renders summary text', () => {
    const chat = {
      summary: 'User summary here',
      file: null,
    };
    render(<UserBubble chat={chat as any} index={0} />);
    expect(screen.getByText('User summary here')).toBeInTheDocument();
  });

  it('renders file component if file is present', () => {
    const chat = {
      summary: 'Summary with file',
      file: { file_id: 'file123', filename: 'test.pdf' },
    };
    render(<UserBubble chat={chat as any} index={1} />);
    expect(screen.getByTestId('file-component')).toHaveTextContent('test.pdf (file123)');
    expect(screen.getByText('Summary with file')).toBeInTheDocument();
  });

  it('does not render summary if not present', () => {
    const chat = {
      summary: undefined,
      file: null,
    };
    render(<UserBubble chat={chat as any} index={2} />);
    expect(screen.queryByText('User summary here')).not.toBeInTheDocument();
  });

  it('does not render file component if file is not present', () => {
    const chat = {
      summary: 'No file here',
      file: null,
    };
    render(<UserBubble chat={chat as any} index={3} />);
    expect(screen.queryByTestId('file-component')).not.toBeInTheDocument();
    expect(screen.getByText('No file here')).toBeInTheDocument();
  });
});