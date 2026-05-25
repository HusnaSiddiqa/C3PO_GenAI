import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchConversation } from '../../../../screens/ConversationalBot/conversation/ConversationPage/fetchConversationApi';

// Mock the global fetch function
global.fetch = vi.fn();

describe('fetchConversation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fetch and process conversation data successfully', async () => {
    const mockApiResponse = {
      title: 'Test Conversation',
      conversation_id: '123',
      messages: [
        {
          role: 'user',
          type: 'user_input',
          summary: 'Hello',
          conversation_id: '123',
          message_id: 'msg1',
          timestamp: '2023-01-01T00:00:00Z',
          result: 'some result',
          chart: null,
          file: null,
          feedback_rating: null,
          feedback_comment: null,
        },
      ],
    };
    const response = {
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    };
    (fetch as any).mockResolvedValue(response);

    const conversation = await fetchConversation('123');

    expect(fetch).toHaveBeenCalledWith(
      '/v2/chat-manager/chat/conversation/123',
      { credentials: 'include' }
    );
    expect(conversation).toEqual({
      title: 'Test Conversation',
      conversation_id: '123',
      messages: [
        {
          role: 'user',
          message_type: 'user_input',
          summary: 'Hello',
          conversation_id: '123',
          message_id: 'msg1',
          timestamp: '2023-01-01T00:00:00Z',
          result: 'some result',
          chart: null,
          file: null,
          feedback_rating: null,
          feedback_comment: null,
        },
      ],
    });
  });

  it('should throw an error if the fetch response is not ok', async () => {
    const response = {
      ok: false,
      json: () => Promise.resolve({}),
    };
    (fetch as any).mockResolvedValue(response);

    await expect(fetchConversation('123')).rejects.toThrow(
      'Failed to fetch conversation'
    );
  });

  it('should throw an error if fetch fails', async () => {
    const error = new Error('Network error');
    (fetch as any).mockRejectedValue(error);

    await expect(fetchConversation('123')).rejects.toThrow('Network error');
  });
});
