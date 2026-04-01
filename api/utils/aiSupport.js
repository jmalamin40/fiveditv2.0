const axios = require('axios');
const pool = require('../config/database');
const { decryptPassword } = require('./encryption');
const { defaultLogger } = require('./logger');

async function getAiSupportConfig() {
  const [rows] = await pool.execute(
    `SELECT is_enabled, provider, api_base_url, api_key_encrypted, model, system_prompt, temperature, max_tokens
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
    system_prompt:
      r.system_prompt ||
      'You are a helpful support assistant for FivedIT. Keep answers short, professional, and actionable.',
    temperature: Number(r.temperature ?? 0.7),
    max_tokens: Number(r.max_tokens ?? 300),
  };
}

async function generateSupportReply(messages) {
  const cfg = await getAiSupportConfig();
  if (!cfg || !cfg.is_enabled || !cfg.api_key) return null;
  try {
    if ((cfg.provider || '').toLowerCase() === 'gemini') {
      const base = (cfg.api_base_url || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
      const model = cfg.model || 'gemini-1.5-flash';
      const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
      const contents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const response = await axios.post(
        url,
        {
          systemInstruction: cfg.system_prompt ? { parts: [{ text: cfg.system_prompt }] } : undefined,
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
      return text || null;
    }

    // Default: OpenAI-compatible chat.completions
    const url = `${cfg.api_base_url.replace(/\/$/, '')}/chat/completions`;
    const response = await axios.post(
      url,
      {
        model: cfg.model,
        temperature: Number.isFinite(cfg.temperature) ? cfg.temperature : 0.7,
        max_tokens: Number.isFinite(cfg.max_tokens) ? cfg.max_tokens : 300,
        messages: [
          { role: 'system', content: cfg.system_prompt },
          ...messages,
        ],
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

module.exports = { getAiSupportConfig, generateSupportReply };

