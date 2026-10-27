# backend/chatbot.py
import os
import time
import re
from datetime import datetime

from anthropic import Anthropic
from dotenv import load_dotenv

from search import get_search_context


# ─────────────────────────────────────────────────────
# LOAD ENVIRONMENT VARIABLES
# ─────────────────────────────────────────────────────

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    raise ValueError(
        "OPENROUTER_API_KEY is missing from your .env file."
    )


# ─────────────────────────────────────────────────────
# OPENROUTER CLIENT
# ─────────────────────────────────────────────────────

client = Anthropic(
    base_url="https://openrouter.ai/api",
    api_key=OPENROUTER_API_KEY,
)


# ─────────────────────────────────────────────────────
# MODEL FALLBACK CHAIN
# ─────────────────────────────────────────────────────

MODEL_CHAIN = [
    "google/gemma-4-31b-it:free",              # ← PRIMARY (your choice, now first)
    "meta-llama/llama-4-maverick:free",        # ← strong fallback
    "qwen/qwen3-coder:free",                   # ← great for technical Qs
    "minimax/minimax-m3:free",                 # ← general assistant
    "google/gemma-4-26b-a4b-it:free",         # ← smaller Gemma variant
    "thinkingmachines/inkling:free",           # ← reasoning model
    "nvidia/nemotron-3-ultra-550b-a55b:free", # ← uncertain ID, moved last
    "openrouter/free",                         # ← ultimate safety net
]


# ─────────────────────────────────────────────────────
# SYSTEM PROMPT
# ─────────────────────────────────────────────────────

def build_system_prompt() -> str:
    today = datetime.now().strftime("%A, %B %d, %Y")

    return f"""
You are a helpful, friendly AI voice assistant on a website.

Today's date is {today}.

Keep your answers clear, concise, and conversational.

Since your replies will be spoken aloud:
Do not use bullet points.
Do not use numbered lists.
Do not use section headers.
Do not use Markdown.
Do not use emojis.
Do not use unnecessary special characters.

Speak naturally in flowing sentences.

If current web search information is provided, use it when
relevant to the user's question.

If the search results do not contain useful information,
do not invent an answer.

Your entire reply should be plain spoken English.
"""


# ─────────────────────────────────────────────────────
# CLEAN RESPONSE FOR VOICE
# ─────────────────────────────────────────────────────

