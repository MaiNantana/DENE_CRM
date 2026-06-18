import { Router } from 'express';
import { requireAuth, requireMinimumRole } from '../middleware/auth.js';
import { aw } from '../asyncWrap.js';
import '../lib/env.js';

const router = Router();
const DEFAULT_OPENAI_MODEL = 'gpt-5.2';

router.get('/env', requireAuth, requireMinimumRole('admin'), aw(async (_req, res) => {
  res.json({
    openaiApiKeyPresent: Boolean(String(process.env.OPENAI_API_KEY || '').trim()),
    openaiSlipModelPresent: Boolean(String(process.env.OPENAI_SLIP_MODEL || '').trim()),
    openaiSlipReasoningEffortPresent: Boolean(String(process.env.OPENAI_SLIP_REASONING_EFFORT || '').trim()),
  });
}));

router.get('/openai', requireAuth, requireMinimumRole('admin'), aw(async (_req, res) => {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const model = String(process.env.OPENAI_SLIP_MODEL || DEFAULT_OPENAI_MODEL).trim() || DEFAULT_OPENAI_MODEL;

  if (!apiKey) {
    return res.status(200).json({
      ok: false,
      apiKeyPresent: false,
      model,
      error: 'OPENAI_API_KEY is missing',
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Reply with exactly ok.',
            },
          ],
        },
      ],
      max_output_tokens: 16,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return res.status(200).json({
      ok: false,
      apiKeyPresent: true,
      model,
      status: response.status,
      error: payload?.error?.message || `OpenAI request failed with status ${response.status}`,
    });
  }

  res.json({
    ok: true,
    apiKeyPresent: true,
    model,
    responseId: payload?.id || null,
  });
}));

export default router;
