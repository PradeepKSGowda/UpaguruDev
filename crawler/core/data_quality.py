"""Automated Data Quality and Consistency Validator.

Audits cycle timeline events and field revisions against chronological
and logical invariants, emitting actionable review flags on violations.
"""

from typing import Any


class DataQualityValidator:
    """Enforces data consistency invariants on Exam Cycle updates."""

    @classmethod
    def validate_cycle(
        cls,
        events: list[dict[str, Any]],
        field_versions: list[dict[str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Run all data quality rules against current cycle events and field versions.

        Returns list of detected violations with severity and explanation.
        """
        violations: list[dict[str, Any]] = []
        current_events = [e for e in events if e.get("is_current", True)]

        # Rule 1: Application Close < Application Open
        app_open = next((e for e in current_events if e.get("event_type") == "APPLICATION_OPEN"), None)
        app_close = next((e for e in current_events if e.get("event_type") == "APPLICATION_CLOSE"), None)

        if app_open and app_close:
            open_dt = app_open.get("start_datetime")
            close_dt = app_close.get("end_datetime") or app_close.get("start_datetime")
            if open_dt and close_dt and close_dt < open_dt:
                violations.append({
                    "rule": "INVALID_DATE_ORDER",
                    "severity": "HIGH",
                    "message": f"Application deadline ({close_dt}) is earlier than application open ({open_dt})",
                    "event_ids": [app_open.get("id"), app_close.get("id")],
                })

        # Rule 2: Result before Exam date for the same stage
        stage_exams: dict[str, str] = {}
        stage_results: dict[str, str] = {}

        for e in current_events:
            stage = (e.get("stage") or "GENERAL").upper()
            ev_type = e.get("event_type", "")
            dt_str = e.get("start_datetime") or e.get("end_datetime")

            if ("EXAM" in ev_type or "CBT" in ev_type) and dt_str:
                stage_exams[stage] = dt_str
            elif ("RESULT" in ev_type) and dt_str:
                stage_results[stage] = dt_str

        for stage, exam_dt in stage_exams.items():
            if stage in stage_results:
                res_dt = stage_results[stage]
                if res_dt < exam_dt:
                    violations.append({
                        "rule": "RESULT_BEFORE_EXAM",
                        "severity": "HIGH",
                        "message": f"Stage {stage} result ({res_dt}) is before exam date ({exam_dt})",
                    })

        # Rule 3: Conflicting current events
        seen_keys: set[tuple[str, str]] = set()
        for e in current_events:
            key = (e.get("event_type", ""), (e.get("stage") or "").upper())
            if key in seen_keys:
                violations.append({
                    "rule": "CONFLICTING_CURRENT_EVENTS",
                    "severity": "HIGH",
                    "message": f"Multiple is_current=True events for {key[0]} stage {key[1]}",
                })
            else:
                seen_keys.add(key)

        # Rule 4: Vacancy change > 50% or drop to 0
        if field_versions:
            vacancy_versions = [v for v in field_versions if v.get("field_name") == "total_vacancies"]
            for v in vacancy_versions:
                old_val = v.get("old_value_json")
                new_val = v.get("new_value_json")
                if isinstance(old_val, (int, float)) and isinstance(new_val, (int, float)):
                    if new_val == 0 and old_val > 0:
                        violations.append({
                            "rule": "VACANCY_DROPPED_TO_ZERO",
                            "severity": "HIGH",
                            "message": f"Vacancies changed from {old_val} to 0",
                        })
                    elif old_val > 0 and abs(new_val - old_val) / old_val > 0.5:
                        violations.append({
                            "rule": "SIGNIFICANT_VACANCY_CHANGE",
                            "severity": "MEDIUM",
                            "message": f"Vacancies changed by >50%: from {old_val} to {new_val}",
                        })

        return violations
