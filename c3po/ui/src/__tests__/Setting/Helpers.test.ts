// import { describe, it, expect } from 'vitest';
import * as helpers from '../../screens/Setting/helpers/helpers';

// Example: assuming helpers.ts exports functions like formatSetting, validateSetting, getSettingValue
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';


const globalAny: any = global;

describe('helpers', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalAny.fetch = fetchMock;
    globalAny.window = {
      URL: {
        createObjectURL: vi.fn(() => 'blob-url'),
        revokeObjectURL: vi.fn(),
      },
    };
    globalAny.document = {
      createElement: vi.fn(() => ({
        href: '',
        download: '',
        click: vi.fn(),
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetchInstructions returns instructions', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          instruction_id: 'id1',
          category: 'cat',
          description: 'desc',
          updated_by: 'user',
          updated_at: 'date',
        },
      ],
    });
    const result = await helpers.fetchInstructions();
    expect(result[0]).toMatchObject({
      instructionId: 'id1',
      category: 'cat',
      description: 'desc',
      updatedBy: 'user',
      updatedAt: 'date',
    });
  });

  it('updateInstruction calls fetch with PUT', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' }),
    });
    const payload = {
      instruction_id: 'id1',
      category: 'cat',
      description: 'desc',
      updated_by: 'user',
    };
    const result = await helpers.updateInstruction(payload);
    expect(result).toEqual({ status: 'success' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/v2/admin/settings/instructions',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('fetchOnboardingDetails returns onboarding details', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        onboarding_id: 'oid',
        agent_name: 'agent',
        agent_description: 'desc',
        updated_at: 'date',
        updated_by: 'user',
      }),
    });
    const result = await helpers.fetchOnboardingDetails();
    expect(result).toMatchObject({
      onboardingId: 'oid',
      agentName: 'agent',
      agentDescription: 'desc',
      updatedAt: 'date',
      updatedBy: 'user',
    });
  });

  it('updateOnboardingDetails calls fetch with PUT', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success' }),
    });
    const payload = {
      onboarding_id: 'oid',
      agent_name: 'agent',
      agent_description: 'desc',
      updated_by: 'user',
    };
    const result = await helpers.updateOnboardingDetails(payload);
    expect(result).toEqual({ status: 'success' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/v2/admin/settings/onboarding',
      expect.objectContaining({ method: 'PUT' })
    );
  });

  it('callSynMetadata returns SyncMetadataResponse', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        message: 'done',
        details: {
          databricks_tables_synced: 1,
          glue_tables_synced: 2,
          databricks_columns_synced: 3,
          glue_columns_synced: 4,
          total_tables_processed: 5,
          total_columns_processed: 6,
          errors: [],
          duration_seconds: 7,
          timestamp: 'now',
        },
      }),
    });
    const result = await helpers.callSynMetadata();
    expect(result.status).toBe('ok');
    expect(result.details.databricksTablesSynced).toBe(1);
  });

  it('getSchemaConfig returns schema config', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ datasource: 'db' }],
    });
    const result = await helpers.getSchemaConfig();
    expect(result[0]).toHaveProperty('datasource', 'db');
  });

  it('getTableMetadata returns table metadata', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          PK: 'pk',
          SK: 'sk',
          item_type: 'type',
          datasource: 'ds',
          catalog: 'cat',
          db_name: 'db',
          table_name: 'table',
          column_name: 'col',
          column_type: 'type',
          status: 'active',
          metadata_description: 'desc',
          metadata_type: 'type',
          sync_timestamp: 'ts',
          updated_at: 'date',
        },
      ],
    });
    const result = await helpers.getTableMetadata({
      dbName: 'db',
      tableName: 'table',
      datasource: 'ds',
      catalog: 'cat',
    });
    expect(result[0]).toHaveProperty('pk', 'pk');
  });

  it('updateTableMetadata returns UpdateTableMetadataResponse', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'ok',
        details: {
          PK: 'pk',
          SK: 'sk',
          updated_fields: {
            metadata_description: 'desc',
            metadata_type: 'type',
            updated_at: 'date',
          },
          error: null,
        },
      }),
    });
    const payload = {
      dbName: 'db',
      tableName: 'table',
      columnName: 'col',
      metadataDescription: 'desc',
      metadataType: 'type',
      datasource: 'ds',
      catalog: 'cat',
    };
    const result = await helpers.updateTableMetadata(payload);
    expect(result.status).toBe('ok');
    expect(result.details.pk).toBe('pk');
  });

  it('exportSchemaConfig triggers download', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['csv']),
    });
    await helpers.exportSchemaConfig({ datasource: 'ds', dbName: 'db' });
    expect(globalAny.document.createElement).toHaveBeenCalledWith('a');
    expect(globalAny.document.body.appendChild).toHaveBeenCalled();
  });

  it('fetchAgents returns agents', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agents: [{ id: 'a1' }] }),
    });
    const result = await helpers.fetchAgents();
    expect(result[0]).toHaveProperty('id', 'a1');
  });

  it('fetchLatestAgentVersion returns agent version details', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        agent_id: 'aid',
        version_alias: 'v1',
        prompt: 'prompt',
        model: 'model',
        temperature: 0.5,
        versions: [],
      }),
    });
    const result = await helpers.fetchLatestAgentVersion('aid');
    expect(result.agentId).toBe('aid');
  });

  it('fetchPromptDetails returns prompt details', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        agent: 'a',
        version_alias: 'v',
        prompt: 'p',
        model: 'm',
        temperature: 1,
      }),
    });
    const result = await helpers.fetchPromptDetails('a', 'v');
    expect(result.agent).toBe('a');
  });

  it('fetchModelsList returns models list', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ['model1', 'model2'],
    });
    const result = await helpers.fetchModelsList();
    expect(result).toContain('model1');
  });

  it('saveAgentPrompt returns SaveAgentPromptResponse', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        agent_id: 'aid',
        version_alias: 'v1',
        prompt: 'prompt',
        model: 'model',
        temperature: 0.5,
        benchmark_file: 'file',
        accuracy: 99,
      }),
    });
    const payload = {
      agentId: 'aid',
      prompt: 'prompt',
      model: 'model',
      temperature: 0.5,
      benchmarkFile: 'file',
      accuracy: 99,
    };
    const result = await helpers.saveAgentPrompt('aid', payload);
    expect(result.agentId).toBe('aid');
    expect(result.accuracy).toBe(99);
  });

  it('fetchFeedbackData returns feedback details', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'f1' }],
    });
    const result = await helpers.fetchFeedbackData();
    expect(result[0]).toHaveProperty('id', 'f1');
  });

  it('searchFeedbackData returns filtered feedback', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'f2' }],
    });
    const result = await helpers.searchFeedbackData('?user=1');
    expect(result[0]).toHaveProperty('id', 'f2');
  });

  it('fetchUserIdsForFeedback returns user ids', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ['u1', 'u2'],
    });
    const result = await helpers.fetchUserIdsForFeedback();
    expect(result).toContain('u1');
  });

  it('updateFeedbackDetails returns updated feedback', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'f1', status: 'ok' }),
    });
    const payload = { id: 'f1', sql_query: 'SELECT 1', user_id: 'u1' };
    const result = await helpers.updateFeedbackDetails(payload);
    expect(result.id).toBe('f1');
  });

  // it('fetchBenchmarkingMatchScores returns match scores', async () => {
  //   fetchMock.mockResolvedValueOnce({
  //     ok: true,
  //     json: async () => ['score1', 'score2'],
  //   });
  //   const result = await helpers.fetchBenchmarkingMatchScores([{ id: 'q1' } as any]);
  //   expect(result).toContain('score1');
  // });

  it('uploadClickableFile returns ClickableQuestionsDetails', async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ id: 'cq1' }),
    });
    const file = new File([''], 'test.csv');
    const result = await helpers.uploadClickableFile({ file, user_id: 'u1' });
    expect(result.id).toBe('cq1');
  });

  it('getClickableQuestions returns clickable questions', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 'cq2' }],
    });
    const result = await helpers.getClickableQuestions();
    expect(result[0]).toHaveProperty('id', 'cq2');
  });

  it('updateClickableQuestions returns updated items', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ updated_items: [{ updated_at: 'date' }] }),
    });
    const result = await helpers.updateClickableQuestions([{ PK: 'pk', SK: 'sk', category: 'cat', enabled: true }]);
    expect(result.updated_items[0]).toHaveProperty('updated_at', 'date');
  });

  it('downloadClickableQuestions triggers download', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['csv']),
    });
    await helpers.downloadClickableQuestions();
    expect(globalAny.document.createElement).toHaveBeenCalledWith('a');
    expect(globalAny.document.body.appendChild).toHaveBeenCalled();
  });

  it('uploadByodFile returns file info', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ file_url: 'url', filename: 'file.csv' }),
    });
    const file = new File([''], 'file.csv');
    const result = await helpers.uploadByodFile({ file, user_id: 'u1' });
    expect(result.file_url).toBe('url');
    expect(result.filename).toBe('file.csv');
  });
});