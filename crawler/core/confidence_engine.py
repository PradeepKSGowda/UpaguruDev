"""Confidence Engine for Multi-Signal Evaluation and Decision Routing.

Calculates weighted composite scores (0.0 to 100.0) from deterministic signals,
and maps scores to explicit decision thresholds:
- >= 85.0: AUTO_LINK
- 70.0 - 84.99: REVIEW_RECOMMENDED
- < 70.0: DO_NOT_LINK
"""

from typing import Any
from crawler.core.models import LinkingDecision


class ConfidenceEngine:
    """Evaluates multi-signal weights and gates cycle attachment decisions."""

    AUTO_LINK_THRESHOLD = 85.0
    REVIEW_THRESHOLD = 70.0

    @classmethod
    def evaluate(
        cls,
        signals: dict[str, bool],
        custom_weights: dict[str, float] | None = None,
    ) -> tuple[float, LinkingDecision, list[str]]:
        """
        Calculate composite score, linking decision, and explainable reasons list.

        Args:
            signals: Map of signal identifier to boolean presence
            custom_weights: Optional overrides for signal weights

        Returns:
            (clamped_score, decision, reasons)
        """
        weights: dict[str, float] = {
            "exact_reference_match": 100.0,
            "explicit_text_citation": 95.0,
            "exact_exam_and_year": 90.0,
            "exact_exam_inferred_year": 80.0,
            "alias_and_year": 75.0,
            "stage_compatibility": 20.0,
            "title_similarity": 15.0,
            "conflicting_reference": -100.0,
            "conflicting_year": -90.0,
            "stage_regression": -25.0,
        }

        if custom_weights:
            weights.update(custom_weights)

        score = 0.0
        reasons: list[str] = []

        for signal_name, is_present in signals.items():
            if is_present and signal_name in weights:
                weight = weights[signal_name]
                score += weight
                reasons.append(f"{signal_name}:{weight:+.1f}")

        # Clamp score between 0.0 and 100.0
        clamped_score = max(0.0, min(100.0, score))

        if clamped_score >= cls.AUTO_LINK_THRESHOLD:
            decision = LinkingDecision.AUTO_LINK
        elif clamped_score >= cls.REVIEW_THRESHOLD:
            decision = LinkingDecision.REVIEW_RECOMMENDED
        else:
            decision = LinkingDecision.DO_NOT_LINK

        return clamped_score, decision, reasons
