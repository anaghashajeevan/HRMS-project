from __future__ import annotations

from dataclasses import dataclass
import re
from typing import Callable

from django.conf import settings
from django.utils.module_loading import import_string
from rapidfuzz import fuzz

from .models import ExpenseItem, VendorCategoryRule, get_system_settings


@dataclass(frozen=True)
class ClassificationResult:
    category: str
    purpose: str
    classification_source: str
    confidence: float
    requires_manual_review: bool


CATEGORY_PURPOSE_LABELS = {
    ExpenseItem.Category.TRAVEL: "Travel",
    ExpenseItem.Category.MEAL: "Meal",
    ExpenseItem.Category.HOTEL: "Hotel stay",
    ExpenseItem.Category.OFFICE: "Office purchase",
    ExpenseItem.Category.TELEPHONE: "Telephone or internet",
    ExpenseItem.Category.OTHERS: "Other expense",
}

HEURISTIC_RULES = (
    (ExpenseItem.Category.TRAVEL, ("taxi", "cab", "ride", "trip fare", "transport", "rapido", "uber", "ola")),
    (ExpenseItem.Category.MEAL, ("restaurant", "food", "meal", "lunch", "dinner", "cafe", "swiggy", "zomato")),
    (ExpenseItem.Category.HOTEL, ("hotel", "room stay", "lodging", "accommodation", "oyo")),
    (
        ExpenseItem.Category.OFFICE,
        ("stationery", "office supplies", "printer", "amazon business", "notebook", "usb", "adapter", "hub"),
    ),
    (ExpenseItem.Category.TELEPHONE, ("recharge", "internet", "broadband", "telephone", "mobile bill", "airtel", "jio")),
)


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", (value or "").lower())).strip()


def _purpose(category: str, vendor_name: str) -> str:
    label = CATEGORY_PURPOSE_LABELS.get(category, "Expense")
    vendor = (vendor_name or "").strip()
    return f"{label} - {vendor}"[:255] if vendor else label


def _vendor_rule_match(text: str, vendor_name: str) -> tuple[str, float] | None:
    normalized_text = _normalize(f"{vendor_name} {text}")
    if not normalized_text:
        return None

    best_match: tuple[str, float, int] | None = None
    for rule in VendorCategoryRule.objects.filter(is_active=True).order_by("match_priority", "vendor_keyword"):
        keyword = _normalize(rule.vendor_keyword)
        if not keyword:
            continue

        if keyword in normalized_text:
            score = 0.99
        else:
            fuzzy_score = fuzz.partial_ratio(keyword, normalized_text)
            if fuzzy_score < 82:
                continue
            score = min(0.95, fuzzy_score / 100)

        candidate = (rule.category, score, rule.match_priority)
        if best_match is None or score > best_match[1] or (
            score == best_match[1] and rule.match_priority < best_match[2]
        ):
            best_match = candidate

    return (best_match[0], best_match[1]) if best_match else None


def _heuristic_match(text: str) -> tuple[str, float] | None:
    normalized_text = _normalize(text)
    for category, keywords in HEURISTIC_RULES:
        matches = []
        for keyword in keywords:
            normalized_keyword = _normalize(keyword)
            keyword_pattern = r"\b" + r"\s+".join(re.escape(part) for part in normalized_keyword.split()) + r"\b"
            if re.search(keyword_pattern, normalized_text):
                matches.append(keyword)
        if matches:
            return category, min(0.88, 0.72 + (0.04 * (len(matches) - 1)))
    return None


def _llm_match(text: str, vendor_name: str) -> tuple[str, str, float] | None:
    provider_path = getattr(settings, "QUICK_CLAIM_LLM_CLASSIFIER", "")
    if not provider_path:
        return None

    provider: Callable[..., dict] = import_string(provider_path)
    response = provider(text=text, vendor_name=vendor_name)
    allowed_categories = {
        ExpenseItem.Category.TRAVEL,
        ExpenseItem.Category.MEAL,
        ExpenseItem.Category.TELEPHONE,
        ExpenseItem.Category.HOTEL,
        ExpenseItem.Category.OFFICE,
        ExpenseItem.Category.OTHERS,
    }
    category = str(response.get("category", "")).strip().upper()
    if category not in allowed_categories:
        return None
    purpose = str(response.get("purpose", "")).strip()[:255] or _purpose(category, vendor_name)
    confidence = max(0.0, min(1.0, float(response.get("confidence", 0.55))))
    return category, purpose, confidence


def classify_expense(
    raw_text: str,
    vendor_name: str = "",
    *,
    confidence_threshold: float | None = None,
    llm_enabled: bool | None = None,
) -> ClassificationResult:
    system_setting = get_system_settings()
    threshold = (
        float(confidence_threshold)
        if confidence_threshold is not None
        else float(system_setting.quick_claim_confidence_threshold)
    )
    use_llm = system_setting.quick_claim_llm_enabled if llm_enabled is None else llm_enabled

    vendor_match = _vendor_rule_match(raw_text, vendor_name)
    if vendor_match:
        category, confidence = vendor_match
        source = ExpenseItem.ClassificationSource.VENDOR_RULE
        purpose = _purpose(category, vendor_name)
    else:
        heuristic_match = _heuristic_match(f"{vendor_name} {raw_text}")
        if heuristic_match:
            category, confidence = heuristic_match
            source = ExpenseItem.ClassificationSource.TEXT_HEURISTIC
            purpose = _purpose(category, vendor_name)
        else:
            llm_match = _llm_match(raw_text, vendor_name) if use_llm else None
            if llm_match:
                category, purpose, confidence = llm_match
                source = ExpenseItem.ClassificationSource.LLM_FALLBACK
            else:
                category = ExpenseItem.Category.OTHERS
                confidence = 0.35
                source = ExpenseItem.ClassificationSource.TEXT_HEURISTIC
                purpose = _purpose(category, vendor_name)

    return ClassificationResult(
        category=category,
        purpose=purpose,
        classification_source=source,
        confidence=round(confidence, 2),
        requires_manual_review=confidence < threshold,
    )
