"""Crawler Adapters Package Barrel Exports."""

from .base import RecruitmentSourceAdapter
from .registry import SOURCE_ADAPTERS, get_adapter
from .upsc import UPSCAdapter
from .kpsc import KPSCAdapter
from .ssc import SSCAdapter
from .rrb import RRBAdapter
from .ibps import IBPSAdapter

__all__ = [
    "RecruitmentSourceAdapter",
    "SOURCE_ADAPTERS",
    "get_adapter",
    "UPSCAdapter",
    "KPSCAdapter",
    "SSCAdapter",
    "RRBAdapter",
    "IBPSAdapter",
]
