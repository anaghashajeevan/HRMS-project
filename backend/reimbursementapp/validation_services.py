from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from .models import BillExtraction, ExpenseItem, ExpenseValidation, ReimbursementClaim
from .ocr_services import find_claimed_amount_by_sum, find_claimed_amount_in_ocr


AMOUNT_TOLERANCE = Decimal("1.00")


def _latest_attachment(expense_item: ExpenseItem):
    prefetched = getattr(expense_item, "prefetched_attachments", None)
    if prefetched is not None:
        return prefetched[0] if prefetched else None
    return expense_item.attachments.select_related("extraction").order_by("-uploaded_at").first()


def validate_expense_item(expense_item: ExpenseItem) -> ExpenseValidation:
    validation, _ = ExpenseValidation.objects.get_or_create(expense_item=expense_item)
    validation.claimed_amount = expense_item.claimed_amount
    validation.claimed_date = expense_item.expense_date
    validation.extracted_amount = None
    validation.amount_difference = None
    validation.extracted_date = None
    validation.message = ""

    attachment = _latest_attachment(expense_item)
    if not attachment:
        validation.status = ExpenseValidation.Status.MISSING_BILL
        validation.message = "No bill or invoice is attached to this expense item."
    else:
        extraction = getattr(attachment, "extraction", None)
        if not extraction:
            validation.status = ExpenseValidation.Status.OCR_PENDING
            validation.message = "Bill is attached, but OCR has not been run yet."
        elif extraction.status in {BillExtraction.Status.FAILED, BillExtraction.Status.UNSUPPORTED}:
            validation.status = ExpenseValidation.Status.OCR_FAILED
            validation.message = extraction.error_message or "OCR did not complete successfully for the attached bill."
        elif extraction.status != BillExtraction.Status.COMPLETED:
            validation.status = ExpenseValidation.Status.OCR_PENDING
            validation.message = "OCR is still pending for the attached bill."
        else:
            matched_amount = None
            direct_extracted_amount = extraction.extracted_amount
            validation.extracted_date = extraction.extracted_date

            if direct_extracted_amount is not None and abs(expense_item.claimed_amount - direct_extracted_amount) <= AMOUNT_TOLERANCE:
                matched_amount = direct_extracted_amount
                validation.message = "Claimed amount matches the attached bill."
            else:
                raw_text = extraction.raw_text or ""
                raw_text_match = find_claimed_amount_in_ocr(raw_text, expense_item.claimed_amount, AMOUNT_TOLERANCE)
                if raw_text_match is not None:
                    matched_amount = raw_text_match
                    validation.message = "Claimed amount matched against OCR raw text/candidate amounts."
                else:
                    sum_match = find_claimed_amount_by_sum(raw_text, expense_item.claimed_amount, AMOUNT_TOLERANCE)
                    if sum_match is not None:
                        matched_amount = sum_match
                        validation.message = "Claimed amount matched against OCR raw text/candidate amounts."

            if matched_amount is not None:
                validation.extracted_amount = matched_amount
                validation.amount_difference = abs(expense_item.claimed_amount - matched_amount)

                if extraction.extracted_amount != matched_amount:
                    extraction.extracted_amount = matched_amount
                    extraction.save(update_fields=["extracted_amount", "updated_at"])

                if expense_item.expense_date and extraction.extracted_date:
                    if expense_item.expense_date == extraction.extracted_date:
                        validation.status = ExpenseValidation.Status.MATCHED
                        if "OCR raw text" in validation.message:
                            validation.message = (
                                "Claimed amount matched against OCR raw text/candidate amounts. "
                                "Bill date also matches the claimed date."
                            )
                        else:
                            validation.message = "Claimed amount and bill date match the attached bill."
                    else:
                        validation.status = ExpenseValidation.Status.DATE_MISMATCH
                        validation.message = "Amount matched, but bill date differs from the claimed date."
                elif expense_item.expense_date and not extraction.extracted_date:
                    validation.status = ExpenseValidation.Status.MATCHED
                    if "OCR raw text" in validation.message:
                        validation.message = (
                            "Claimed amount matched against OCR raw text/candidate amounts. "
                            "Bill date was not extracted."
                        )
                    else:
                        validation.message = "Claimed amount matches the attached bill. Bill date was not extracted."
                else:
                    validation.status = ExpenseValidation.Status.MATCHED
                    if validation.message == "":
                        validation.message = "Claimed amount matches the attached bill."
            else:
                validation.extracted_amount = direct_extracted_amount
                if direct_extracted_amount is not None:
                    validation.amount_difference = abs(expense_item.claimed_amount - direct_extracted_amount)
                validation.status = ExpenseValidation.Status.NEEDS_REVIEW
                validation.message = "OCR completed, but no reliable matching amount was found."

    validation.checked_at = timezone.now()
    validation.save()
    return validation


def validate_claim_expenses(claim: ReimbursementClaim) -> dict:
    expense_items = list(
        claim.expense_items.prefetch_related("attachments__extraction").order_by("id")
    )
    validations = [validate_expense_item(expense_item) for expense_item in expense_items]

    mismatched_statuses = {
        ExpenseValidation.Status.AMOUNT_MISMATCH,
        ExpenseValidation.Status.DATE_MISMATCH,
        ExpenseValidation.Status.OCR_FAILED,
    }
    needs_review_statuses = {
        ExpenseValidation.Status.NEEDS_REVIEW,
        ExpenseValidation.Status.OCR_PENDING,
        ExpenseValidation.Status.PENDING,
    }

    return {
        "claim_id": claim.id,
        "total_items": len(validations),
        "matched": sum(validation.status == ExpenseValidation.Status.MATCHED for validation in validations),
        "mismatched": sum(validation.status in mismatched_statuses for validation in validations),
        "missing_bill": sum(validation.status == ExpenseValidation.Status.MISSING_BILL for validation in validations),
        "needs_review": sum(validation.status in needs_review_statuses for validation in validations),
    }


def validate_all_expenses() -> dict:
    expense_items = ExpenseItem.objects.prefetch_related("attachments__extraction").all()
    validations = [validate_expense_item(expense_item) for expense_item in expense_items]

    return {
        "total_items": len(validations),
        "matched": sum(validation.status == ExpenseValidation.Status.MATCHED for validation in validations),
        "mismatched": sum(
            validation.status in {
                ExpenseValidation.Status.AMOUNT_MISMATCH,
                ExpenseValidation.Status.DATE_MISMATCH,
                ExpenseValidation.Status.OCR_FAILED,
            }
            for validation in validations
        ),
        "missing_bill": sum(validation.status == ExpenseValidation.Status.MISSING_BILL for validation in validations),
        "needs_review": sum(
            validation.status in {
                ExpenseValidation.Status.NEEDS_REVIEW,
                ExpenseValidation.Status.OCR_PENDING,
                ExpenseValidation.Status.PENDING,
            }
            for validation in validations
        ),
    }
