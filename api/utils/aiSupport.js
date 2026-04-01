const axios = require('axios');
const pool = require('../config/database');
const { decryptPassword } = require('./encryption');
const { defaultLogger } = require('./logger');
const { getWebsiteKnowledgeForAi } = require('./aiSupportKnowledge');

const DEFAULT_SYSTEM =
  'You are a support teammate for FivedIT. Sound natural and human: warm, clear, and concise—like a real person on the team, not a robot or a formal brochure.';

/** Appended to every AI support reply (after optional catalog knowledge). */
const CONVERSATION_GUIDE = `

## How you reply (required)
- Write the way a thoughtful human would in chat: short paragraphs, natural wording, occasional contractions if they fit. Vary how you open replies; skip clichés like "As an AI" or stiff "Certainly! I would be happy to assist."
- Do not paste website URLs, email addresses, WhatsApp links, or phone tel: links unless the customer clearly asks for a link, URL, where to open something, where to sign up/buy, or how to reach you online (e.g. "send me the link", "where do I go", "how can I contact you"). For general questions ("what is hosting?"), explain in plain words without links.
- When you do share a clickable link, use HTML only: <a href="https://full-url-here" target="_blank" rel="noopener noreferrer">short readable label</a>. Never use bare https:// text or Markdown [label](url) for links. Use a meaningful label (e.g. "Hosting plans" not "click here").
- You may use <br /> for a line break between short paragraphs when it helps readability.
- If they only need a path conceptually, you can name the page ("Hosting page") without a link until they ask for the link.`;

let ensuredKnowledgeColumn = false;
async function ensureIncludeCatalogColumn() {
  if (ensuredKnowledgeColumn) return;
  try {
    await pool.execute(
      'ALTER TABLE ai_support_config ADD COLUMN include_catalog_knowledge BOOLEAN NOT NULL DEFAULT TRUE'
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  ensuredKnowledgeColumn = true;
}

async function getAiSupportConfig() {
  await ensureIncludeCatalogColumn();
  const [rows] = await pool.execute(
    `SELECT is_enabled, provider, api_base_url, api_key_encrypted, model, system_prompt, temperature, max_tokens,
            include_catalog_knowledge
     FROM ai_support_config WHERE id = 1`
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    is_enabled: Boolean(r.is_enabled),
    provider: r.provider || 'openai',
    api_base_url: r.api_base_url || 'https://api.openai.com/v1',
    api_key: r.api_key_encrypted ? decryptPassword(r.api_key_encrypted) : '',
    model: r.model || 'gpt-4o-mini',
    system_prompt: r.system_prompt || DEFAULT_SYSTEM,
    temperature: Number(r.temperature ?? 0.7),
    max_tokens: Number(r.max_tokens ?? 300),
    include_catalog_knowledge: r.include_catalog_knowledge == null ? true : Boolean(r.include_catalog_knowledge),
  };
}

async function buildFullSystemPrompt(cfg) {
  let system = (cfg.system_prompt || DEFAULT_SYSTEM).trim();
  if (cfg.include_catalog_knowledge) {
    try {
      const knowledge = await getWebsiteKnowledgeForAi();
      if (knowledge && knowledge.trim()) {
        system += `\n\n---\nInternal reference (database: services, prices, pages, contacts). Use facts when relevant, but follow "How you reply" below—do not dump links or contact info unless the customer asks for them.\n${knowledge}`;
      }
    } catch (e) {
      defaultLogger.error('AI support: knowledge load failed:', e.message || e);
    }
  }
  system += CONVERSATION_GUIDE;
  return system;
}

async function generateSupportReply(messages) {
  const cfg = await getAiSupportConfig();
  if (!cfg || !cfg.is_enabled || !cfg.api_key) return null;
  const fullSystemPrompt = await buildFullSystemPrompt(cfg);
  try {
    if ((cfg.provider || '').toLowerCase() === 'gemini') {
      const base = (cfg.api_base_url || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const configuredModel = String(cfg.model || 'gemini-2.5-flash').replace(/^models\//, '').trim();
      const fallbackModels = [
        configuredModel,
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-3.1-flash-lite-preview',
        'gemini-1.5-flash',
      ].filter(Boolean);

      for (const model of [...new Set(fallbackModels)]) {
        try {
          const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
          const response = await axios.post(
            url,
            {
              systemInstruction: fullSystemPrompt ? { parts: [{ text: fullSystemPrompt }] } : undefined,
              contents,
              generationConfig: {
                temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.7,
                maxOutputTokens: Number.isFinite(cfg.max_tokens) ? cfg.max_tokens : 300,
              },
            },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 20000,
            }
          );
          const parts = response?.data?.candidates?.[0]?.content?.parts || [];
          const text = parts.map((p) => p.text || '').join('\n').trim();
          if (text) return text;
        } catch (err) {
          const status = err?.response?.status;
          // Try next model if unavailable/not supported.
          if (status === 404 || status === 400) continue;
          throw err;
        }
      }
      return null;
    }

    // Default: OpenAI-compatible chat.completions
    const url = `${cfg.api_base_url.replace(/\/$/, '')}/chat/completions`;
    const response = await axios.post(
      url,
      {
        model: cfg.model,
        temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.7,
        max_tokens: Number.isFinite(cfg.max_tokens) ? cfg.max_tokens : 300,
        messages: [{ role: 'system', content: fullSystemPrompt }, ...messages],
      },
      {
        headers: {
          Authorization: `Bearer ${cfg.api_key}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );
    const text = response?.data?.choices?.[0]?.message?.content?.trim() || '';
    return text || null;
  } catch (e) {
    defaultLogger.error('AI support reply failed:', e?.response?.data || e.message || e);
    return null;
  }
}

module.exports = { getAiSupportConfig, generateSupportReply, buildFullSystemPrompt };