def clean_for_speech(text: str) -> str:
    """
    Remove common Markdown formatting so the response
    sounds natural when sent to text-to-speech.
    """

    if not text:
        return ""

    # Remove bold
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)

    # Remove italic
    text = re.sub(r"\*(.+?)\*", r"\1", text)

    # Remove Markdown headings
    text = re.sub(
        r"^#{1,6}\s*",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Remove horizontal rules
    text = re.sub(
        r"^-{3,}$",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Remove bullet markers
    text = re.sub(
        r"^\s*[-*+]\s+",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Remove numbered-list markers
    text = re.sub(
        r"^\s*\d+\.\s+",
        "",
        text,
        flags=re.MULTILINE,
    )

    # Normalize excessive blank lines
    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text,
    )

    return text.strip()


# ─────────────────────────────────────────────────────
# EXTRACT TEXT FROM ANTHROPIC-STYLE RESPONSE
# ─────────────────────────────────────────────────────

def _extract_text(response) -> str:
    """
    Safely extract text from an Anthropic-style response.

    Claude/OpenRouter responses can contain different
    content block types, so we look specifically for
    a text block.
    """

    if not response or not response.content:
        return ""

    for block in response.content:

        if getattr(block, "type", None) == "text":
            return getattr(block, "text", "") or ""

    return ""


# ─────────────────────────────────────────────────────
# CHANGE 1 — Skip web search for conversational messages
# ─────────────────────────────────────────────────────

_SKIP_WORDS = {
    "hello", "hi", "hey", "ok", "okay", "thanks",
    "thank you", "bye", "goodbye", "yes", "no",
    "sure", "great", "nice", "cool", "good",
}


def _should_search(text: str) -> bool:
    """Return False for short conversational messages — skip web search."""
    clean = text.strip().lower().rstrip("!?.")
    if len(clean) < 8:              # very short = conversational
        return False
    if clean in _SKIP_WORDS:         # known conversational phrases
        return False
    return True


# ─────────────────────────────────────────────────────
# MAIN AI FUNCTION
# ─────────────────────────────────────────────────────

def get_ai_reply(messages: list) -> str:
    """
    Try each model in MODEL_CHAIN until one succeeds.

    Also performs a web search using the latest user
    message and gives the results to the AI as context.
    """

    # Find the latest user message
    last_user = next(
        (
            message.get("content", "")
            for message in reversed(messages)
            if message.get("role") == "user"
        ),
        "",
    )

    # ─────────────────────────────────────────────
    # WEB SEARCH (only for non-conversational messages)
    # ─────────────────────────────────────────────

    if _should_search(last_user):
        web_context = get_search_context(last_user)
    else:
        web_context = ""
        print("[search] Skipped — conversational message.")

    # Build system prompt
    system = build_system_prompt()

    # Add search results to the system prompt
    if web_context:
        system += (
            "\n\n"
            + web_context
            + "\n\n"
            "Use the above search results when they are relevant "
            "to the user's question. Do not invent information "
            "that is not supported by the search results."
        )

        print("[search] Web context added to AI prompt.")

    else:
        print("[search] No web results found.")

    # ─────────────────────────────────────────────
    # MODEL FALLBACK LOOP
    # ─────────────────────────────────────────────

    last_error = None

    for model in MODEL_CHAIN:

        for attempt in range(2):

            try:

                print(
                    f"[chatbot] Trying model: {model}"
                    f" (attempt {attempt + 1})"
                )

                response = client.messages.create(
                    model=model,
                    max_tokens=1024,
                    system=system,
                    messages=messages,
                )

                text = _extract_text(response)

                if text:
                    print(
                        f"[chatbot] Success with model: {model}"
                    )

                    return clean_for_speech(text)

                print(
                    f"[chatbot] {model} returned no text."
                )

                break

            except Exception as error:

                err = str(error)
                last_error = error

                # ─────────────────────────────
                # BILLING / CREDITS
                # ─────────────────────────────

                if (
                    "402" in err
                    or "billing_error" in err.lower()
                    or "credits" in err.lower()
                    or "credit balance" in err.lower()
                ):
                    print(
                        f"[chatbot] {model} has a billing/"
                        "credit problem. Skipping."
                    )
                    break

                # ─────────────────────────────
                # MODEL NOT FOUND
                # ─────────────────────────────

                if (
                    "404" in err
                    or "not_found" in err.lower()
                ):
                    print(
                        f"[chatbot] {model} was not found. "
                        "Skipping."
                    )
                    break

                # ─────────────────────────────
                # INVALID REQUEST
                # ─────────────────────────────

                if (
                    "400" in err
                    or "invalid_request" in err.lower()
                ):
                    print(
                        f"[chatbot] {model} rejected the "
                        "request. Skipping."
                    )
                    break

                # ─────────────────────────────
                # RATE LIMIT
                # ─────────────────────────────

                if (
                    "429" in err
                    or "rate_limit" in err.lower()
                ):
                    print(
                        f"[chatbot] {model} was rate-limited. "
                        f"Waiting 3 seconds..."
                    )

                    time.sleep(3)
                    continue

                # ─────────────────────────────
                # OTHER ERROR
                # ─────────────────────────────

                print(
                    f"[chatbot] {model} failed: {error}"
                )

                break

    # ─────────────────────────────────────────────
    # ALL MODELS FAILED
    # ─────────────────────────────────────────────

    print(
        f"[chatbot] All models failed. "
        f"Last error: {last_error}"
    )

    return (
        "Sorry, I couldn't generate a reply right now. "
        "Please try again."
    )


if __name__ == "__main__":
    print("Reply:", get_ai_reply([{"role": "user", "content": "Hello! Who are you?"}]))