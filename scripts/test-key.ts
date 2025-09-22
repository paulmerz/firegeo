import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

openai.models
  .list()
  .then(() => console.log('✅ API Key fonctionne et a du quota'))
  .catch(err => console.error('❌ Mauvaise API Key ou pas de quota :', err.message));
