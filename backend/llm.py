import os
import logging
from typing import Optional, AsyncGenerator
from functools import lru_cache

from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage

logger = logging.getLogger(__name__)


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 3)


MAX_CONTEXT_TOKENS = int(os.environ.get("LLM_MAX_CONTEXT_TOKENS", "8000"))


def _normalized_base_url() -> Optional[str]:
    api_url = os.environ.get("LLM_API_URL") or ""
    if not api_url:
        return None
    return api_url.replace("/chat/completions", "") if api_url.endswith("/chat/completions") else api_url


def _build_client(model: Optional[str], *, streaming: bool = True, temperature: Optional[float] = None):
    """Build an OpenAI-compatible chat client with a hard timeout and bounded retries."""
    kwargs = dict(
        model=model,
        model_provider="openai",
        api_key=os.environ.get("LLM_API_KEY"),
        temperature=temperature if temperature is not None else float(os.environ.get("LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.environ.get("LLM_MAX_TOKENS", "4096")),
        streaming=streaming,
        timeout=float(os.environ.get("LLM_TIMEOUT_SECONDS", "30")),
        max_retries=int(os.environ.get("LLM_MAX_RETRIES", "1")),
    )
    base_url = _normalized_base_url()
    if base_url:
        kwargs["base_url"] = base_url
    return init_chat_model(**kwargs)


@lru_cache(maxsize=1)
def get_llm_client():
    if not is_llm_configured():
        return None
    return _build_client(os.environ.get("LLM_MODEL"), streaming=True)


@lru_cache(maxsize=4)
def get_llm_for(role: str = "main"):
    """role='main' -> LLM_MODEL (reasoning); role='fast' -> LLM_FAST_MODEL (planning/reflection, falls back to main).

    The fast role runs at low temperature for stable structured output.
    """
    if not is_llm_configured():
        return None
    if role == "fast":
        model = os.environ.get("LLM_FAST_MODEL") or os.environ.get("LLM_MODEL")
        return _build_client(model, streaming=False, temperature=float(os.environ.get("LLM_FAST_TEMPERATURE", "0.1")))
    return _build_client(os.environ.get("LLM_MODEL"), streaming=True, temperature=float(os.environ.get("LLM_AGENT_TEMPERATURE", "0.3")))


def llm_info() -> dict:
    return {
        "configured": is_llm_configured(),
        "model": os.environ.get("LLM_MODEL"),
        "fast_model": os.environ.get("LLM_FAST_MODEL") or os.environ.get("LLM_MODEL"),
        "base_url_set": bool(_normalized_base_url()),
    }


def _get_llm():
    return get_llm_client()


def is_llm_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


async def chat_with_llm(messages: list, system_prompt: str) -> Optional[str]:
    llm = _get_llm()
    if not llm:
        return None

    try:
        full_messages = [SystemMessage(content=system_prompt)] + [
            HumanMessage(content=m.get("content", ""))
            for m in messages
        ]
        response = await llm.ainvoke(full_messages)
        return response.content
    except Exception as e:
        logger.warning("LLM call failed: %s", e)
    return None


async def chat_with_llm_stream(
    messages: list,
    system_prompt: str,
    include_thinking: bool = True,
) -> AsyncGenerator[tuple[str, str], None]:
    llm = _get_llm()
    if not llm:
        return

    try:
        full_messages = [SystemMessage(content=system_prompt)] + [
            HumanMessage(content=m.get("content", ""))
            for m in messages
        ]
        async for chunk in llm.astream(full_messages):
            if chunk.content:
                yield "content", chunk.content
    except Exception as e:
        logger.warning("LLM stream call failed: %s", e)


async def chat_with_llm_stream_with_thinking(
    messages: list,
    system_prompt: str,
) -> AsyncGenerator[tuple[str, str], None]:
    llm = _get_llm()
    if not llm:
        return

    try:
        full_messages = [SystemMessage(content=system_prompt)] + [
            HumanMessage(content=m.get("content", ""))
            for m in messages
        ]
        async for chunk in llm.astream(full_messages):
            if chunk.content:
                yield "answer", chunk.content

            if hasattr(chunk, 'additional_kwargs') and chunk.additional_kwargs:
                reasoning = chunk.additional_kwargs.get('reasoning_content')
                if reasoning:
                    yield "thinking", reasoning
    except Exception as e:
        logger.warning("LLM stream with thinking call failed: %s", e)


def build_system_prompt(data_summary: str) -> str:
    return f"""你是 OntoNexus 智能决策助手的AI顾问。你专注于医药销售领域的认知决策支持。

当前系统数据概要：
{data_summary}

请基于以上数据，为用户提供专业、准确的建议。回答时请：
1. 引用具体数据支撑你的分析
2. 给出可操作的建议
3. 如有风险，明确指出
4. 保持简洁专业"""
