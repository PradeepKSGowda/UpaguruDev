"""Recruitment Source Adapters Registry and Factory.

Maintains central mapping of organization codes to adapter classes, enabling
plug-and-play addition of new commission adapters (e.g. State PSCs, RBI, SEBI).
"""

from typing import Type
from crawler.adapters.base import RecruitmentSourceAdapter
from crawler.adapters.ibps import IBPSAdapter
from crawler.adapters.kpsc import KPSCAdapter
from crawler.adapters.rrb import RRBAdapter
from crawler.adapters.ssc import SSCAdapter
from crawler.adapters.upsc import UPSCAdapter

SOURCE_ADAPTERS: dict[str, Type[RecruitmentSourceAdapter]] = {
    "UPSC": UPSCAdapter,
    "KPSC": KPSCAdapter,
    "SSC": SSCAdapter,
    "RRB": RRBAdapter,
    "IBPS": IBPSAdapter,
}


def get_adapter(organization_code: str, config: dict | None = None) -> RecruitmentSourceAdapter:
    """Retrieve an initialized adapter instance for the specified organization code."""
    code = organization_code.strip().upper()
    adapter_cls = SOURCE_ADAPTERS.get(code)
    if not adapter_cls:
        raise ValueError(f"No recruitment source adapter registered for organization code '{organization_code}'")
    return adapter_cls(config=config)
