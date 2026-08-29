import os
from typing import Dict, Any, Optional, Type
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


def check_llm_configured() -> bool:
    return bool(os.environ.get("LLM_API_KEY"))


def get_llm(temperature: float = 0.2) -> Optional[ChatOpenAI]:
    if not check_llm_configured():
        return None
    api_url = os.environ.get("LLM_API_URL")
    base_url = api_url.replace("/chat/completions", "") if api_url.endswith("/chat/completions") else api_url
    return ChatOpenAI(
        model=os.environ.get("LLM_MODEL"),
        api_key=os.environ.get("LLM_API_KEY"),
        base_url=base_url,
        temperature=temperature,
        max_tokens=int(os.environ.get("LLM_MAX_TOKENS", "4096")),
    )


class GuardrailsConfig:
    def __init__(self):
        self.max_length = int(os.environ.get("LLM_MAX_OUTPUT_LENGTH", "2000"))
        self.forbidden_keywords = [
            "我不能", "无法提供", "作为AI", "as an AI",
            "I cannot", "I'm sorry",
        ]

    def validate(self, output: str) -> tuple[bool, str]:
        if not output:
            return False, "Empty output"
        if len(output) > self.max_length:
            return False, f"Output exceeds max length ({self.max_length})"
        for kw in self.forbidden_keywords:
            if kw.lower() in output.lower():
                return False, f"Contains forbidden keyword: {kw}"
        return True, "Valid"


guardrails = GuardrailsConfig()


def invoke_with_structured_output(
    system_prompt: str,
    user_prompt: str,
    response_model: Optional[Type[BaseModel]] = None,
    max_retries: int = 2,
) -> Dict[str, Any]:
    """使用结构化输出调用 LLM，并进行 Guardrails 验证。

    Args:
        system_prompt: 系统提示词
        user_prompt: 用户输入
        response_model: Pydantic 模型用于结构化输出
        max_retries: 最大重试次数

    Returns:
        包含响应结果的字典，如果失败返回 {"error": "...", "fallback": True}
    """
    llm = get_llm()
    if not llm:
        return {"error": "LLM not configured", "fallback": True}

    for attempt in range(max_retries):
        try:
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ]

            if response_model:
                llm_with_struct = llm.with_structured_output(response_model)
                response = llm_with_struct.invoke(messages)
                if isinstance(response, BaseModel):
                    result = response.model_dump()
                else:
                    result = response
            else:
                response = llm.invoke(messages)
                result = {"content": response.content}

            # Guardrails 验证
            content_str = str(result.get("content", result))
            is_valid, reason = guardrails.validate(content_str)
            if is_valid:
                return result
            else:
                raise ValueError(f"Guardrails validation failed: {reason}")

        except Exception as e:
            if attempt == max_retries - 1:
                return {
                    "error": f"LLM call failed after {max_retries} attempts: {str(e)}",
                    "fallback": True,
                }

    return {"error": "Unknown error", "fallback": True}


def safe_invoke(
    system_prompt: str,
    user_prompt: str,
    fallback_message: str = "[System] Unable to generate response at this time.",
) -> str:
    """安全地调用 LLM，失败时返回 fallback 消息。"""
    result = invoke_with_structured_output(system_prompt, user_prompt)
    if result.get("fallback"):
        return fallback_message
    return result.get("content", fallback_message)
