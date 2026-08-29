"""Separation of duties: submitter != final approver."""

from __future__ import annotations

from typing import Optional


class SoDViolation(Exception):
    def __init__(self, message: str = "提交人不得终审（HR-003）。请让经理在工作台审批。"):
        self.message = message
        super().__init__(self.message)


def check_sod(submitter_id: Optional[str], approver_id: Optional[str]) -> None:
    if not submitter_id or not approver_id:
        return
    if submitter_id == approver_id:
        raise SoDViolation()
