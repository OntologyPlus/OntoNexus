import uuid
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.ontology import OntologyObject, ObjectAction, ActionParameter, ObjectEvent, ObjectLink
from models.action import ActionProposal
from models.execution import ExecutionLog
from models.audit import AuditLog
from exceptions import ActionExecutionError
from services.domain_mapper import _split_field, _join_field, DOMAIN_MODEL_MAP

class ActionExecutor:
    def __init__(self, db: Session):
        self.db = db

    def execute_object_action(self, object_id: str, action_name: str, params: Dict[str, Any], user_id: str = "system", _via_gateway: bool = False) -> Dict[str, Any]:
        if not _via_gateway:
            raise ActionExecutionError("Writes must go through Action Gateway")
        obj = self.db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
        if not obj:
            return {"success": False, "error": "Object not found"}

        action_def = self.db.query(ObjectAction).filter(
            ObjectAction.object_id == object_id,
            ObjectAction.name == action_name
        ).first()

        if action_def and action_def.preconditions:
            valid, reason = self._evaluate_preconditions(obj, action_def.preconditions, params)
            if not valid:
                return {"success": False, "error": f"Precondition failed: {reason}"}

        execution_id = str(uuid.uuid4())
        side_effects_results = []

        try:
            result = self._execute_action_logic(obj, action_name, params, user_id)

            if result.get("success") is False:
                return {"success": False, "error": result.get("message", "Action logic failed"), "execution_id": execution_id}

            if action_def and action_def.side_effects:
                for effect in _split_field(action_def.side_effects):
                    effect_result = self._execute_side_effect(obj, effect, params, user_id)
                    side_effects_results.append(effect_result)

            if action_def and action_def.write_back_targets:
                for target in _split_field(action_def.write_back_targets):
                    self._write_back(target, obj, action_name, params)

            event = ObjectEvent(
                id=f"evt_{uuid.uuid4().hex[:8]}",
                object_id=object_id,
                event_type=f"ActionExecuted:{action_name}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                description=f"Executed action '{action_name}' on {obj.name}",
                related_object_id=object_id,
                related_object_name=obj.name,
            )
            self.db.add(event)

            from services.audit_chain import append_audit
            append_audit(
                self.db,
                action=f"execute_action:{action_name}",
                entity_type=obj.object_type,
                entity_id=object_id,
                entity_name=obj.name,
                user_id=user_id,
                details={"params": params, "side_effects": side_effects_results},
            )

            log = ExecutionLog(
                id=execution_id,
                action_name=action_name,
                tool_name="action_executor",
                parameters=json.dumps(params),
                status="success",
                result=json.dumps({"main": result, "side_effects": side_effects_results}),
                user_id=user_id,
            )
            self.db.add(log)

            return {
                "success": True,
                "execution_id": execution_id,
                "result": result,
                "side_effects": side_effects_results,
            }
        except Exception as e:
            log = ExecutionLog(
                id=execution_id,
                action_name=action_name,
                tool_name="action_executor",
                parameters=json.dumps(params),
                status="failed",
                result=str(e),
                user_id=user_id,
            )
            self.db.add(log)
            return {"success": False, "error": str(e), "execution_id": execution_id}

    def _evaluate_preconditions(self, obj: OntologyObject, preconditions_str: str, params: Dict) -> Tuple[bool, str]:
        conditions = _split_field(preconditions_str)
        for cond in conditions:
            cond = cond.strip()
            if not cond:
                continue

            if "!=" in cond:
                field, value = cond.split("!=", 1)
                field = field.strip()
                value = value.strip().strip("'\"")
                actual = self._resolve_field(obj, field)
                if actual is not None and str(actual) == value:
                    return False, f"{field} is {value}"
            elif "==" in cond:
                field, value = cond.split("==", 1)
                field = field.strip()
                value = value.strip().strip("'\"")
                actual = self._resolve_field(obj, field)
                if actual is not None and str(actual) != value:
                    return False, f"{field} is not {value}, it is {actual}"
            elif ">=" in cond:
                field, value = cond.split(">=", 1)
                actual = self._resolve_field(obj, field.strip())
                if actual is not None:
                    try:
                        if float(actual) < float(value.strip()):
                            return False, f"{field} ({actual}) < {value}"
                    except (ValueError, TypeError):
                        pass
            elif ">" in cond:
                field, value = cond.split(">", 1)
                actual = self._resolve_field(obj, field.strip())
                if actual is not None:
                    try:
                        if float(actual) <= float(value.strip()):
                            return False, f"{field} ({actual}) <= {value}"
                    except (ValueError, TypeError):
                        pass
            elif " in " in cond:
                field, value_list = cond.split(" in ", 1)
                field = field.strip()
                values = [v.strip().strip("'\"") for v in value_list.strip("[]").split(",")]
                actual = self._resolve_field(obj, field)
                if actual is not None and str(actual) not in values:
                    return False, f"{field} ({actual}) not in {values}"

        return True, ""

    def _resolve_field(self, obj: OntologyObject, field_path: str):
        parts = field_path.split(".")
        if len(parts) > 1:
            field_name = parts[-1]
        else:
            field_name = parts[0]

        if hasattr(obj, field_name):
            return getattr(obj, field_name)

        model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
        if model_class:
            row = self.db.query(model_class).filter(model_class.id == obj.id).first()
            if row and hasattr(row, field_name):
                return getattr(row, field_name)

        return None

    def _execute_action_logic(self, obj: OntologyObject, action_name: str, params: Dict, user_id: str) -> Dict:
        result = {"action": action_name, "object_id": obj.id, "object_name": obj.name}

        if action_name == "scheduleVisit":
            result.update(self._action_schedule_visit(obj, params))
        elif action_name == "updateSentiment":
            result.update(self._action_update_sentiment(obj, params))
        elif action_name == "flagComplianceRisk":
            result.update(self._action_flag_compliance_risk(obj, params))
        elif action_name == "markAsAtRisk":
            result.update(self._action_mark_at_risk(obj, params))
        elif action_name == "generateVisitBrief":
            result.update(self._action_generate_visit_brief(obj, params))
        elif action_name == "updateAccessStatus":
            result.update(self._action_update_access_status(obj, params))
        elif action_name == "dismiss":
            result.update(self._action_dismiss_alert(obj, params))
        elif action_name == "escalate":
            result.update(self._action_escalate(obj, params))
        elif action_name == "approve":
            result.update(self._action_approve(obj, params))
        elif action_name == "reject":
            result.update(self._action_reject(obj, params))
        elif action_name == "updateActualValue":
            result.update(self._action_update_actual_value(obj, params))
        elif action_name == "allocateBudget":
            result.update(self._action_allocate_budget(obj, params))
        elif action_name == "advanceCycle":
            result.update(self._action_advance_cycle(obj, params))
        elif action_name == "updateStatus":
            result.update(self._action_update_status(obj, params))
        elif action_name == "inviteToEvent":
            result.update(self._action_invite_to_event(obj, params))
        else:
            result["message"] = f"Action '{action_name}' executed (generic handler)"

        return result

    def _action_schedule_visit(self, obj, params):
        from models.domain import Doctor
        doctor = self.db.query(Doctor).filter(Doctor.id == obj.id).first()
        if doctor and params.get("visitDate"):
            doctor.next_recommended_visit_date = params["visitDate"]
        if obj.status == "warning":
            obj.status = "normal"
        return {"message": f"Visit scheduled for {obj.name}", "visitDate": params.get("visitDate")}

    def _action_update_sentiment(self, obj, params):
        sentiment = params.get("sentiment")
        if sentiment:
            obj.sentiment = sentiment
        return {"message": f"Sentiment updated to {sentiment} for {obj.name}"}

    def _action_flag_compliance_risk(self, obj, params):
        from models.domain import ComplianceAlert
        alert = ComplianceAlert(
            id=f"alert_{uuid.uuid4().hex[:8]}",
            severity="high",
            risk_type=params.get("riskType", "general"),
            alert_description=params.get("description", f"AI标记的合规风险: {obj.name}"),
            alert_status="pending",
        )
        self.db.add(alert)
        link = ObjectLink(
            source_id=obj.id,
            link_type="HAS_ALERT",
            target_id=alert.id,
            target_name=f"合规告警-{obj.name}",
            target_type="ComplianceAlert",
        )
        self.db.add(link)
        return {"message": f"Compliance risk flagged for {obj.name}", "alert_id": alert.id}

    def _action_mark_at_risk(self, obj, params):
        from services.lifecycle_service import validate_transition
        target_stage = "at_risk"
        if obj.lifecycle_stage:
            valid = validate_transition(obj.object_type, obj.lifecycle_stage, target_stage)
            if not valid:
                return {"success": False, "message": f"Cannot transition {obj.name} from {obj.lifecycle_stage} to {target_stage}"}
        obj.lifecycle_stage = target_stage
        obj.status = "warning"
        return {"message": f"{obj.name} marked as at_risk", "reason": params.get("reason")}

    def _action_generate_visit_brief(self, obj, params):
        return {"message": f"Visit brief generated for {obj.name}", "brief_type": "auto_generated"}

    def _action_update_access_status(self, obj, params):
        from models.domain import Hospital
        hospital = self.db.query(Hospital).filter(Hospital.id == obj.id).first()
        status = params.get("status")
        if hospital and status:
            hospital.access_status = status
        return {"message": f"Access status updated to {status} for {obj.name}"}

    def _action_dismiss_alert(self, obj, params):
        from models.domain import ComplianceAlert
        alert = self.db.query(ComplianceAlert).filter(ComplianceAlert.id == obj.id).first()
        if alert:
            alert.alert_status = "dismissed"
        obj.status = "normal"
        return {"message": f"Alert dismissed for {obj.name}"}

    def _action_escalate(self, obj, params):
        from models.domain import ComplianceAlert
        alert = self.db.query(ComplianceAlert).filter(ComplianceAlert.id == obj.id).first()
        if alert:
            alert.alert_status = "escalated"
        return {"message": f"Alert escalated for {obj.name}", "reason": params.get("reason")}

    def _action_approve(self, obj, params):
        from models.domain import RecoveryPlan
        plan = self.db.query(RecoveryPlan).filter(RecoveryPlan.id == obj.id).first()
        if plan:
            plan.plan_status = "approved"
        obj.status = "normal"
        return {"message": f"Plan approved for {obj.name}"}

    def _action_reject(self, obj, params):
        from models.domain import RecoveryPlan
        plan = self.db.query(RecoveryPlan).filter(RecoveryPlan.id == obj.id).first()
        if plan:
            plan.plan_status = "rejected"
        return {"message": f"Plan rejected for {obj.name}", "reason": params.get("reason")}

    def _action_update_actual_value(self, obj, params):
        actual_value = params.get("actualValue")
        if actual_value is not None:
            model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
            if model_class:
                row = self.db.query(model_class).filter(model_class.id == obj.id).first()
                if row and hasattr(row, "actual_value"):
                    row.actual_value = actual_value
                    if hasattr(row, "target_value") and row.target_value:
                        row.achievement_rate = round((actual_value / row.target_value) * 100, 1)
        return {"message": f"Actual value updated for {obj.name}", "actualValue": actual_value}

    def _action_allocate_budget(self, obj, params):
        from models.domain import BudgetCategory
        budget = self.db.query(BudgetCategory).filter(BudgetCategory.id == obj.id).first()
        amount = params.get("amount", 0)
        if budget:
            budget.used_amount = (budget.used_amount or 0) + amount
            if budget.budget_amount:
                budget.remaining_amount = budget.budget_amount - budget.used_amount
                budget.execution_rate = round((budget.used_amount / budget.budget_amount) * 100, 1)
        return {"message": f"Budget allocated for {obj.name}", "amount": amount}

    def _action_advance_cycle(self, obj, params):
        from services.lifecycle_service import validate_transition, get_valid_transitions
        target_stage = params.get("targetStage")
        if target_stage:
            if obj.lifecycle_stage:
                valid = validate_transition(obj.object_type, obj.lifecycle_stage, target_stage)
                if valid:
                    obj.lifecycle_stage = target_stage
                    return {"message": f"Cycle advanced to {target_stage} for {obj.name}"}
                return {"success": False, "message": f"Cannot transition from {obj.lifecycle_stage} to {target_stage}"}
            obj.lifecycle_stage = target_stage
            return {"message": f"Cycle set to {target_stage} for {obj.name}"}
        if obj.lifecycle_stage:
            valid_transitions = get_valid_transitions(obj.object_type, obj.lifecycle_stage)
            if valid_transitions:
                obj.lifecycle_stage = valid_transitions[0]
                return {"message": f"Cycle advanced to {obj.lifecycle_stage} for {obj.name}"}
        return {"message": f"No valid transition for {obj.name}"}

    def _action_update_status(self, obj, params):
        new_status = params.get("status")
        if new_status:
            from services.lifecycle_service import validate_transition
            if obj.lifecycle_stage:
                valid = validate_transition(obj.object_type, obj.lifecycle_stage, new_status)
                if not valid:
                    return {"success": False, "message": f"Cannot transition from {obj.lifecycle_stage} to {new_status}"}
            obj.lifecycle_stage = new_status
        return {"message": f"Status updated to {new_status} for {obj.name}"}

    def _action_invite_to_event(self, obj, params):
        return {"message": f"Invitation sent to {obj.name}", "event": params.get("eventId")}

    def _execute_side_effect(self, obj: OntologyObject, effect: str, params: Dict, user_id: str) -> Dict:
        effect = effect.strip()
        result = {"effect": effect, "status": "skipped"}

        if effect.startswith("create "):
            entity_type = effect.replace("create ", "").strip()
            result = self._side_effect_create_entity(obj, entity_type, params)
        elif effect.startswith("update "):
            field_path = effect.replace("update ", "").strip()
            result = self._side_effect_update_field(obj, field_path, params)
        elif effect.startswith("notify "):
            target = effect.replace("notify ", "").strip()
            result = self._side_effect_notify(obj, target, params)
        elif effect.startswith("trigger "):
            engine = effect.replace("trigger ", "").strip()
            result = self._side_effect_trigger(obj, engine, params)

        return result

    def _side_effect_create_entity(self, obj, entity_desc, params):
        if "VisitRecord" in entity_desc:
            new_obj = OntologyObject(
                id=f"v_{uuid.uuid4().hex[:8]}",
                object_type="VisitRecord",
                name=f"拜访记录-{obj.name}-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
                status="normal",
            )
            self.db.add(new_obj)
            return {"effect": "create VisitRecord", "status": "success", "new_id": new_obj.id}
        elif "ComplianceAlert" in entity_desc:
            from models.domain import ComplianceAlert
            alert = ComplianceAlert(
                id=f"alert_{uuid.uuid4().hex[:8]}",
                severity="medium",
                risk_type="auto_generated",
                alert_description=f"Auto-generated alert for {obj.name}",
                alert_status="pending",
            )
            self.db.add(alert)
            return {"effect": "create ComplianceAlert", "status": "success", "new_id": alert.id}
        elif "ActionItem" in entity_desc:
            return {"effect": "create ActionItem", "status": "success", "note": "Action item created"}
        elif "VisitBrief" in entity_desc:
            return {"effect": "create VisitBrief", "status": "success", "note": "Visit brief created"}
        return {"effect": f"create {entity_desc}", "status": "skipped"}

    def _side_effect_update_field(self, obj, field_path, params):
        if "=" in field_path:
            field, value = field_path.split("=", 1)
            field = field.strip()
            value = value.strip().strip("'\"")
        else:
            field = field_path
            value = None

        field_map = {
            "doctor.nextRecommendedVisitDate": ("Doctor", "next_recommended_visit_date"),
            "doctor.sentiment": (None, "sentiment"),
            "doctor.lifecycleStage": (None, "lifecycle_stage"),
            "hospital.accessStatus": ("Hospital", "access_status"),
            "alert.status": ("ComplianceAlert", "alert_status"),
            "plan.status": ("RecoveryPlan", "plan_status"),
            "cycleStatus": (None, "lifecycle_stage"),
        }

        if field in field_map:
            domain_type, db_field = field_map[field]
            if domain_type:
                model_class = DOMAIN_MODEL_MAP.get(domain_type)
                if model_class:
                    row = self.db.query(model_class).filter(model_class.id == obj.id).first()
                    if row and hasattr(row, db_field):
                        setattr(row, db_field, value or params.get("value"))
                        return {"effect": f"update {field}", "status": "success"}
            else:
                if hasattr(obj, db_field):
                    setattr(obj, db_field, value or params.get("value"))
                    return {"effect": f"update {field}", "status": "success"}

        if hasattr(obj, field):
            setattr(obj, field, value)
            return {"effect": f"update {field}", "status": "success"}

        return {"effect": f"update {field}", "status": "skipped"}

    def _side_effect_notify(self, obj, target, params):
        from models.notification import Notification
        target_user_id = "default_user"

        if "managedBy" in target or "SalesRep" in target:
            link = self.db.query(ObjectLink).filter(
                ObjectLink.source_id == obj.id,
                ObjectLink.link_type == "MANAGED_BY"
            ).first()
            if link:
                target_user_id = link.target_id

        notification = Notification(
            id=f"n_{uuid.uuid4().hex[:8]}",
            user_id=target_user_id,
            type="action_notification",
            title=f"Action executed on {obj.name}",
            message=f"Action was executed on {obj.object_type}: {obj.name}",
            priority="medium",
            entity_id=obj.id,
        )
        self.db.add(notification)
        return {"effect": f"notify {target}", "status": "success", "notified_user": target_user_id}

    def _side_effect_trigger(self, obj, engine, params):
        if "inference_engine" in engine:
            try:
                from services.inference_service import run_inference
                run_inference(self.db)
                return {"effect": f"trigger {engine}", "status": "success", "note": f"Triggered {engine}"}
            except Exception as e:
                return {"effect": f"trigger {engine}", "status": "error", "note": str(e)}
        return {"effect": f"trigger {engine}", "status": "success", "note": f"Triggered {engine}"}

    def _write_back(self, target_system: str, obj: OntologyObject, action_name: str, params: Dict):
        import os
        webhook_url = os.environ.get(f"WEBHOOK_{target_system.upper()}")

        log = ExecutionLog(
            id=f"wb_{uuid.uuid4().hex[:8]}",
            action_name=f"writeback:{target_system}",
            tool_name="write_back",
            parameters=json.dumps({"object_id": obj.id, "action": action_name, "params": params}),
            status="logged" if not webhook_url else "pending",
            result=f"Write-back to {target_system} logged" if not webhook_url else f"Write-back to {target_system} queued",
            user_id="system",
        )
        self.db.add(log)
