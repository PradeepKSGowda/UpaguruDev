"""Deterministic 7-Stage Exam Normalization Pipeline.

Resolves varied raw document headers and titles into canonical Exam Masters
while strictly protecting against false-positive merges across similarly named exams
(e.g., Civil Services vs Engineering Services vs Combined Medical Services).
"""

import re
import unicodedata
from typing import Optional
from crawler.core.models import ResolvedExamCandidate


class ExamNormalizer:
    """7-stage exam title normalizer and canonical Exam Master resolver."""

    # Stage 3: Suffix / Stage patterns to strip from exam name while capturing context
    STAGE_STRIP_PATTERNS = [
        re.compile(r"[\(\[\{]\s*(?:Preliminary|Prelims|Prelim|Mains?|Main|Tier[\s\-]*[I|II|1|2]|CBT[\s\-]*[1|2]|Stage[\s\-]*[1|2]|Interview|Personality\s+Test)\s*[\)\]\}]", re.IGNORECASE),
        re.compile(r"\b(?:Preliminary|Prelims|Main|Mains)\s+Examination\b", re.IGNORECASE),
        re.compile(r"\b(?:Tier[\s\-]*[I|II|1|2]|CBT[\s\-]*[1|2])\b", re.IGNORECASE),
        re.compile(r"\b(?:Admit\s+Card|Hall\s+Ticket|Final\s+Result|Marks\s+List|Cut[\s\-]*Off)\b", re.IGNORECASE),
        re.compile(r"\b(?:202[0-9]|203[0-9])\b"),  # Strip years from master name
    ]

    # Stage 4: Abbreviation expansions
    ABBREVIATIONS = {
        "CSE": "Civil Services Examination",
        "CSP": "Civil Services Preliminary",
        "CSM": "Civil Services Main",
        "ESE": "Engineering Services Examination",
        "IFS": "Indian Forest Service Examination",
        "CMS": "Combined Medical Services Examination",
        "NDA": "National Defence Academy",
        "CDS": "Combined Defence Services",
        "CAPF": "Central Armed Police Forces",
        "CGL": "Combined Graduate Level Examination",
        "CHSL": "Combined Higher Secondary Level Examination",
        "MTS": "Multi Tasking Staff Examination",
        "GD": "Constable GD Examination",
        "CPO": "Central Police Organization Examination",
        "NTPC": "Non-Technical Popular Categories Examination",
        "ALP": "Assistant Loco Pilot Examination",
        "JE": "Junior Engineer Examination",
        "KAS": "Gazetted Probationers Examination",
        "KPSC KAS": "Gazetted Probationers Examination",
        "CRP PO": "Common Recruitment Process for Probationary Officers",
        "CRP CLERK": "Common Recruitment Process for Clerks",
        "CRP SO": "Common Recruitment Process for Specialist Officers",
    }

    # Canonical Exam Master Definitions (Org -> Code -> Metadata)
    CANONICAL_EXAMS = {
        "UPSC": {
            "UPSC_CSE": {
                "name": "Civil Services Examination",
                "keywords": ["civil", "services"],
                "anti_keywords": ["engineering", "forest", "medical", "defence", "geologist", "armed"],
                "aliases": ["ias", "ips", "civil services", "cse", "csp", "csm"],
            },
            "UPSC_ESE": {
                "name": "Engineering Services Examination",
                "keywords": ["engineering", "services"],
                "anti_keywords": ["civil", "forest", "medical"],
                "aliases": ["ese", "ies", "engineering services"],
            },
            "UPSC_IFS": {
                "name": "Indian Forest Service Examination",
                "keywords": ["forest", "service"],
                "anti_keywords": ["civil", "engineering", "medical"],
                "aliases": ["ifs", "indian forest service"],
            },
            "UPSC_NDA": {
                "name": "National Defence Academy & Naval Academy Examination",
                "keywords": ["defence", "academy", "naval"],
                "anti_keywords": ["civil", "engineering"],
                "aliases": ["nda", "na"],
            },
            "UPSC_CDS": {
                "name": "Combined Defence Services Examination",
                "keywords": ["combined", "defence", "services"],
                "anti_keywords": ["civil", "engineering", "medical"],
                "aliases": ["cds"],
            },
        },
        "SSC": {
            "SSC_CGL": {
                "name": "Combined Graduate Level Examination",
                "keywords": ["graduate", "level"],
                "anti_keywords": ["higher", "secondary", "multi", "tasking"],
                "aliases": ["cgl", "ssc cgl"],
            },
            "SSC_CHSL": {
                "name": "Combined Higher Secondary Level Examination",
                "keywords": ["higher", "secondary"],
                "anti_keywords": ["graduate", "multi"],
                "aliases": ["chsl", "ssc chsl", "10+2"],
            },
            "SSC_MTS": {
                "name": "Multi Tasking (Non-Technical) Staff Examination",
                "keywords": ["multi", "tasking", "havaldar"],
                "anti_keywords": ["graduate", "higher"],
                "aliases": ["mts", "ssc mts"],
            },
        },
        "RRB": {
            "RRB_NTPC": {
                "name": "Non-Technical Popular Categories Examination",
                "keywords": ["non", "technical", "popular", "ntpc"],
                "anti_keywords": ["alp", "technician", "group d", "junior engineer"],
                "aliases": ["ntpc", "rrb ntpc", "station master", "goods train manager"],
            },
            "RRB_ALP": {
                "name": "Assistant Loco Pilot Examination",
                "keywords": ["loco", "pilot", "alp"],
                "anti_keywords": ["ntpc", "technician"],
                "aliases": ["alp", "assistant loco pilot"],
            },
        },
        "IBPS": {
            "IBPS_PO": {
                "name": "Probationary Officers / Management Trainees (CRP PO/MT)",
                "keywords": ["probationary", "officer", "po/mt", "po"],
                "anti_keywords": ["clerk", "specialist"],
                "aliases": ["ibps po", "crp po", "po/mt"],
            },
            "IBPS_CLERK": {
                "name": "Clerks Common Recruitment Process (CRP Clerks)",
                "keywords": ["clerk", "clerks", "customer service associate"],
                "anti_keywords": ["probationary", "specialist"],
                "aliases": ["ibps clerk", "crp clerks"],
            },
        },
        "KPSC": {
            "KPSC_KAS": {
                "name": "Gazetted Probationers (Group A & B) Examination",
                "keywords": ["gazetted", "probationers", "kas"],
                "anti_keywords": ["fda", "sda", "group c"],
                "aliases": ["kas", "kpsc kas", "gazetted probationers", "group a and b"],
            },
        },
    }

    @classmethod
    def normalize_title(cls, text: str) -> tuple[str, list[str]]:
        """
        Run stages 1 to 4: Unicode normalization, whitespace cleanup,
        suffix stripping, and abbreviation expansion.

        Returns: (cleaned_name, captured_stages_or_context)
        """
        if not text:
            return "", []

        # Stage 1: Unicode normalization (NFKC)
        norm = unicodedata.normalize("NFKC", text)
        norm = norm.replace("–", "-").replace("—", "-").replace("’", "'").replace("‘", "'")

        # Stage 2: Whitespace and control cleanup
        norm = re.sub(r"[\r\n\t]+", " ", norm)
        norm = re.sub(r"\s+", " ", norm).strip()

        # Stage 3: Stage/Artifact Suffix Stripping with Context Capture
        captured_contexts: list[str] = []
        for pattern in cls.STAGE_STRIP_PATTERNS:
            matches = pattern.findall(norm)
            if matches:
                captured_contexts.extend(matches)
                norm = pattern.sub(" ", norm)

        # Stage 4: Abbreviation Expansion
        words = norm.split()
        expanded_words = []
        for w in words:
            clean_w = re.sub(r"[^A-Za-z0-9]", "", w).upper()
            if clean_w in cls.ABBREVIATIONS:
                expanded_words.append(cls.ABBREVIATIONS[clean_w])
            else:
                expanded_words.append(w)
        norm = " ".join(expanded_words)
        norm = re.sub(r"\s+", " ", norm).strip(" ,.-")

        return norm, captured_contexts

    @classmethod
    def resolve_exam(
        cls,
        text: str,
        organization_code: str,
        title: str = "",
    ) -> Optional[ResolvedExamCandidate]:
        """
        Stage 5, 6 & 7: Resolve text/title to a canonical Exam Master using
        discriminative keyword verification.
        """
        combined = f"{title} {text}".lower()
        cleaned_title, captured_context = cls.normalize_title(title or text)
        org_exams = cls.CANONICAL_EXAMS.get(organization_code.upper(), {})

        best_candidate: Optional[ResolvedExamCandidate] = None
        highest_score = 0.0

        for exam_code, data in org_exams.items():
            keywords = data.get("keywords", [])
            anti_keywords = data.get("anti_keywords", [])
            aliases = data.get("aliases", [])

            # Guardrail 7: Strict rejection if anti-keywords present
            if any(anti in combined for anti in anti_keywords):
                continue

            score = 0.0
            reasons = []

            # Alias matching
            for alias in aliases:
                if re.search(rf"\b{re.escape(alias)}\b", combined):
                    score += 50.0
                    reasons.append(f"matched_alias:{alias}")
                    break

            # Keyword matching
            matched_kw_count = sum(1 for kw in keywords if re.search(rf"\b{re.escape(kw)}\b", combined))
            if matched_kw_count == len(keywords) and len(keywords) > 0:
                score += 50.0
                reasons.append(f"matched_all_keywords:{','.join(keywords)}")
            elif matched_kw_count > 0:
                score += (matched_kw_count / len(keywords)) * 40.0
                reasons.append(f"partial_keywords:{matched_kw_count}/{len(keywords)}")

            if score > highest_score and score >= 40.0:
                highest_score = score
                best_candidate = ResolvedExamCandidate(
                    exam_code=exam_code,
                    canonical_name=data["name"],
                    confidence=min(100.0, score),
                    matched_alias=reasons[0] if reasons else None,
                    stages=captured_context,
                    reasons=reasons,
                )

        return best_candidate
