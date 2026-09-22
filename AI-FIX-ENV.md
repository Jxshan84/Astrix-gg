# Astrix AI setup

Use at least one working text provider. Two providers are recommended for fallback.

Recommended:
OPENROUTER_API_KEY=<private key>
OPENROUTER_MODEL=openrouter/free

Optional fallbacks:
POLLINATIONS_API_KEY=<private key>
POLLINATIONS_TEXT_MODEL=openai

GEMINI_API_KEY=<private key>
GEMINI_MODEL=gemini-3.6-flash

OPENAI_API_KEY=<private key>
OPENAI_TEXT_MODEL=gpt-5-mini

Never commit API keys to GitHub. Restart/redeploy after changing environment variables.
