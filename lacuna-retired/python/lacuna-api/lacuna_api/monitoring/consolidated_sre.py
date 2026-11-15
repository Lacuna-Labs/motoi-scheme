"""
Consolidated SRE Dashboard Backend
===================================
FastAPI endpoints for SRE monitoring, cohort pattern review,
cart telemetry, and escalation observability.

All routes async, honest-null on external service failure.
Admin-only via existing SSO gate (LOAM-IMPL-SRE-3b).
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from enum import Enum

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

# Internal auth gate (LOAM-IMPL-SRE-3b)
from lacuna_api.auth.gates import require_admin_user
from lacuna_api.clients.loam_client import LoamClient
from lacuna_api.clients.cortex_client import CortexClient
from lacuna_api.clients.merchant_client import MerchantClient
from lacuna_api.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitoring", tags=["monitoring"])


# ============================================================================
# Models
# ============================================================================


class CohortPatternStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    DEFERRED = "deferred"


class CohortPattern(BaseModel):
    id: str
    intent_signature: str
    exemplar_queries: List[str]
    k_count: int
    confidence: float
    detected_at: datetime
    status: CohortPatternStatus


class ApproveRequest(BaseModel):
    cart_name: str = Field(..., description="Canonical cart name to create")
    cart_description: str
    operator_notes: Optional[str] = None


class RejectRequest(BaseModel):
    reason: str
    anti_pattern_tag: Optional[str] = None


class DeferRequest(BaseModel):
    target_k_count: int
    operator_notes: Optional[str] = None


class CartTelemetry(BaseModel):
    cart_id: str
    cart_name: str
    total_invocations: int
    success_rate: float
    p50_latency_ms: float
    p95_latency_ms: float
    last_7d_count: int


class CartHealthIssue(BaseModel):
    cart_id: str
    cart_name: str
    issue_type: str
    severity: str
    description: str
    first_seen: datetime
    occurrences: int


class IntentGap(BaseModel):
    gap_id: str
    intent_description: str
    sample_queries: List[str]
    frequency: int
    first_detected: datetime
    potential_coverage: Optional[str] = None


class EscalationEvent(BaseModel):
    event_id: str
    timestamp: datetime
    session_id: str
    escalation_reason: str
    sakura_context: Dict[str, Any]
    resolved: bool
    resolution_notes: Optional[str] = None


class ComposeChainHealth(BaseModel):
    chain_pattern: str
    total_attempts: int
    success_rate: float
    avg_steps: float
    common_failure_point: Optional[str] = None


class ManualCoverageItem(BaseModel):
    cart_id: str
    cart_name: str
    has_description: bool
    has_examples: bool
    has_constraints: bool
    completeness_score: float
    last_updated: Optional[datetime] = None


class RephraseAccuracyRecord(BaseModel):
    sample_id: str
    original_doc_text: str
    sakura_rephrase: str
    operator_rating: str  # accurate | minor_issue | major_issue | incorrect
    operator_feedback: Optional[str] = None
    sampled_at: datetime


class SummaryStats(BaseModel):
    pending_cohort_patterns: int
    unhealthy_carts: int
    open_intent_gaps: int
    unresolved_escalations: int
    avg_compose_success_rate: float
    total_carts: int
    carts_with_complete_docs: int


class HonestNull(BaseModel):
    kind: str = "escalate"
    reason: str = "service-not-yet-wired"
    verb: str


# ============================================================================
# Dependency injection
# ============================================================================


async def get_loam_client() -> LoamClient:
    """Inject Loam client."""
    return LoamClient()


async def get_cortex_client() -> CortexClient:
    """Inject Cortex client."""
    return CortexClient()


async def get_merchant_client() -> MerchantClient:
    """Inject Merchant client."""
    return MerchantClient()


# ============================================================================
# Routes
# ============================================================================


@router.get("/cohort-patterns-queue", response_model=List[CohortPattern])
async def cohort_patterns_queue(
    status: Optional[CohortPatternStatus] = CohortPatternStatus.PENDING,
    min_k_count: Optional[int] = None,
    current_user: User = Depends(require_admin_user),
    loam: LoamClient = Depends(get_loam_client),
) -> Any:
    """
    Retrieve pending Loam-detected cohort patterns awaiting SRE review.
    
    Patterns represent clusters of similar user intents that may warrant
    a new canonical cart or existing cart adjustment.
    """
    try:
        patterns_data = await loam.get_cohort_patterns(
            status=status.value if status else None,
            min_k_count=min_k_count,
        )
        
        patterns = [
            CohortPattern(
                id=p["id"],
                intent_signature=p["intent_signature"],
                exemplar_queries=p.get("exemplar_queries", []),
                k_count=p["k_count"],
                confidence=p["confidence"],
                detected_at=datetime.fromisoformat(p["detected_at"]),
                status=CohortPatternStatus(p["status"]),
            )
            for p in patterns_data
        ]
        
        return patterns
        
    except Exception as e:
        logger.error(f"loam/get_cohort_patterns failed: {e}", exc_info=True)
        return [
            HonestNull(verb="loam/get_cohort_patterns").dict()
        ]


@router.post("/cohort-patterns/{pattern_id}/approve", status_code=status.HTTP_201_CREATED)
async def approve_cohort_pattern(
    pattern_id: str,
    req: ApproveRequest,
    current_user: User = Depends(require_admin_user),
    loam: LoamClient = Depends(get_loam_client),
    merchant: MerchantClient = Depends(get_merchant_client),
) -> Dict[str, Any]:
    """
    SRE approves a cohort pattern and creates a canonical cart.
    
    This triggers:
    1. Loam pattern marked as approved
    2. New cart created in merchant catalog
    3. Cortex associate learns the new pattern
    """
    try:
        # Mark pattern as approved in Loam
        await loam.update_cohort_pattern_status(
            pattern_id=pattern_id,
            status="approved",
            operator_id=current_user.id,
            notes=req.operator_notes,
        )
        
        # Retrieve pattern details for cart creation
        pattern = await loam.get_cohort_pattern(pattern_id)
        
        # Create canonical cart in merchant
        cart_result = await merchant.create_cart(
            name=req.cart_name,
            description=req.cart_description,
            intent_signature=pattern["intent_signature"],
            source="sre_cohort_approval",
            metadata={
                "cohort_pattern_id": pattern_id,
                "k_count": pattern["k_count"],
                "approved_by": current_user.id,
                "approved_at": datetime.utcnow().isoformat(),
            },
        )
        
        logger.info(
            f"SRE approved cohort pattern {pattern_id}, created cart {cart_result['cart_id']}",
            extra={
                "pattern_id": pattern_id,
                "cart_id": cart_result["cart_id"],
                "operator_id": current_user.id,
            },
        )
        
        return {
            "pattern_id": pattern_id,
            "cart_id": cart_result["cart_id"],
            "cart_name": req.cart_name,
            "status": "approved",
        }
        
    except Exception as e:
        logger.error(f"cohort pattern approval failed: {e}", exc_info=True)
        return HonestNull(verb="loam/approve_cohort_pattern").dict()


@router.post("/cohort-patterns/{pattern_id}/reject")
async def reject_cohort_pattern(
    pattern_id: str,
    req: RejectRequest,
    current_user: User = Depends(require_admin_user),
    loam: LoamClient = Depends(get_loam_client),
    cortex: CortexClient = Depends(get_cortex_client),
) -> Dict[str, Any]:
    """
    SRE rejects a cohort pattern with reason.
    
    Rejection feeds cortex-associate anti-pattern learning to avoid
    false-positive pattern detection in future.
    """
    try:
        # Mark pattern as rejected in Loam
        await loam.update_cohort_pattern_status(
            pattern_id=pattern_id,
            status="rejected",
            operator_id=current_user.id,
            notes=req.reason,
        )
        
        # Retrieve pattern for anti-pattern learning
        pattern = await loam.get_cohort_pattern(pattern_id)
        
        # Feed to cortex-associate as anti-pattern
        await cortex.register_anti_pattern(
            pattern_type="cohort",
            intent_signature=pattern["intent_signature"],
            reason=req.reason,
            tag=req.anti_pattern_tag,
            metadata={
                "pattern_id": pattern_id,
                "rejected_by": current_user.id,
                "rejected_at": datetime.utcnow().isoformat(),
            },
        )
        
        logger.info(
            f"SRE rejected cohort pattern {pattern_id}: {req.reason}",
            extra={
                "pattern_id": pattern_id,
                "operator_id": current_user.id,
                "reason": req.reason,
            },
        )
        
        return {
            "pattern_id": pattern_id,
            "status": "rejected",
            "reason": req.reason,
        }
        
    except Exception as e:
        logger.error(f"cohort pattern rejection failed: {e}", exc_info=True)
        return HonestNull(verb="loam/reject_cohort_pattern").dict()


@router.post("/cohort-patterns/{pattern_id}/defer")
async def defer_cohort_pattern(
    pattern_id: str,
    req: DeferRequest,
    current_user: User = Depends(require_admin_user),
    loam: LoamClient = Depends(get_loam_client),
) -> Dict[str, Any]:
    """
    SRE defers a cohort pattern pending more K-count (sample size).
    
    Pattern remains in queue but marked as needing more evidence.
    """
    try:
        await loam.update_cohort_pattern_status(
            pattern_id=pattern_id,
            status="deferred",
            operator_id=current_user.id,
            notes=req.operator_notes,
            metadata={
                "target_k_count": req.target_k_count,
            },
        )
        
        logger.info(
            f"SRE deferred cohort pattern {pattern_id}, target K={req.target_k_count}",
            extra={
                "pattern_id": pattern_id,
                "operator_id": current_user.id,
                "target_k_count": req.target_k_count,
            },
        )
        
        return {
            "pattern_id": pattern_id,
            "status": "deferred",
            "target_k_count": req.target_k_count,
        }
        
    except Exception as e:
        logger.error(f"cohort pattern defer failed: {e}", exc_info=True)
        return HonestNull(verb="loam/defer_cohort_pattern").dict()


@router.get("/cart-telemetry", response_model=List[CartTelemetry])
async def cart_telemetry(
    lookback_days: int = 7,
    min_invocations: int = 10,
    current_user: User = Depends(require_admin_user),
    merchant: MerchantClient = Depends(get_merchant_client),
) -> Any:
    """
    Per-cart aggregate statistics: invocation count, success rate, latency percentiles.
    
    Used to identify high-traffic, low-quality carts requiring intervention.
    """
    try:
        telemetry_data = await merchant.get_cart_telemetry(
            start_date=(datetime.utcnow() - timedelta(days=lookback_days)).isoformat(),
            end_date=datetime.utcnow().isoformat(),
            min_invocations=min_invocations,
        )
        
        telemetry = [
            CartTelemetry(
                cart_id=t["cart_id"],
                cart_name=t["cart_name"],
                total_invocations=t["total_invocations"],
                success_rate=t["success_rate"],
                p50_latency_ms=t["p50_latency_ms"],
                p95_latency_ms=t["p95_latency_ms"],
                last_7d_count=t.get("last_7d_count", 0),
            )
            for t in telemetry_data
        ]
        
        return telemetry
        
    except Exception as e:
        logger.error(f"merchant/get_cart_telemetry failed: {e}", exc_info=True)
        return [
            HonestNull(verb="merchant/get_cart_telemetry").dict()
        ]


@router.get("/cart-health", response_model=List[CartHealthIssue])
async def cart_health(
    severity: Optional[str] = None,
    current_user: User = Depends(require_admin_user),
    merchant: MerchantClient = Depends(get_merchant_client),
) -> Any:
    """
    Carts in unhealthy state: high error rate, timeout spikes, dependency failures.
    
    SRE can use this to proactively investigate and remediate cart issues.
    """
    try:
        health_data = await merchant.get_cart_health_issues(severity=severity)
        
        issues = [
            CartHealthIssue(
                cart_id=h["cart_id"],
                cart_name=h["cart_name"],
                issue_type=h["issue_type"],
                severity=h["severity"],
                description=h["description"],
                first_seen=datetime.fromisoformat(h["first_seen"]),
                occurrences=h["occurrences"],
            )
            for h in health_data
        ]
        
        return issues
        
    except Exception as e:
        logger.error(f"merchant/get_cart_health_issues failed: {e}", exc_info=True)
        return [
            HonestNull(verb="merchant/get_cart_health_issues").dict()
        ]


@router.get("/loam-intent-gaps", response_model=List[IntentGap])
async def loam_intent_gaps(
    min_frequency: int = 5,
    current_user: User = Depends(require_admin_user),
    loam: LoamClient = Depends(get_loam_client),
) -> Any:
    """
    Loam-detected unsolved-intent patterns: user queries with no suitable cart match.
    
    Represents product gaps where new capability should be built.
    """
    try:
        gaps_data = await loam.get_intent_gaps(min_frequency=min_frequency)
        
        gaps = [
            IntentGap(
                gap_id=g["gap_id"],
                intent_description=g["intent_description"],
                sample_queries=g["sample_queries"],
                frequency=g["frequency"],
                first_detected=datetime.fromisoformat(g["first_detected"]),
                potential_coverage=g.get("potential_coverage"),
            )
            for g in gaps_data
        ]
        
        return gaps
        
    except Exception as e:
        logger.error(f"loam/get_intent_gaps failed: {e}", exc_info=True)
        return [
            HonestNull(verb="loam/get_intent_gaps").dict()
        ]


@router.get("/escalation-ladder-log", response_model=List[EscalationEvent])
async def escalation_ladder_log(
    unresolved_only: bool = False,
    lookback_days: int = 7,
    current_user: User = Depends(require_admin_user),
    cortex: CortexClient = Depends(get_cortex_client),
) -> Any:
    """
    Sakura's escalate-to-SRE events log.
    
    Shows when Sakura determined human intervention was required, with context.
    """
    try:
        events_data = await cortex.get_escalation_events(
            start_date=(datetime.utcnow() - timedelta(days=lookback_days)).isoformat(),
            end_date=datetime.utcnow().isoformat(),
            unresolved_only=unresolved_only,
        )
        
        events = [
            EscalationEvent(
                event_id=e["event_id"],
                timestamp=datetime.fromisoformat(e["timestamp"]),
                session_id=e["session_id"],
                escalation_reason=e["escalation_reason"],
                sakura_context=e["sakura_context"],
                resolved=e["resolved"],
                resolution_notes=e.get("resolution_notes"),
            )
            for e in events_data
        ]
        
        return events
        
    except Exception as e:
        logger.error(f"cortex/get_escalation_events failed: {e}", exc_info=True)
        return [
            HonestNull(verb="cortex/get_escalation_events").dict()
        ]


@router.get("/compose-chain-health", response_model=List[ComposeChainHealth])
async def compose_chain_health(
    min_attempts: int = 20,
    current_user: User = Depends(require_admin_user),
    cortex: CortexClient = Depends(get_cortex_client),
) -> Any:
    """
    Composition chain success rates.
    
    Shows which multi-cart composition patterns succeed/fail, and where.
    """
    try:
        chain_data = await cortex.get_compose_chain_health(min_attempts=min_attempts)
        
        chains = [
            ComposeChainHealth(
                chain_pattern=c["chain_pattern"],
                total_attempts=c["total_attempts"],
                success_rate=c["success_rate"],
                avg_steps=c["avg_steps"],
                common_failure_point=c.get("common_failure_point"),
            )
            for c in chain_data
        ]
        
        return chains
        
    except Exception as e:
        logger.error(f"cortex/get_compose_chain_health failed: {e}", exc_info=True)
        return [
            HonestNull(verb="cortex/get_compose_chain_health").dict()
        ]


@router.get("/manual-coverage", response_model=List[ManualCoverageItem])
async def manual_coverage(
    incomplete_only: bool = False,
    current_user: User = Depends(require_admin_user),
    merchant: MerchantClient = Depends(get_merchant_client),
) -> Any:
    """
    Which carts have complete manual documentation.
    
    Tracks description, examples, constraints completeness per cart.
    """
    try:
        coverage_data = await merchant.get_manual_coverage(incomplete_only=incomplete_only)
        
        coverage = [
            ManualCoverageItem(
                cart_id=c["cart_id"],
                cart_name=c["cart_name"],
                has_description=c["has_description"],
                has_examples=c["has_examples"],
                has_constraints=c["has_constraints"],
                completeness_score=c["completeness_score"],
                last_updated=datetime.fromisoformat(c["last_updated"]) if c.get("last_updated") else None,
            )
            for c in coverage_data
        ]
        
        return coverage
        
    except Exception as e:
        logger.error(f"merchant/get_manual_coverage failed: {e}", exc_info=True)
        return [
            HonestNull(verb="merchant/get_manual_coverage").dict()
        ]


@router.get("/rephrase-accuracy", response_model=List[RephraseAccuracyRecord])
async def rephrase_accuracy(
    rating_filter: Optional[str] = None,
    current_user: User = Depends(require_admin_user),
    cortex: CortexClient = Depends(get_cortex_client),
) -> Any:
    """
    Sampled operator feedback on Sakura's cart-doc-read accuracy.
    
    Shows when Sakura's rephrasing of cart docs was accurate vs misleading.
    """
    try:
        accuracy_data = await cortex.get_rephrase_accuracy_samples(rating=rating_filter)
        
        records = [
            RephraseAccuracyRecord(
                sample_id=a["sample_id"],
                original_doc_text=a["original_doc_text"],
                sakura_rephrase=a["sakura_rephrase"],
                operator_rating=a["operator_rating"],
                operator_feedback=a.get("operator_feedback"),
                sampled_at=datetime.fromisoformat(a["sampled_at"]),
            )
            for a in accuracy_data
        ]
        
        return records
        
    except Exception as e:
        logger.error(f"cortex/get_rephrase_accuracy_samples failed: {e}", exc_info=True)
        return [
            HonestNull(verb="cortex/get_rephrase_accuracy_samples").dict()
        ]


@router.get("/summary", response_model=SummaryStats)
async def summary(
    current_user: User = Depends(require_admin_user),
    loam: LoamClient = Depends(get_loam_client),
    cortex: CortexClient = Depends(get_cortex_client),
    merchant: MerchantClient = Depends(get_merchant_client),
) -> Any:
    """
    Top-bar summary statistics for SRE dashboard.
    
    Aggregates key metrics across all subsystems.
    """
    try:
        # Gather stats from all services concurrently
        import asyncio
        
        pending_patterns_task = loam.get_cohort_pattern_count(status="pending")
        unhealthy_carts_task = merchant.get_unhealthy_cart_count()
        intent_gaps_task = loam.get_intent_gap_count()
        escalations_task = cortex.get_unresolved_escalation_count()
        compose_success_task = cortex.get_avg_compose_success_rate()
        total_carts_task = merchant.get_total_cart_count()
        complete_docs_task = merchant.get_complete_doc_count()
        
        results = await asyncio.gather(
            pending_patterns_task,
            unhealthy_carts_task,
            intent_gaps_task,
            escalations_task,
            compose_success_task,
            total_carts_task,
            complete_docs_task,
            return_exceptions=True,
        )
        
        # Extract results with fallbacks
        pending_patterns = results[0] if not isinstance(results[0], Exception) else 0
        unhealthy_carts = results[1] if not isinstance(results[1], Exception) else 0
        intent_gaps = results[2] if not isinstance(results[2], Exception) else 0
        escalations = results[3] if not isinstance(results[3], Exception) else 0
        compose_success = results[4] if not isinstance(results[4], Exception) else 0.0
        total_carts = results[5] if not isinstance(results[5], Exception) else 0
        complete_docs = results[6] if not isinstance(results[6], Exception) else 0
        
        return SummaryStats(
            pending_cohort_patterns=pending_patterns,
            unhealthy_carts=unhealthy_carts,
            open_intent_gaps=intent_gaps,
            unresolved_escalations=escalations,
            avg_compose_success_rate=compose_success,
            total_carts=total_carts,
            carts_with_complete_docs=complete_docs,
        )
        
    except Exception as e:
        logger.error(f"summary stats aggregation failed: {e}", exc_info=True)
        return HonestNull(verb="monitoring/summary").dict()
