from django.shortcuts import render
from django.http import FileResponse, HttpResponse

# Create your views here.
"""
DRF views for payroll app.
Phase 2: Configuration CRUD, Salary Assignment, Profile, Preview, Seed.
"""

import calendar
import csv
import re
from io import BytesIO
import logging
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from uuid import UUID, uuid4

from django.db.models import OuterRef, Subquery, Q, F
from django.db import transaction
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from HRMSapp.permissions import IsHRAdmin

from .models import (
    PayrollRun, SalaryComponent, SalaryStructure, SalaryStructureComponent,
    StatutoryRule, PayCalendar, EmployeeSalaryAssignment,
    EmployeePayrollProfile, PayrollRunAdjustment, PayrollRunEmployee,
    PayrollRunComponentDetail, PayrollAuditLog, PayslipRequest, PayslipRequestApprovalAction,
    PaymentBatch, PaymentBatchLine, PayrollRunApprovalAction,
    EmployeeExitRequest, ArrearsLog,
    EmployeeExitClearanceItem, EmployeeExitDocument,
)
from .serializers import (
    SalaryComponentSerializer, SalaryComponentMiniSerializer,
    SalaryStructureListSerializer, SalaryStructureDetailSerializer,
    SalaryStructureCreateSerializer,
    SalaryStructureComponentSerializer,
    StatutoryRuleSerializer,
    PayCalendarSerializer,
    EmployeeSalaryAssignmentSerializer,
    EmployeeSalaryAssignmentCreateSerializer,
    EmployeePayrollProfileSerializer,
    EmployeePayrollProfileListSerializer,
    PreviewBreakdownSerializer, PayrollRunAdjustmentSerializer,
    PayslipRequestSerializer, PayslipRequestCreateSerializer,
    EmployeeExitRequestSerializer,
)
from .services.assignment_service import AssignmentService, AssignmentError
from .services.payslip_service import generate_payslip_pdf
from .services.exit_service import submit_exit_request, decide_exit_request, validate_exit_data, refresh_settlement_snapshot, ExitRequestError
from .services.leave_encashment_service import preview_exit_encashment, LeaveEncashmentError
from .services.full_final_service import preview_full_final, FullFinalError
from .services.arrears_service import (
    preview_assignment_arrears, generate_assignment_arrears, list_arrears, ArrearsError,
    preview_paid_run_arrears, generate_paid_run_arrears,
)
from .services.exit_clearance_service import clearance_payload, log_clearance_change
from .services.exit_document_service import (
    exit_document_status, issue_exit_document, employee_exit_document_payload,
)

logger = logging.getLogger(__name__)


class EmployeeExitRequestListCreateView(APIView):
    """HR register and submission endpoint for employee exit requests."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, 'employee', None)
        scope = request.query_params.get('scope', 'approvals')
        if scope == 'mine':
            if employee is None:
                return Response([])
            qs = EmployeeExitRequest.objects.filter(requested_by=employee)
        elif scope == 'approved':
            if not is_hr_or_system_admin(request.user):
                return Response({'detail': 'HR Admin access is required for the approved exit register.'}, status=403)
            qs = EmployeeExitRequest.objects.filter(status='APPROVED')
        elif scope == 'approvals':
            if employee is None:
                return Response([])
            qs = EmployeeExitRequest.objects.filter(
                status='PENDING_APPROVAL',
                approval_actions__assigned_to=employee,
                approval_actions__step_number=F('current_step_number'),
                approval_actions__status='PENDING',
            )
        else:
            return Response({'detail': 'scope must be approvals, mine, or approved.'}, status=400)
        qs = qs.select_related('employee', 'requested_by', 'approved_by', 'workflow').prefetch_related('approval_actions__assigned_to', 'approval_actions__acted_by').distinct()
        return Response(EmployeeExitRequestSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        is_hr = is_hr_or_system_admin(request.user)
        actor_employee = getattr(request.user, 'employee', None)
        can_manage_exit = request.user.has_role('MANAGER') or request.user.has_role('REPORTING_MANAGER')
        if not is_hr and not (can_manage_exit and actor_employee):
            return Response({'detail': 'HR Admin or the employee’s reporting manager can initiate an exit.'}, status=403)
        serializer = EmployeeExitRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not is_hr and serializer.validated_data['employee'].reporting_manager_id != actor_employee.id:
            return Response({'detail': 'Managers can initiate exits only for their direct reports.'}, status=403)
        try:
            exit_request = submit_exit_request(
                employee_id=serializer.validated_data['employee'].id,
                actor=request.user,
                proposed_exit_date=serializer.validated_data['proposed_exit_date'],
                exit_type=serializer.validated_data['exit_type'],
                reason=serializer.validated_data.get('reason', ''),
                settlement_inputs=serializer.validated_data.get('settlement_inputs', {}),
            )
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Employee not found.'}, status=404)
        except ExitRequestError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(EmployeeExitRequestSerializer(exit_request, context={'request': request}).data, status=201)


class EmployeeExitEligibleEmployeesView(APIView):
    """Small, unpaginated employee list for the exit request selector."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from HRMSapp.models import Employee

        employees = Employee.objects.filter(
            status__in=['ACTIVE', 'PROBATION'], is_deleted=False,
        ).order_by('employee_id')
        if not is_hr_or_system_admin(request.user):
            actor = getattr(request.user, 'employee', None)
            if not actor or not (request.user.has_role('MANAGER') or request.user.has_role('REPORTING_MANAGER')):
                return Response({'detail': 'HR Admin or reporting manager access is required.'}, status=403)
            employees = employees.filter(reporting_manager=actor)
        rows = [{
            'id': str(employee.id), 'employee_id': employee.employee_id,
            'full_name': employee.full_name,
        } for employee in employees]
        return Response(rows)


class EmployeeExitRequestDecisionView(APIView):
    """Approve or reject a pending step in an exit workflow."""
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id, decision):
        if decision not in ('approve', 'reject'):
            return Response({'detail': 'Decision must be approve or reject.'}, status=400)
        try:
            exit_request = decide_exit_request(
                request_id=request_id, actor=request.user,
                decision=decision, comments=str(request.data.get('comments', '')),
            )
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        except ExitRequestError as exc:
            return Response({'detail': str(exc)}, status=400)
        return Response(EmployeeExitRequestSerializer(exit_request, context={'request': request}).data)


class EmployeeExitClearanceView(APIView):
    """Stage-2 handover, linked-module clearance, and reasoned exception handling."""
    permission_classes = [IsAuthenticated]

    def _get_request(self, request_id):
        try:
            return EmployeeExitRequest.objects.select_related('employee').get(pk=request_id)
        except EmployeeExitRequest.DoesNotExist:
            return None

    def get(self, request, request_id):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin access is required to manage exit clearance.'}, status=403)
        exit_request = self._get_request(request_id)
        if not exit_request:
            return Response({'detail': 'Exit request not found.'}, status=404)
        if exit_request.status != 'APPROVED':
            return Response({'detail': 'Clearance is available after final exit approval.'}, status=400)
        return Response(clearance_payload(exit_request, request.user))

    def post(self, request, request_id):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin access is required to add exit clearance items.'}, status=403)
        exit_request = self._get_request(request_id)
        if not exit_request:
            return Response({'detail': 'Exit request not found.'}, status=404)
        if exit_request.status != 'APPROVED':
            return Response({'detail': 'Clearance tasks can be added after final exit approval.'}, status=400)
        title = str(request.data.get('title') or '').strip()
        if not title:
            return Response({'detail': 'A handover task title is required.'}, status=400)
        category = request.data.get('category', 'HANDOVER')
        if category not in ('HANDOVER', 'OTHER'):
            return Response({'detail': 'Manual items must be Work handover or Other clearance.'}, status=400)
        item = EmployeeExitClearanceItem.objects.create(
            request=exit_request, source_key=f'manual:{timezone.now().timestamp()}:{uuid4()}',
            category=category, title=title[:200], description=str(request.data.get('description') or ''),
            responsible_person=str(request.data.get('responsible_person') or '')[:150],
            due_date=request.data.get('due_date') or None,
            created_by=getattr(request.user, 'employee', None),
        )
        log_clearance_change(item, request.user, 'EXIT_CLEARANCE_ITEM_ADDED')
        return Response(clearance_payload(exit_request), status=201)


class EmployeeExitClearanceItemView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, request_id, item_id):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin access is required to resolve exit clearance items.'}, status=403)
        try:
            item = EmployeeExitClearanceItem.objects.select_related('request__employee').get(
                pk=item_id, request_id=request_id, request__status='APPROVED',
            )
        except EmployeeExitClearanceItem.DoesNotExist:
            return Response({'detail': 'Exit clearance item not found.'}, status=404)
        action = request.data.get('action')
        if action not in ('complete', 'waive', 'reopen'):
            return Response({'detail': 'Action must be complete, waive, or reopen.'}, status=400)
        if action == 'waive' and not is_hr_or_system_admin(request.user):
            return Response({'detail': 'Only HR or System Admin can approve a clearance exception.'}, status=403)
        reason = str(request.data.get('reason') or '').strip()
        if action == 'waive' and not reason:
            return Response({'detail': 'A reason is required to approve an exception.'}, status=400)
        if action == 'complete' and item.source_key.startswith('asset:'):
            from assetapp.models import AssetAllocation
            allocation = AssetAllocation.objects.filter(pk=item.source_key.removeprefix('asset:')).first()
            if allocation and allocation.status == 'ALLOCATED':
                return Response({'detail': 'Record the asset return in Asset Management first, then refresh this checklist.'}, status=400)
        if action == 'complete' and item.source_key.startswith('reimbursement:'):
            from reimbursementapp.models import ReimbursementClaim
            claim = ReimbursementClaim.objects.select_related('batch').filter(
                pk=item.source_key.removeprefix('reimbursement:'),
            ).first()
            if claim and claim.status != 'REJECTED' and claim.batch.status not in ('SENT', 'CLOSED'):
                return Response({'detail': 'Resolve the reimbursement through the Reimbursements workflow first, then refresh this checklist.'}, status=400)
        old_status = item.status
        item.status = {'complete': 'COMPLETED', 'waive': 'WAIVED', 'reopen': 'PENDING'}[action]
        item.resolution_notes = reason if action == 'complete' else str(request.data.get('notes') or '')
        item.exception_reason = reason if action == 'waive' else ''
        item.resolved_by = getattr(request.user, 'employee', None) if action != 'reopen' else None
        item.save(update_fields=['status', 'resolution_notes', 'exception_reason', 'resolved_by', 'updated_at'])
        log_clearance_change(item, request.user, 'EXIT_CLEARANCE_EXCEPTION_APPROVED' if action == 'waive' else 'EXIT_CLEARANCE_ITEM_UPDATED', reason or old_status)
        return Response(clearance_payload(item.request))


class EmployeeExitDocumentsView(APIView):
    """HR document eligibility and controlled issuance for one approved exit."""
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin access is required to issue exit documents.'}, status=403)
        try:
            exit_request = EmployeeExitRequest.objects.select_related('employee__position').get(pk=request_id)
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        return Response(exit_document_status(exit_request, request.user))

    def post(self, request, request_id):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin access is required to issue exit documents.'}, status=403)
        document_type = str(request.data.get('document_type') or '').strip().upper()
        try:
            record = issue_exit_document(
                request_id, document_type, request.user,
                refresh_branding=bool(request.data.get('refresh_branding')),
            )
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=400)
        except Exception as exc:
            logger.exception('Could not issue exit document for request %s', request_id)
            return Response({'detail': 'The exit document could not be generated. Check the document configuration and try again.'}, status=400)
        return Response(employee_exit_document_payload(record), status=201)


class MyExitDocumentsView(APIView):
    """Employee self-service list and secure download for their issued exit documents."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'results': []})
        records = EmployeeExitDocument.objects.filter(employee=employee).select_related(
            'request', 'employee_document',
        ).order_by('-issued_at')
        return Response({'results': [employee_exit_document_payload(record) for record in records]})


class MyExitDocumentDownloadView(APIView):
    """Download only the signed-in employee's issued exit document."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def get(self, request, document_id):
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'detail': 'Your account is not linked to an employee profile.'}, status=403)
        try:
            record = EmployeeExitDocument.objects.select_for_update().select_related(
                'employee_document',
            ).get(pk=document_id, employee=employee)
        except EmployeeExitDocument.DoesNotExist:
            return Response({'detail': 'Exit document not found.'}, status=404)
        if not record.employee_document.file_path:
            return Response({'detail': 'The document file is unavailable.'}, status=404)
        record.download_count += 1
        record.last_downloaded_at = timezone.now()
        record.save(update_fields=['download_count', 'last_downloaded_at'])
        filename = record.employee_document.file_path.name.rsplit('/', 1)[-1]
        return FileResponse(record.employee_document.file_path.open('rb'), as_attachment=True, filename=filename, content_type='application/pdf')


class EmployeeExitEncashmentPreviewView(APIView):
    """Calculate a non-posting encashment preview from frozen approved inputs."""
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            exit_request = EmployeeExitRequest.objects.select_related('employee').get(pk=request_id)
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        actor_employee = getattr(request.user, 'employee', None)
        authorized = is_hr_or_system_admin(request.user) or exit_request.requested_by_id == getattr(actor_employee, 'id', None)
        if actor_employee and not authorized:
            authorized = exit_request.approval_actions.filter(assigned_to=actor_employee).exists()
        if not authorized:
            return Response({'detail': 'You are not authorized to view this exit settlement preview.'}, status=403)
        try:
            return Response(preview_exit_encashment(exit_request))
        except LeaveEncashmentError as exc:
            return Response({'detail': str(exc)}, status=400)


class EmployeeExitFullFinalPreviewView(APIView):
    """Calculate the read-only F&F breakdown for HR review."""
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            exit_request = EmployeeExitRequest.objects.select_related('employee').get(pk=request_id)
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        actor_employee = getattr(request.user, 'employee', None)
        authorized = is_hr_or_system_admin(request.user) or exit_request.requested_by_id == getattr(actor_employee, 'id', None)
        if actor_employee and not authorized:
            authorized = exit_request.approval_actions.filter(assigned_to=actor_employee).exists()
        if not authorized:
            return Response({'detail': 'You are not authorized to view this F&F review.'}, status=403)
        try:
            return Response(preview_full_final(exit_request))
        except (FullFinalError, LeaveEncashmentError) as exc:
            return Response({'detail': str(exc)}, status=400)


class EmployeeExitFNFRunCreateView(APIView):
    """Create an exit-linked, single-employee F&F pay run for payroll review."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, request_id):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin access is required to create an F&F run.'}, status=403)
        try:
            exit_request = EmployeeExitRequest.objects.select_for_update().select_related('employee').get(pk=request_id)
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        if exit_request.status != 'APPROVED':
            return Response({'detail': 'Only approved exit requests can create an F&F payroll run.'}, status=400)
        if exit_request.proposed_exit_date > timezone.localdate():
            return Response({'detail': 'Create the F&F run on or after the approved last working date. You can review the estimate before then.'}, status=400)
        if ArrearsLog.objects.filter(
            employee=exit_request.employee, settled_in_run__isnull=True,
            from_period__lte=exit_request.proposed_exit_date,
            reserved_in_run__isnull=False,
        ).exists():
            return Response({
                'detail': 'This employee has arrears reserved in another payroll run. Complete or reverse that run before creating the F&F run.'
            }, status=400)
        readiness = validate_exit_data(exit_request)
        if not readiness['can_approve']:
            return Response({
                'detail': 'Resolve pending leave and unfinished payroll activity before creating the F&F run.',
                'readiness': readiness,
            }, status=400)
        stage2 = clearance_payload(exit_request, request.user)
        pending_clearance = [item['title'] for item in stage2['items'] if item['status'] == 'PENDING']
        if pending_clearance:
            return Response({
                'detail': 'Complete outstanding exit clearance tasks or record an approved, reasoned exception before creating the F&F run.',
                'pending_clearance': pending_clearance,
            }, status=400)
        try:
            refresh_settlement_snapshot(exit_request, request.user)
            preview = preview_full_final(exit_request)
        except (ExitRequestError, FullFinalError, LeaveEncashmentError) as exc:
            return Response({'detail': str(exc)}, status=400)

        arrears_snapshot = exit_request.frozen_snapshot.get('outstanding_arrears') or []
        arrears_ids = [item.get('arrears_id') for item in arrears_snapshot if item.get('arrears_id')]
        arrears_to_reserve = list(ArrearsLog.objects.select_for_update().filter(
            id__in=arrears_ids, employee=exit_request.employee,
            settled_in_run__isnull=True, reserved_in_run__isnull=True,
        ))
        if len(arrears_to_reserve) != len(arrears_ids):
            return Response({'detail': 'The outstanding arrears changed while preparing F&F. Refresh the preview and try again.'}, status=409)

        exit_date = exit_request.proposed_exit_date
        pay_calendar = PayCalendar.objects.filter(
            year=exit_date.year, month=exit_date.month,
        ).first()
        if not pay_calendar:
            return Response({'detail': 'Create a payroll calendar for the approved last working date month before creating the F&F run.'}, status=400)
        assignment_covers_exit = EmployeeSalaryAssignment.objects.filter(
            employee=exit_request.employee,
            effective_from__lte=exit_date,
        ).filter(Q(effective_to__gte=exit_date) | Q(effective_to__isnull=True)).exists()
        if not assignment_covers_exit:
            return Response({'detail': 'No current salary assignment covers the approved last working date. Correct the assignment and use the controlled exit snapshot correction before creating the F&F run.'}, status=400)

        try:
            run = RunLifecycleService.create_run(
                pay_calendar_id=pay_calendar.id, run_type='FNF', user=request.user,
                exit_request=exit_request,
            )
        except RunLifecycleError as exc:
            return Response({'detail': str(exc)}, status=400)

        actor = getattr(request.user, 'employee', None)
        adjustments = []
        for line in preview['lines']:
            amount = Decimal(line['amount'])
            if amount <= 0 or line['code'] == 'OUTSTANDING_ARREARS':
                continue
            if line['code'] == 'RECOVERIES':
                adjustments.append({
                    'adjustment_type': 'DEDUCTION', 'label': line['label'],
                    'amount': abs(amount), 'taxable': False, 'category': 'OTHER',
                })
            elif line['code'] in ('SALARY_THROUGH_EXIT', 'LEAVE_ENCASHMENT', 'OTHER_DUES', 'GRATUITY'):
                adjustments.append({
                    'adjustment_type': 'VARIABLE_EARNING', 'label': line['label'],
                    'amount': amount, 'taxable': line.get('taxable', True),
                    'category': 'FNF_SALARY' if line['code'] == 'SALARY_THROUGH_EXIT' else 'OTHER',
                })

        for item in adjustments:
            adjustment = PayrollRunAdjustment.objects.create(
                run=run, employee=exit_request.employee,
                category=item.pop('category'), reason=f"F&F exit request {exit_request.id}",
                created_by=actor, **item,
            )
            PayrollAuditLog.objects.create(
                run=run, employee=exit_request.employee,
                action='FNF_ADJUSTMENT_ADDED',
                reason=adjustment.reason, performed_by=actor,
                new_values={
                    'adjustment_id': str(adjustment.id),
                    'label': adjustment.label,
                    'adjustment_type': adjustment.adjustment_type,
                    'amount': str(adjustment.amount),
                    'taxable': adjustment.taxable,
                },
            )

        for arrears_item in arrears_to_reserve:
            arrears_item.reserved_in_run = run
            arrears_item.save(update_fields=['reserved_in_run'])
            amount = abs(arrears_item.arrears_amount)
            if amount <= 0:
                continue
            is_earning = arrears_item.arrears_amount > 0
            label = (
                f"Arrears · {arrears_item.component.code if arrears_item.component_id else arrears_item.component_label} · "
                f"{arrears_item.from_period:%b %Y}"
            )
            adjustment = PayrollRunAdjustment.objects.create(
                run=run, employee=exit_request.employee,
                arrears_item=arrears_item,
                adjustment_type='VARIABLE_EARNING' if is_earning else 'DEDUCTION',
                category='ARREARS' if is_earning else 'DEDUCTION_CORRECTION',
                label=label, amount=amount,
                taxable=is_earning and bool((arrears_item.calculation_snapshot or {}).get('is_taxable', False)),
                reference_period_start=arrears_item.from_period,
                reference_period_end=arrears_item.to_period,
                reason=arrears_item.reason or f'F&F exit request {exit_request.id}',
                created_by=actor,
            )
            PayrollAuditLog.objects.create(
                run=run, employee=exit_request.employee,
                action='FNF_ADJUSTMENT_ADDED',
                reason='Outstanding arrears included in F&F settlement.',
                performed_by=actor,
                new_values={
                    'label': adjustment.label,
                    'adjustment_type': adjustment.adjustment_type,
                    'amount': str(adjustment.amount),
                    'taxable': adjustment.taxable,
                    'period_start': str(arrears_item.from_period),
                    'period_end': str(arrears_item.to_period),
                },
            )

        return Response(
            PayrollRunDetailSerializer(run, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class EmployeeExitReadinessView(APIView):
    """Check pending leave and payroll items before final exit approval."""
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            exit_request = EmployeeExitRequest.objects.select_related('employee').get(pk=request_id)
        except EmployeeExitRequest.DoesNotExist:
            return Response({'detail': 'Exit request not found.'}, status=404)
        actor_employee = getattr(request.user, 'employee', None)
        authorized = is_hr_or_system_admin(request.user) or exit_request.requested_by_id == getattr(actor_employee, 'id', None)
        if actor_employee and not authorized:
            authorized = exit_request.approval_actions.filter(assigned_to=actor_employee).exists()
        if not authorized:
            return Response({'detail': 'You are not authorized to view this exit request.'}, status=403)
        return Response(validate_exit_data(exit_request))


# ==============================================================================
# HELPER: Permission check
# ==============================================================================

def is_hr_or_system_admin(user):
    return user.has_role('HR_ADMIN') or user.has_role('SYSTEM_ADMIN')


# ==============================================================================
# 1. SALARY COMPONENTS
# ==============================================================================

class SalaryComponentViewSet(ModelViewSet):
    """CRUD for salary components. HR Admin for writes."""
    queryset = SalaryComponent.objects.all()
    serializer_class = SalaryComponentSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['component_type', 'is_taxable', 'is_fixed', 'is_active']
    search_fields = ['code', 'name']
    ordering_fields = ['display_order', 'code', 'name']
    ordering = ['component_type', 'display_order', 'code']

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'mini']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    @action(detail=False, methods=['get'], url_path='mini')
    def mini(self, request):
        """Lightweight list for dropdowns."""
        qs = SalaryComponent.objects.filter(is_active=True).order_by(
            'component_type', 'display_order',
        )
        return Response(SalaryComponentMiniSerializer(qs, many=True).data)


# ==============================================================================
# 2. SALARY STRUCTURES
# ==============================================================================

class SalaryStructureViewSet(ModelViewSet):
    """CRUD for salary structures with nested components."""
    queryset = SalaryStructure.objects.all().prefetch_related('components__component')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name']
    ordering = ['name']

    def get_serializer_class(self):
        if self.action == 'list':
            return SalaryStructureListSerializer
        if self.action in ['create', 'update', 'partial_update']:
            return SalaryStructureCreateSerializer
        return SalaryStructureDetailSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]


# ==============================================================================
# 3. STATUTORY RULES
# ==============================================================================

class StatutoryRuleViewSet(ModelViewSet):
    """CRUD for statutory rules. Versioned and jurisdiction-aware."""
    queryset = StatutoryRule.objects.all().select_related('approved_by')
    serializer_class = StatutoryRuleSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['statutory_type', 'jurisdiction', 'tax_regime', 'is_active']
    search_fields = ['name']
    ordering_fields = ['statutory_type', 'effective_from']
    ordering = ['statutory_type', '-effective_from']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """Get currently active rules for each type + jurisdiction."""
        today = timezone.localdate()
        rules = StatutoryRule.objects.filter(
            is_active=True,
            effective_from__lte=today,
        ).filter(
            models_Q_to_gte_or_null(today)
        ).order_by('statutory_type', 'jurisdiction')
        return Response(StatutoryRuleSerializer(rules, many=True).data)


# ==============================================================================
# 4. PAY CALENDAR
# ==============================================================================

class PayCalendarViewSet(ModelViewSet):
    """CRUD for monthly pay periods."""
    queryset = PayCalendar.objects.all()
    serializer_class = PayCalendarSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['year', 'month', 'status']
    ordering = ['-year', '-month']

    def update(self, request, *args, **kwargs):
        calendar_record = self.get_object()
        if calendar_record.status in ('LOCKED', 'CLOSED'):
            return Response(
                {'detail': 'A locked or closed pay calendar cannot be edited.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    @action(detail=False, methods=['post'], url_path='auto-create')
    def auto_create(self, request):
        """
        Auto-create pay calendar for a given year + month.
        Sets period = 1st to last day, days_in_month from calendar module.
        """
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin only'}, status=403)

        year = request.data.get('year', timezone.now().year)
        month = request.data.get('month', timezone.now().month)

        try:
            year = int(year)
            month = int(month)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid year/month'}, status=400)

        if PayCalendar.objects.filter(year=year, month=month).exists():
            return Response(
                {'detail': f'Calendar for {year}-{month:02d} already exists'},
                status=400,
            )

        days = calendar.monthrange(year, month)[1]
        period_start = date(year, month, 1)
        period_end = date(year, month, days)

        # Default cutoff = 25th, pay date = last working day
        cutoff = date(year, month, min(25, days))

        # Pay date: last day of month (simplified; adjust for weekends later)
        pay_date = period_end

        cal = PayCalendar.objects.create(
            year=year,
            month=month,
            period_start=period_start,
            period_end=period_end,
            days_in_month=days,
            cutoff_date=cutoff,
            pay_date=pay_date,
            status='DRAFT',
        )

        return Response(
            PayCalendarSerializer(cal).data,
            status=201,
        )

    @action(detail=False, methods=['post'], url_path='auto-create-year')
    def auto_create_year(self, request):
        """Auto-create all 12 months for a year."""
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin only'}, status=403)

        year = int(request.data.get('year', timezone.now().year))
        created = []
        skipped = []

        for month in range(1, 13):
            if PayCalendar.objects.filter(year=year, month=month).exists():
                skipped.append(f"{year}-{month:02d}")
                continue

            days = calendar.monthrange(year, month)[1]
            PayCalendar.objects.create(
                year=year,
                month=month,
                period_start=date(year, month, 1),
                period_end=date(year, month, days),
                days_in_month=days,
                cutoff_date=date(year, month, min(25, days)),
                pay_date=date(year, month, days),
                status='DRAFT',
            )
            created.append(f"{year}-{month:02d}")

        return Response({
            'ok': True,
            'created': created,
            'skipped': skipped,
            'message': f'Created {len(created)} months, skipped {len(skipped)}',
        })


# ==============================================================================
# 5. EMPLOYEE SALARY ASSIGNMENTS
# ==============================================================================

class EmployeeSalaryAssignmentViewSet(ModelViewSet):
    """
    Salary assignment with overlap validation and immutable history.
    """
    queryset = EmployeeSalaryAssignment.objects.all().select_related(
        'employee', 'structure', 'created_by',
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['employee', 'structure']
    search_fields = ['employee__employee_id', 'employee__first_name']
    ordering = ['employee', '-effective_from']
    http_method_names = ['get', 'post', 'head', 'options']  # No PUT/DELETE (immutable)

    def get_serializer_class(self):
        if self.action == 'create':
            return EmployeeSalaryAssignmentCreateSerializer
        return EmployeeSalaryAssignmentSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'history']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if is_hr_or_system_admin(user):
            return qs

        if user.has_role('MANAGER') and hasattr(user, 'employee'):
            return qs.filter(employee__reporting_manager=user.employee)

        if hasattr(user, 'employee'):
            return qs.filter(employee=user.employee)

        return qs.none()

    def create(self, request, *args, **kwargs):
        """Create new assignment with overlap validation."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # ModelSerializer has already resolved the employee UUID to an
        # Employee instance. Querying by that instance as if it were a UUID
        # caused a ValueError/500 on every assignment create.
        employee = serializer.validated_data['employee']
        structure = serializer.validated_data['structure']
        ctc_monthly = serializer.validated_data['ctc_monthly']
        effective_from = serializer.validated_data['effective_from']
        try:
            salary_preview = AssignmentService.preview_breakdown(
                structure, ctc_monthly, as_of_date=effective_from,
            )
        except Exception as exc:
            logger.exception('Could not preview salary assignment')
            return Response({'detail': f'Could not calculate this salary structure: {exc}'}, status=400)

        preview_ctc = Decimal(salary_preview['total_ctc'])
        if abs(preview_ctc - ctc_monthly) > Decimal('0.01'):
            return Response({
                'detail': (
                    f"This structure calculates to monthly CTC ₹{preview_ctc}, "
                    f"but the assignment CTC is ₹{ctc_monthly}. Review its fixed earnings and employer costs."
                )
            }, status=400)

        calculated_fixed_salary = Decimal(salary_preview['fixed_salary_monthly'])
        # The backend preview above is authoritative. A stale client preview
        # must not block a valid assignment or override the salary structure.
        fixed_salary_monthly = calculated_fixed_salary

        try:
            assignment = AssignmentService.assign_salary(
                employee=employee,
                structure=structure,
                ctc_annual=serializer.validated_data['ctc_annual'],
                ctc_monthly=ctc_monthly,
                fixed_salary_monthly=fixed_salary_monthly,
                effective_from=effective_from,
                effective_to=serializer.validated_data.get('effective_to'),
                reason=serializer.validated_data.get('reason', ''),
                increment_interval_months=serializer.validated_data.get('increment_interval_months', 12),
                created_by=getattr(request.user, 'employee', None),
            )
        except AssignmentError as exc:
            return Response({'detail': str(exc)}, status=400)

        return Response(
            EmployeeSalaryAssignmentSerializer(assignment).data,
            status=201,
        )

    @action(detail=False, methods=['get'], url_path='history/(?P<employee_id>[^/.]+)')
    def history(self, request, employee_id=None):
        """Get full salary history for an employee."""
        qs = self.get_queryset().filter(employee_id=employee_id).order_by(
            '-effective_from',
        )
        return Response(EmployeeSalaryAssignmentSerializer(qs, many=True).data)

    @action(detail=True, methods=['get', 'post'], url_path='arrears')
    def arrears(self, request, pk=None):
        """Preview or generate arrears for periods affected by this assignment."""
        assignment = self.get_object()
        try:
            if request.method == 'GET':
                return Response(preview_assignment_arrears(assignment))
            result = generate_assignment_arrears(
                assignment, request.user, request.data.get('reason', ''),
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ArrearsError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='current')
    def current(self, request):
        """Get current active assignment for all employees (HR) or self."""
        qs = self.get_queryset().filter(effective_to__isnull=True)
        return Response(EmployeeSalaryAssignmentSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='latest')
    def latest(self, request):
        """One latest assignment per employee; older terms remain in history."""
        visible_assignments = self.get_queryset()
        latest_id = visible_assignments.filter(
            employee_id=OuterRef('employee_id'),
        ).order_by('-effective_from', '-created_at').values('pk')[:1]
        qs = visible_assignments.filter(pk=Subquery(latest_id)).order_by(
            'employee__employee_id',
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = EmployeeSalaryAssignmentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(EmployeeSalaryAssignmentSerializer(qs, many=True).data)


# ==============================================================================
# 6. EMPLOYEE PAYROLL PROFILE
# ==============================================================================

class EmployeePayrollProfileViewSet(ModelViewSet):
    """
    Encrypted bank + statutory ID management.
    List view masks sensitive fields. Detail view shows full data (HR only).
    """
    queryset = EmployeePayrollProfile.objects.all().select_related(
        'employee', 'created_by',
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['employee', 'is_active', 'tax_regime']
    search_fields = ['employee__employee_id', 'employee__first_name']
    ordering = ['employee', '-effective_from']

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeePayrollProfileListSerializer
        return EmployeePayrollProfileSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsHRAdmin()]

    def perform_create(self, serializer):
        serializer.save(created_by=getattr(self.request.user, 'employee', None))

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if is_hr_or_system_admin(user):
            return qs

        if hasattr(user, 'employee'):
            return qs.filter(employee=user.employee)

        return qs.none()


class PayrollProfilesOverviewView(APIView):
    """One latest bank-profile row per employee, with masked version history."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from HRMSapp.models import Employee

        employees = Employee.objects.filter(is_deleted=False).order_by('employee_id')
        if not is_hr_or_system_admin(request.user):
            employee = getattr(request.user, 'employee', None)
            employees = employees.filter(id=getattr(employee, 'id', None))

        paginator = PageNumberPagination()
        paginator.page_size = 18
        page = paginator.paginate_queryset(employees, request, view=self)
        employee_ids = [employee.id for employee in page]
        profiles = list(EmployeePayrollProfile.objects.filter(
            employee_id__in=employee_ids,
        ).select_related('employee').order_by('employee_id', '-effective_from'))
        profile_data = EmployeePayrollProfileListSerializer(
            profiles, many=True, context={'request': request},
        ).data
        history_by_employee = {}
        for data in profile_data:
            history_by_employee.setdefault(str(data['employee']), []).append(data)
        profiles_by_employee = {}
        for profile in profiles:
            profiles_by_employee.setdefault(str(profile.employee_id), []).append(profile)

        rows = []
        for employee in page:
            key = str(employee.id)
            employee_profiles = profiles_by_employee.get(key, [])
            current = next((profile for profile in employee_profiles if profile.is_active and profile.effective_to is None), None)
            latest = current or (employee_profiles[0] if employee_profiles else None)
            account = employee.bank_account_encrypted or (latest.bank_account if latest else '') or ''
            masked_account = f'XXXX XXXX {account[-4:]}' if len(account) >= 4 else ('XXXX' if account else '')
            rows.append({
                'employee': key,
                'employee_code': employee.employee_id,
                'employee_name': employee.full_name,
                'profile_id': str(current.id) if current else None,
                'has_current_profile': bool(current),
                'has_profile_history': bool(employee_profiles),
                'bank_name': employee.bank_name or (latest.bank_name if latest else ''),
                'account_holder_name': employee.bank_account_holder_name or (latest.account_holder_name if latest else ''),
                'masked_account': masked_account,
                'ifsc_code': employee.bank_ifsc_code or (latest.ifsc_code if latest else ''),
                'tax_regime': (current or latest).tax_regime if latest else 'NEW',
                'tax_resident': (current or latest).tax_resident if latest else None,
                'effective_from': (current or latest).effective_from if latest else None,
                'effective_to': (current or latest).effective_to if latest else None,
                'history': history_by_employee.get(key, []),
            })
        return paginator.get_paginated_response(rows)


# ==============================================================================
# 7. SEED DEFAULTS
# ==============================================================================

class SeedDefaultsView(APIView):
    """
    One-time seed: create standard Indian salary components and statutory rules.
    System Admin only. Idempotent (skips if already exists).
    """
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin only'}, status=403)

        results = {'components': [], 'rules': [], 'skipped': []}

        # ----- SALARY COMPONENTS -----
        default_components = [
            # Earnings
            {'code': 'BASIC', 'name': 'Basic Salary', 'component_type': 'EARNING',
             'is_taxable': True, 'is_fixed': False, 'formula': '',
             'display_order': 1},
            {'code': 'HRA', 'name': 'House Rent Allowance', 'component_type': 'EARNING',
             'is_taxable': True, 'is_fixed': False, 'formula': 'basic * 0.40',
             'display_order': 2},
            {'code': 'CONVEYANCE', 'name': 'Conveyance Allowance', 'component_type': 'EARNING',
             'is_taxable': True, 'is_fixed': True, 'formula': '',
             'display_order': 3},
            {'code': 'MEDICAL', 'name': 'Medical Allowance', 'component_type': 'EARNING',
             'is_taxable': True, 'is_fixed': True, 'formula': '',
             'display_order': 4},
            {'code': 'LTA', 'name': 'Leave Travel Allowance', 'component_type': 'EARNING',
             'is_taxable': True, 'is_fixed': True, 'formula': '',
             'display_order': 5},
            {'code': 'SPECIAL', 'name': 'Special Allowance', 'component_type': 'EARNING',
             'is_taxable': True, 'is_fixed': False, 'formula': '',
             'display_order': 6},

            # Deductions
            {'code': 'PF_EMP', 'name': 'PF (Employee)', 'component_type': 'DEDUCTION',
             'is_taxable': False, 'is_fixed': False, 'formula': 'min(basic, 15000) * 0.12',
             'display_order': 10},
            {'code': 'ESI_EMP', 'name': 'ESI (Employee)', 'component_type': 'DEDUCTION',
             'is_taxable': False, 'is_fixed': False, 'formula': 'gross * 0.0075',
             'display_order': 11},
            {'code': 'PT', 'name': 'Professional Tax', 'component_type': 'DEDUCTION',
             'is_taxable': False, 'is_fixed': True, 'formula': '',
             'display_order': 12},
            {'code': 'TDS', 'name': 'Tax Deducted at Source', 'component_type': 'DEDUCTION',
             'is_taxable': False, 'is_fixed': False, 'formula': '',
             'display_order': 13},
            {'code': 'LOAN', 'name': 'Loan Recovery', 'component_type': 'DEDUCTION',
             'is_taxable': False, 'is_fixed': True, 'formula': '',
             'display_order': 14},

            # Employer Costs
            {'code': 'PF_ER', 'name': 'PF (Employer)', 'component_type': 'EMPLOYER_COST',
             'is_taxable': False, 'is_fixed': False, 'formula': 'min(basic, 15000) * 0.12',
             'display_order': 20},
            {'code': 'EPS_ER', 'name': 'EPS (Employer Pension Share)', 'component_type': 'EMPLOYER_COST',
             'is_taxable': False, 'is_fixed': False, 'formula': '',
             'display_order': 20},
            {'code': 'EPF_ER', 'name': 'EPF (Employer Provident Fund Share)', 'component_type': 'EMPLOYER_COST',
             'is_taxable': False, 'is_fixed': False, 'formula': '',
             'display_order': 20},
            {'code': 'ESI_ER', 'name': 'ESI (Employer)', 'component_type': 'EMPLOYER_COST',
             'is_taxable': False, 'is_fixed': False, 'formula': 'gross * 0.0325',
             'display_order': 21},
            {'code': 'GRATUITY', 'name': 'Gratuity Provision', 'component_type': 'EMPLOYER_COST',
             'is_taxable': False, 'is_fixed': False, 'formula': 'basic * 0.0481',
             'display_order': 22},

            # One-Time
            {'code': 'BONUS', 'name': 'Bonus', 'component_type': 'ONE_TIME',
             'is_taxable': True, 'is_fixed': True, 'formula': '',
             'display_order': 30},
            {'code': 'ARREARS', 'name': 'Arrears', 'component_type': 'ONE_TIME',
             'is_taxable': True, 'is_fixed': True, 'formula': '',
             'display_order': 31},
        ]

        for data in default_components:
            if SalaryComponent.objects.filter(code=data['code']).exists():
                results['skipped'].append(data['code'])
                continue
            SalaryComponent.objects.create(**data)
            results['components'].append(data['code'])

        # ----- STATUTORY RULES -----
        today = timezone.localdate()

        default_rules = [
            {
                'statutory_type': 'PF',
                'name': 'PF Standard FY2026',
                'jurisdiction': 'ALL',
                'employee_rate': Decimal('12.000'),
                'employer_rate': Decimal('12.000'),
                'employer_pension_rate': Decimal('8.330'),
                'wage_ceiling': Decimal('15000.00'),
                'threshold': Decimal('0'),
                'min_employees': 20,
                'effective_from': date(2026, 1, 1),
            },
            {
                'statutory_type': 'ESI',
                'name': 'ESI Standard FY2026',
                'jurisdiction': 'ALL',
                'employee_rate': Decimal('0.750'),
                'employer_rate': Decimal('3.250'),
                'wage_ceiling': Decimal('21000.00'),
                'threshold': Decimal('21000.00'),
                'min_employees': 10,
                'effective_from': date(2026, 1, 1),
            },
            {
                'statutory_type': 'PT',
                'name': 'Karnataka PT 2026',
                'jurisdiction': 'KA',
                'employee_rate': Decimal('0'),
                'employer_rate': Decimal('0'),
                'wage_ceiling': Decimal('0'),
                'threshold': Decimal('15000.00'),
                'min_employees': 0,
                'slabs': [
                    {'min': 0, 'max': 15000, 'amount': 0},
                    {'min': 15001, 'max': 20000, 'amount': 150},
                    {'min': 20001, 'max': None, 'amount': 200},
                ],
                'effective_from': date(2026, 1, 1),
            },
            {
                'statutory_type': 'TDS',
                'name': 'TDS New Regime TY2026-27',
                'jurisdiction': 'ALL',
                'tax_regime': 'NEW',
                'effective_from': date(2026, 4, 1),
                'effective_to': date(2027, 3, 31),
                'slabs': {
                    'slabs': [
                        {'min': 0, 'max': 400000, 'rate': 0},
                        {'min': 400000, 'max': 800000, 'rate': 5},
                        {'min': 800000, 'max': 1200000, 'rate': 10},
                        {'min': 1200000, 'max': 1600000, 'rate': 15},
                        {'min': 1600000, 'max': 2000000, 'rate': 20},
                        {'min': 2000000, 'max': 2400000, 'rate': 25},
                        {'min': 2400000, 'max': None, 'rate': 30},
                    ],
                    'standard_deduction': 75000,
                    'rebate': {'threshold': 1200000, 'max_amount': 60000, 'resident_only': True, 'marginal_relief': True},
                    'surcharge': [
                        {'min': 5000000, 'max': 10000000, 'rate': 10},
                        {'min': 10000000, 'max': 20000000, 'rate': 15},
                        {'min': 20000000, 'max': 50000000, 'rate': 25},
                        {'min': 50000000, 'max': None, 'rate': 25},
                    ],
                    'surcharge_cap_rate': 25,
                    'cess_rate': 4,
                },
            },
            {
                'statutory_type': 'TDS',
                'name': 'TDS Old Regime TY2026-27',
                'jurisdiction': 'ALL',
                'tax_regime': 'OLD',
                'effective_from': date(2026, 4, 1),
                'effective_to': date(2027, 3, 31),
                'slabs': {
                    'slabs': [
                        {'min': 0, 'max': 250000, 'rate': 0},
                        {'min': 250000, 'max': 500000, 'rate': 5},
                        {'min': 500000, 'max': 1000000, 'rate': 20},
                        {'min': 1000000, 'max': None, 'rate': 30},
                    ],
                    'age_slabs': {
                        'senior': [
                            {'min': 0, 'max': 300000, 'rate': 0},
                            {'min': 300000, 'max': 500000, 'rate': 5},
                            {'min': 500000, 'max': 1000000, 'rate': 20},
                            {'min': 1000000, 'max': None, 'rate': 30},
                        ],
                        'super_senior': [
                            {'min': 0, 'max': 500000, 'rate': 0},
                            {'min': 500000, 'max': 1000000, 'rate': 20},
                            {'min': 1000000, 'max': None, 'rate': 30},
                        ],
                    },
                    'standard_deduction': 50000,
                    'rebate': {'threshold': 500000, 'max_amount': 12500, 'resident_only': True},
                    'surcharge': [
                        {'min': 5000000, 'max': 10000000, 'rate': 10},
                        {'min': 10000000, 'max': 20000000, 'rate': 15},
                        {'min': 20000000, 'max': 50000000, 'rate': 25},
                        {'min': 50000000, 'max': None, 'rate': 37},
                    ],
                    'cess_rate': 4,
                },
            },
        ]

        for data in default_rules:
            if StatutoryRule.objects.filter(
                statutory_type=data['statutory_type'],
                name=data['name'],
            ).exists():
                results['skipped'].append(data['name'])
                continue
            StatutoryRule.objects.create(**data)
            results['rules'].append(data['name'])

        return Response({
            'ok': True,
            'message': (
                f"Created {len(results['components'])} components, "
                f"{len(results['rules'])} rules, "
                f"skipped {len(results['skipped'])} existing"
            ),
            **results,
        })


# ==============================================================================
# 8. PREVIEW CALCULATION
# ==============================================================================

class PreviewCalculationView(APIView):
    """
    Preview salary breakdown for a structure + CTC.
    Does NOT create any records. Read-only calculation.
    """
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        serializer = PreviewBreakdownSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            structure = SalaryStructure.objects.get(
                id=serializer.validated_data['structure'],
            )
        except SalaryStructure.DoesNotExist:
            return Response({'detail': 'Structure not found'}, status=404)

        ctc_monthly = serializer.validated_data['ctc_monthly']

        breakdown = AssignmentService.preview_breakdown(
            structure,
            ctc_monthly,
            as_of_date=serializer.validated_data.get('effective_from'),
        )

        return Response({
            'ok': True,
            'structure': structure.name,
            'structure_version': structure.version,
            'ctc_annual': str(serializer.validated_data['ctc_annual']),
            **breakdown,
        })


# ==============================================================================
# HELPER
# ==============================================================================

def models_Q_to_gte_or_null(d):
    from django.db.models import Q
    return Q(effective_to__gte=d) | Q(effective_to__isnull=True)



# ==============================================================================
# 9. CALCULATE PREVIEW (One Employee, Any Period)
# ==============================================================================

from datetime import datetime
from .services.payroll_calculation_service import PayrollCalculationService


class CalculatePreviewView(APIView):
    """
    Preview calculation for ONE employee over ANY period (no run needed).
    Does NOT persist anything. HR Admin only.
    """
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request):
        from HRMSapp.models import Employee

        employee_id = request.data.get('employee_id')
        period_start_str = request.data.get('period_start')
        period_end_str = request.data.get('period_end')

        if not all([employee_id, period_start_str, period_end_str]):
            return Response({
                'detail': 'employee_id, period_start, period_end are required'
            }, status=400)

        try:
            employee = Employee.objects.get(id=employee_id, is_deleted=False)
        except Employee.DoesNotExist:
            return Response({'detail': 'Employee not found'}, status=404)

        try:
            period_start = datetime.strptime(period_start_str, '%Y-%m-%d').date()
            period_end = datetime.strptime(period_end_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format (use YYYY-MM-DD)'}, status=400)

        result = PayrollCalculationService.preview_calculate(
            employee, period_start, period_end,
        )

        # Convert Decimals to strings for JSON
        def convert(obj):
            if isinstance(obj, Decimal):
                return str(obj)
            if isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [convert(x) for x in obj]
            return obj

        return Response(convert(result))



# ──────────────────────────────────────────────────────────────
# Phase 4 — Pay Run views
# ──────────────────────────────────────────────────────────────
from .services.run_lifecycle_service import RunLifecycleService, RunLifecycleError
from .serializers import (
    PayrollRunListSerializer, PayrollRunDetailSerializer,
    PayrollRunEmployeeListSerializer, PayrollRunEmployeeDetailSerializer,
    PayrollAuditLogSerializer, PayRunCreateSerializer,
)
from .models import PayrollRun, PayrollAuditLog, PayCalendar

class ArrearsLogListView(APIView):
    """HR register of generated, reserved, and settled arrears items."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request):
        state = request.query_params.get('status', '').upper()
        qs = list_arrears()
        if state == 'AVAILABLE':
            qs = qs.filter(settled_in_run__isnull=True, reserved_in_run__isnull=True)
        elif state == 'RESERVED':
            qs = qs.filter(settled_in_run__isnull=True, reserved_in_run__isnull=False)
        elif state == 'SETTLED':
            qs = qs.filter(settled_in_run__isnull=False)
        return Response([{
            'id': str(item.id),
            'employee_name': item.employee.full_name,
            'employee_code': item.employee.employee_id,
            'component': item.component.name if item.component_id else item.component_label,
            'component_code': item.component.code if item.component_id else '',
            'period_start': item.from_period,
            'period_end': item.to_period,
            'old_amount': item.old_amount,
            'new_amount': item.new_amount,
            'arrears_amount': item.arrears_amount,
            'reason': item.reason,
            'status': 'SETTLED' if item.settled_in_run_id else 'RESERVED' if item.reserved_in_run_id else 'AVAILABLE',
            'reserved_run_status': item.reserved_in_run.status if item.reserved_in_run_id else None,
            'settled_run_status': item.settled_in_run.status if item.settled_in_run_id else None,
            'created_at': item.created_at,
        } for item in qs])


class ArrearsPeriodCorrectionView(APIView):
    """Recalculate a single employee in a paid regular period and generate differences."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request, run_id, employee_id):
        refresh_attendance = request.query_params.get('refresh_attendance', '').lower() in ('1', 'true', 'yes')
        try:
            return Response(preview_paid_run_arrears(run_id, employee_id, refresh_attendance))
        except ArrearsError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request, run_id, employee_id):
        refresh_attendance = bool(request.data.get('refresh_attendance', False))
        try:
            result = generate_paid_run_arrears(
                run_id, employee_id, request.user,
                request.data.get('reason', ''), refresh_attendance,
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except ArrearsError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class PayRunListCreateView(APIView):
    """GET  /runs/        — list all pay runs
       POST /runs/        — create a new pay run
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = PayrollRun.objects.select_related(
            'pay_calendar', 'prepared_by'
        ).order_by('-created_at')
        if not is_hr_or_system_admin(request.user) and not _can_manage_payment_batches(request.user):
            employee = getattr(request.user, 'employee', None)
            if employee is None:
                return Response([])
            qs = qs.filter(
                approval_actions__assigned_to=employee,
                approval_actions__status='PENDING',
                status='UNDER_REVIEW',
            ).distinct()
        ser = PayrollRunListSerializer(qs, many=True)
        return Response(ser.data)

    def post(self, request):
        if not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin only'}, status=403)
        s = PayRunCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            run = RunLifecycleService.create_run(
                pay_calendar_id=s.validated_data['pay_calendar'],
                run_type=s.validated_data['run_type'],
                user=request.user,
                payment_date=s.validated_data.get('payment_date'),
            )
            return Response(
                PayrollRunDetailSerializer(run, context={'request': request}).data,
                status=status.HTTP_201_CREATED,
            )
        except RunLifecycleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PayCalendar.DoesNotExist:
            return Response(
                {'detail': 'Pay calendar not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )


class PayRunDetailView(APIView):
    """GET /runs/<id>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            run = PayrollRun.objects.select_related(
                'pay_calendar', 'prepared_by', 'approved_by', 'finalized_by'
            ).get(id=pk)
        except PayrollRun.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not is_hr_or_system_admin(request.user) and not _can_manage_payment_batches(request.user):
            employee = getattr(request.user, 'employee', None)
            if employee is None or not (
                run.returned_by_id == employee.id
                or run.approval_actions.filter(assigned_to=employee, status='PENDING').exists()
            ):
                return Response({'detail': 'You are not assigned to review this pay run.'}, status=403)
        return Response(PayrollRunDetailSerializer(run, context={'request': request}).data)


class PayRunTransitionView(APIView):
    """POST /runs/<id>/<action>/
       Actions: lock, reopen, calculate, submit-review, approve, return, finalize, mark-paid, reverse
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, action):
        approval_actions = {'approve', 'return'}
        if action not in approval_actions and not is_hr_or_system_admin(request.user):
            return Response({'detail': 'HR Admin only'}, status=403)
        if action in approval_actions:
            try:
                run = PayrollRun.objects.get(id=pk)
            except PayrollRun.DoesNotExist:
                return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
            has_configured_actions = run.approval_actions.exists()
            if not has_configured_actions and not is_hr_or_system_admin(request.user):
                return Response({'detail': 'HR Admin only'}, status=403)
        reason = request.data.get('reason', '')
        try:
            run = RunLifecycleService.transition(
                run_id=pk, action=action,
                user=request.user, reason=reason,
            )
            response_data = PayrollRunDetailSerializer(run, context={'request': request}).data
            return Response(response_data)
        except RunLifecycleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PayrollRun.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


def _can_manage_payment_batches(user):
    roles = ('FINANCE', 'FINANCE_ADMIN', 'FINANCE_HEAD', 'CFO')
    return is_hr_or_system_admin(user) or any(user.has_role(role) for role in roles)


def _payment_employee_label(employee):
    return f'{employee.employee_id} ({employee.full_name})'


def _payment_line_validation_error(line):
    account = (line.bank_account or '').strip()
    ifsc = (line.ifsc_code or '').strip().upper()
    employee_label = _payment_employee_label(line.run_employee.employee)
    if not re.fullmatch(r'[A-Za-z0-9]{6,34}', account):
        return f'{employee_label}: account number must contain 6–34 letters or digits.'
    if not re.fullmatch(r'[A-Z]{4}0[A-Z0-9]{6}', ifsc):
        return f'{employee_label}: IFSC must be 11 characters in the format ABCD0123456.'
    if line.amount is None or line.amount <= 0:
        return f'{employee_label}: payment amount must be greater than zero.'
    return None


def _amount_in_indian_words(amount):
    ones = ('Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen')
    tens = ('', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety')

    def under_thousand(number):
        words = []
        if number >= 100:
            words.extend((ones[number // 100], 'Hundred'))
            number %= 100
        if number >= 20:
            words.append(tens[number // 10])
            number %= 10
        if number:
            words.append(ones[number])
        return ' '.join(words)

    rupees = int(Decimal(amount))
    paise = int((Decimal(amount) * 100).quantize(Decimal('1')) % 100)
    if rupees == 0:
        words = 'Zero'
    else:
        groups = []
        for unit, divisor in (('Crore', 10000000), ('Lakh', 100000), ('Thousand', 1000), ('', 1)):
            value, rupees = divmod(rupees, divisor)
            if value:
                groups.append(under_thousand(value) + (f' {unit}' if unit else ''))
        words = ' '.join(groups)
    result = f'Rupees {words}'
    if paise:
        result += f' and {under_thousand(paise)} Paise'
    return result + ' Only'


def _build_salary_payment_pdf(batch, lines):
    from xml.sax.saxutils import escape
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Spacer, Table, TableStyle, Paragraph, Image as PDFImage
    from HRMSapp.models import CompanyLogo

    line_list = list(lines)
    errors = [message for line in line_list if (message := _payment_line_validation_error(line))]
    total = sum((line.amount for line in line_list), Decimal('0.00'))
    if errors:
        return None, {'detail': 'The payment document cannot be generated because payment details are invalid.', 'invalid_payment_details': errors}
    if not line_list:
        return None, {'detail': 'This payment batch has no beneficiaries.'}
    if total != batch.total_amount:
        return None, {
            'detail': 'The payment document cannot be generated because the batch total does not match its payment lines.',
            'batch_total': str(batch.total_amount), 'line_total': str(total),
        }

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=14*mm, leftMargin=14*mm, topMargin=14*mm, bottomMargin=14*mm)
    styles = getSampleStyleSheet()
    styles['Title'].fontSize = 18
    styles['Title'].leading = 22
    styles['Normal'].fontSize = 10
    styles['Normal'].leading = 13
    period = batch.run.pay_calendar
    company = CompanyLogo.objects.filter(is_active=True).first()
    company_name = company.name if company else 'Company Name'
    logo_cell = Paragraph('', styles['Normal'])
    if company and company.logo:
        try:
            company.logo.open('rb')
            logo_cell = PDFImage(BytesIO(company.logo.read()), width=24*mm, height=15*mm, kind='proportional')
            company.logo.close()
        except (OSError, ValueError):
            logo_cell = Paragraph('', styles['Normal'])
    payment_date = (batch.run.payment_date or period.pay_date).strftime('%d %b %Y')

    story = [
        Table([[logo_cell, Paragraph(f'<b>{escape(company_name)}</b><br/><font size="13">{"FULL &amp; FINAL PAYMENT BATCH" if batch.run.run_type == "FNF" else "OFF-CYCLE PAYMENT BATCH" if batch.run.run_type == "OFF_CYCLE" else "SALARY PAYMENT BATCH"}</font>', styles['Title'])]], colWidths=[30*mm, 152*mm]),
        Spacer(1, 3*mm),
        Paragraph(
            f'<b>Payroll month:</b> {calendar.month_name[period.month]} {period.year}'
            f'&nbsp;&nbsp;&nbsp; <b>Payment date:</b> {payment_date}'
            f'&nbsp;&nbsp;&nbsp; <b>Batch/reference:</b> {batch.batch_number}'
            f'&nbsp;&nbsp;&nbsp; <b>Payment mode:</b> {escape(batch.payment_mode)}',
            styles['Normal'],
        ),
        Spacer(1, 5*mm),
    ]
    cell_style = ParagraphStyle('PaymentTableCell', parent=styles['Normal'], fontSize=8, leading=10)
    header_style = ParagraphStyle(
        'PaymentTableHeader', parent=cell_style, fontName='Helvetica-Bold',
        textColor=colors.white, alignment=1,
    )
    table_data = [[
        Paragraph('Sl. No.', header_style), Paragraph('Employee ID', header_style),
        Paragraph('Employee Name', header_style), Paragraph('Beneficiary Name', header_style),
        Paragraph('Account Number', header_style), Paragraph('IFSC Code', header_style),
        Paragraph('Net Salary (INR)', header_style),
        Paragraph('Payment Reference /<br/>Remarks', header_style),
    ]]
    for index, line in enumerate(line_list, start=1):
        employee = line.run_employee.employee
        table_data.append([
            str(index), Paragraph(escape(employee.employee_id), cell_style),
            Paragraph(escape(employee.full_name), cell_style),
            Paragraph(escape(line.account_holder_name), cell_style),
            Paragraph(line.bank_account, cell_style), Paragraph(line.ifsc_code, cell_style),
            f'{line.amount:,.2f}',
            Paragraph(escape(f'Salary {calendar.month_name[period.month]} {period.year} | {batch.batch_number}'), cell_style),
        ])
    table_data.append(['', '', '', '', '', 'TOTAL', f'{total:,.2f}', ''])
    table = Table(
        table_data,
        colWidths=[8*mm, 15*mm, 22*mm, 23*mm, 29*mm, 18*mm, 23*mm, 37*mm],
        repeatRows=1, splitByRow=1,
    )
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17365d')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), .4, colors.HexColor('#cbd5e1')),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('WORDWRAP', (0, 0), (-1, -1), 'CJK'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f8fafc')]),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#e8eef5')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (0, -1), 'CENTER'), ('ALIGN', (6, 1), (6, -1), 'RIGHT'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.extend([
        table, Spacer(1, 4*mm),
        Paragraph(
            f'<b>Total beneficiaries:</b> {len(line_list)}'
            f'&nbsp;&nbsp;&nbsp; <b>Total amount to transfer:</b> INR {total:,.2f}'
            f'&nbsp;&nbsp;&nbsp; <b>Payment date:</b> {payment_date}', styles['Normal'],
        ),
        Paragraph(f'<b>Amount in words:</b> {_amount_in_indian_words(total)}', styles['Normal']),
        Spacer(1, 6*mm),
    ])

    approvals = list(batch.run.approval_actions.filter(status='APPROVED').select_related(
        'assigned_to', 'acted_by',
    ).order_by('cycle', 'step_number', 'acted_at'))
    approver_rows = [['Approval step', 'Approver', 'Approved at']]
    if approvals:
        for approval in approvals:
            approver = approval.acted_by or approval.assigned_to
            acted_at = timezone.localtime(approval.acted_at).strftime('%d %b %Y, %I:%M %p') if approval.acted_at else '—'
            approver_rows.append([
                Paragraph(escape(approval.step_name or f'Step {approval.step_number}'), cell_style),
                Paragraph(escape(approver.full_name), cell_style),
                Paragraph(acted_at, cell_style),
            ])
    elif batch.run.approved_by:
        approver_rows.append([
            Paragraph('Run approval', cell_style),
            Paragraph(escape(batch.run.approved_by.full_name), cell_style),
            Paragraph(timezone.localtime(batch.run.approved_at).strftime('%d %b %Y, %I:%M %p') if batch.run.approved_at else '—', cell_style),
        ])
    else:
        approver_rows.append([Paragraph('No approval record available', cell_style), '', ''])
    story.extend([
        Paragraph('<b>Payroll run approval record</b>', styles['Heading2']),
        Table(approver_rows, colWidths=[58*mm, 68*mm, 56*mm], repeatRows=1, style=TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef2f7')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), .5, colors.HexColor('#94a3b8')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ])),
        Spacer(1, 6*mm),
        Table([
            ['Prepared by', 'Verified by', 'Authorized signatory', 'Date / Company seal'],
            ['\n\n\n', '\n\n\n', '\n\n\n', '\n\n\n'],
            ['Name / Signature', 'Name / Signature', 'Name / Signature', ''],
        ], colWidths=[45.5*mm] * 4, rowHeights=[8*mm, 15*mm, 8*mm], style=TableStyle([
            ('GRID', (0, 0), (-1, -1), .5, colors.HexColor('#94a3b8')),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eef2f7')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 8), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ])),
    ])
    doc.build(story)
    return buffer.getvalue(), None


class PayRunPaymentBatchView(APIView):
    """Create/list a bank payment batch for a finalized payroll run."""
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id):
        if not _can_manage_payment_batches(request.user):
            return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
        batches = PaymentBatch.objects.filter(run_id=run_id).prefetch_related('lines')
        return Response([self._serialize(batch) for batch in batches])

    def post(self, request, run_id):
        if not _can_manage_payment_batches(request.user):
            return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
        try:
            run = PayrollRun.objects.select_related('pay_calendar').get(id=run_id)
        except PayrollRun.DoesNotExist:
            return Response({'detail': 'Pay run not found.'}, status=404)
        if run.status not in ('FINALIZED', 'PAID'):
            return Response({'detail': 'Finalize the approved pay run before creating its bank payment batch.'}, status=400)

        payment_mode = str(request.data.get('payment_mode') or 'NEFT').strip().upper()
        if payment_mode not in {'NEFT', 'RTGS', 'IMPS', 'BANK_BULK'}:
            return Response({'payment_mode': 'Choose NEFT, RTGS, IMPS, or BANK_BULK.'}, status=400)

        existing = PaymentBatch.objects.filter(run=run, is_repayment=False).exclude(status='CANCELLED').first()
        if existing:
            return Response(self._serialize(existing))

        run_employees = PayrollRunEmployee.objects.filter(
            run=run, status='CALCULATED', net_pay__gt=0,
        ).select_related('employee').order_by('employee__employee_id')
        if not run_employees.exists():
            return Response({'detail': 'This run has no positive net-pay lines to pay.'}, status=400)

        # Use the bank profile effective on the scheduled pay date and retain
        # an encrypted snapshot on each payment line.
        pay_date = run.payment_date or run.pay_calendar.pay_date
        profiles = EmployeePayrollProfile.objects.filter(
            employee_id__in=run_employees.values('employee_id'),
            is_active=True, effective_from__lte=pay_date,
        ).filter(
            models_Q_to_gte_or_null(pay_date),
        ).order_by('employee_id', '-effective_from')
        profile_by_employee = {}
        for profile in profiles:
            profile_by_employee.setdefault(profile.employee_id, profile)

        missing = []
        invalid_details = []
        line_data = []
        for row in run_employees:
            profile = profile_by_employee.get(row.employee_id)
            employee = row.employee
            account = (profile.bank_account if profile else '') or employee.bank_account_encrypted or ''
            ifsc = (profile.ifsc_code if profile else '') or employee.bank_ifsc_code or ''
            holder = (profile.account_holder_name if profile else '') or employee.bank_account_holder_name or ''
            if not account or not ifsc or not holder:
                missing.append(_payment_employee_label(employee))
                continue
            if not re.fullmatch(r'[A-Za-z0-9]{6,34}', account.strip()):
                invalid_details.append(f'{_payment_employee_label(employee)}: invalid account number (expected 6–34 letters or digits).')
                continue
            if not re.fullmatch(r'[A-Z]{4}0[A-Z0-9]{6}', ifsc.strip().upper()):
                invalid_details.append(f'{_payment_employee_label(employee)}: invalid IFSC code.')
                continue
            if row.net_pay is None or row.net_pay <= 0:
                invalid_details.append(f'{_payment_employee_label(employee)}: net pay must be greater than zero.')
                continue
            line_data.append((row, profile, account, ifsc, holder))
        if missing:
            return Response({
                'detail': 'Bank account, IFSC, and account holder are required for every employee before creating the batch.',
                'employees_missing_bank_details': missing,
            }, status=400)
        if invalid_details:
            return Response({
                'detail': 'The batch was not created because one or more payment details are invalid.',
                'invalid_payment_details': invalid_details,
            }, status=400)

        actor = getattr(request.user, 'employee', None)
        batch = PaymentBatch.objects.create(
            run=run,
            batch_number=f'{"PAY-FNF" if run.run_type == "FNF" else "PAY-ARR" if run.run_type == "ARREARS" else "PAY-OC" if run.run_type == "OFF_CYCLE" else "PAY"}-{run.pay_calendar.year}{run.pay_calendar.month:02d}-{uuid4().hex[:8].upper()}',
            payment_mode=payment_mode,
            total_amount=sum((row.net_pay for row, *_ in line_data), Decimal('0.00')),
            created_by=actor,
            notes='Generic bank upload CSV; confirm the target bank format before upload.',
        )
        PaymentBatchLine.objects.bulk_create([
            PaymentBatchLine(
                batch=batch, run_employee=row,
                bank_account=account.strip(), ifsc_code=ifsc.strip().upper(),
                account_holder_name=holder, amount=row.net_pay,
            ) for row, profile, account, ifsc, holder in line_data
        ])
        return Response(self._serialize(batch), status=201)

    @staticmethod
    def _serialize(batch):
        lines = batch.lines.select_related('run_employee__employee').all()
        return {
            'id': str(batch.id), 'run': str(batch.run_id),
            'batch_number': batch.batch_number, 'bank_name': batch.bank_name,
            'payment_mode': batch.payment_mode,
            'total_amount': str(batch.total_amount), 'status': batch.status,
            'file_generated': batch.file_generated, 'created_at': batch.created_at,
            'payment_date': batch.run.payment_date or batch.run.pay_calendar.pay_date,
            'line_count': lines.count(),
            'settled_count': lines.filter(status='SETTLED').count(),
            'lines': [{
                'id': str(line.id),
                'employee_code': line.run_employee.employee.employee_id,
                'employee_name': line.run_employee.employee.full_name,
                'amount': str(line.amount),
                'status': line.status,
                'utr_number': line.utr_number,
                'settlement_date': line.settlement_date,
                'failure_reason': line.failure_reason,
            } for line in lines],
        }


class PaymentBatchExportView(APIView):
    """Download a generic bank-upload CSV or a printable payment summary PDF."""
    permission_classes = [IsAuthenticated]

    def get(self, request, batch_id, export_format):
        if not _can_manage_payment_batches(request.user):
            return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
        try:
            batch = PaymentBatch.objects.select_related('run__pay_calendar').prefetch_related(
                'lines__run_employee__employee',
            ).get(id=batch_id)
        except PaymentBatch.DoesNotExist:
            return Response({'detail': 'Payment batch not found.'}, status=404)
        lines = batch.lines.select_related('run_employee__employee').order_by(
            'run_employee__employee__employee_id',
        )
        if export_format == 'csv':
            invalid_lines = [message for line in lines if (message := _payment_line_validation_error(line))]
            if invalid_lines:
                return Response({
                    'detail': 'The bank file cannot be generated because payment details are invalid.',
                    'invalid_payment_details': invalid_lines,
                }, status=400)
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="{batch.batch_number}.csv"'
            writer = csv.writer(response)
            writer.writerow(['Beneficiary Name', 'Account Number', 'IFSC', 'Amount', 'Narration', 'Employee Code'])
            for line in lines:
                writer.writerow([
                    line.account_holder_name, line.bank_account, line.ifsc_code,
                    f'{line.amount:.2f}',
                    f'{"Full & final settlement" if batch.run.run_type == "FNF" else "Off-cycle payroll" if batch.run.run_type == "OFF_CYCLE" else "Salary"} {batch.run.pay_calendar.year}-{batch.run.pay_calendar.month:02d}',
                    line.run_employee.employee.employee_id,
                ])
            batch.file_generated = True
            batch.save(update_fields=['file_generated', 'updated_at'])
            return response
        if export_format == 'pdf':
            pdf_content, validation_error = _build_salary_payment_pdf(batch, lines)
            if validation_error:
                return Response(validation_error, status=400)
            batch.file_generated = True
            batch.save(update_fields=['file_generated', 'updated_at'])
            response = HttpResponse(pdf_content, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{batch.batch_number}.pdf"'
            response['Cache-Control'] = 'no-store, private'
            return response

        return Response({'detail': 'Format must be csv or pdf.'}, status=400)


def _whole_rupees(value):
    return int(Decimal(str(value or 0)).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def _statutory_profiles_for_run(run_employees, period_end):
    employee_ids = [row.employee_id for row in run_employees]
    profiles = EmployeePayrollProfile.objects.filter(
        employee_id__in=employee_ids,
    ).order_by(
        'employee_id', '-effective_from', '-created_at',
    )
    result = {}
    for profile in profiles:
        employee_profiles = result.setdefault(profile.employee_id, {
            'effective': None,
            'latest_uan': '',
            'latest_esi_number': '',
        })
        # Statutory membership IDs are normally stable. Prefer the historical
        # version for the wage month, but backfill a missing value from the
        # latest profile that has one. This lets HR enter a newly discovered
        # UAN/IP number today and still prepare a return for a prior month.
        if not employee_profiles['latest_uan'] and (profile.uan or '').strip():
            employee_profiles['latest_uan'] = profile.uan
        if not employee_profiles['latest_esi_number'] and (profile.esi_number or '').strip():
            employee_profiles['latest_esi_number'] = profile.esi_number
        if (
            employee_profiles['effective'] is None
            and profile.effective_from <= period_end
            and (profile.effective_to is None or profile.effective_to >= period_end)
        ):
            employee_profiles['effective'] = profile
    return result


class StatutoryReturnExportView(APIView):
    """PF ECR and ESI payroll review exports from finalized monthly run snapshots."""
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id, export_type):
        if not _can_manage_payment_batches(request.user):
            return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
        if export_type not in {'pf', 'esi'}:
            return Response({'detail': 'Export type must be pf or esi.'}, status=400)
        try:
            run = PayrollRun.objects.select_related('pay_calendar').get(id=run_id)
        except PayrollRun.DoesNotExist:
            return Response({'detail': 'Pay run not found.'}, status=404)
        if run.status not in {'FINALIZED', 'PAID'}:
            return Response({'detail': 'Statutory returns are available only for finalized or paid payroll runs.'}, status=400)
        if run.run_type != 'REGULAR':
            return Response({'detail': 'Monthly statutory exports currently support Regular runs only. Off-cycle, arrears, and F&F need separate reporting rules.'}, status=400)

        period_end = run.pay_calendar.period_end
        run_employees = list(
            PayrollRunEmployee.objects.filter(run=run).exclude(status='EXCLUDED')
            .select_related('employee')
            .prefetch_related('component_details__component')
            .order_by('employee__employee_id')
        )
        if not run_employees:
            return Response({'detail': 'This payroll run has no included employees.'}, status=400)
        incomplete = [
            f'{row.employee.employee_id} ({row.employee.full_name}): payroll result is {row.status.lower()}'
            for row in run_employees if row.status != 'CALCULATED'
        ]
        if incomplete:
            return Response({'detail': 'Every included employee must have a calculated result.', 'errors': incomplete}, status=400)
        profiles = _statutory_profiles_for_run(run_employees, period_end)
        errors = []
        export_rows = []

        for row in run_employees:
            employee = row.employee
            label = f'{employee.employee_id} ({employee.full_name})'
            details = list(row.component_details.all())
            amounts = {
                detail.component.code: Decimal(str(detail.amount or 0))
                for detail in details if detail.component_id and detail.component
            }
            profile_data = profiles.get(employee.id, {})
            profile = profile_data.get('effective')
            snapshot = row.input_snapshot or {}
            # Calculation outputs live at the snapshot root; lock-time fields are nested.
            statutory_snapshot = snapshot

            if export_type == 'pf':
                uan = str(
                    (profile.uan if profile else '')
                    or profile_data.get('latest_uan')
                    or employee.uan_number_encrypted
                    or ''
                ).strip()
                has_pf_components = any(code in amounts for code in ('PF_EMP', 'PF_ER', 'EPS_ER', 'EPF_ER'))
                if not uan and not has_pf_components:
                    continue
                if not re.fullmatch(r'\d{12}', uan):
                    errors.append(f'{label}: a valid 12-digit UAN is required for the PF ECR.')
                    continue

                basic = Decimal(str(statutory_snapshot.get('basic_full_month') or 0))
                if has_pf_components and basic <= 0:
                    errors.append(f'{label}: the frozen Basic wage is missing from this payroll snapshot.')
                    continue
                pf_detail = next((item for item in details if item.component_id and item.component.code in ('PF_EMP', 'PF_ER', 'EPS_ER', 'EPF_ER') and item.rule_reference), None)
                rule = None
                if pf_detail:
                    try:
                        rule = StatutoryRule.objects.get(id=pf_detail.rule_reference, statutory_type='PF')
                    except (StatutoryRule.DoesNotExist, ValueError):
                        errors.append(f'{label}: the PF statutory rule referenced by payroll is no longer available.')
                pf_wage = basic
                if rule and rule.wage_ceiling > 0:
                    pf_wage = min(pf_wage, rule.wage_ceiling)

                ncp_days = Decimal(str(row.lop_days or 0))
                if ncp_days != ncp_days.to_integral_value():
                    errors.append(f'{label}: PF ECR requires whole-number NCP days; payroll has {ncp_days}. Correct the source day data before export.')
                    continue
                if ncp_days < 0 or ncp_days > row.days_in_month:
                    errors.append(f'{label}: NCP days must be between 0 and {row.days_in_month}.')
                    continue
                if not has_pf_components and any(amounts.get(code, 0) for code in ('PF_EMP', 'PF_ER', 'EPS_ER', 'EPF_ER')):
                    errors.append(f'{label}: PF amounts exist but the employee has no PF component details.')
                    continue

                epf_employee = amounts.get('PF_EMP', Decimal('0'))
                eps_employer = amounts.get('EPS_ER', Decimal('0'))
                epf_employer = amounts.get('EPF_ER', Decimal('0'))
                if amounts.get('PF_ER', Decimal('0')) > 0 and not (
                    amounts.get('EPS_ER') is not None and amounts.get('EPF_ER') is not None
                ):
                    errors.append(f'{label}: employer PF is not split into EPS and EPF components; ECR fields cannot be mapped safely.')
                    continue
                if not rule and has_pf_components:
                    errors.append(f'{label}: payroll PF components have no active statutory rule reference; PF wages cannot be validated.')
                    continue
                gross_wages = Decimal(str(
                    statutory_snapshot.get('fixed_gross_pay_prorated')
                    if 'fixed_gross_pay_prorated' in statutory_snapshot else row.gross_pay or 0
                ))
                gross_wages += Decimal(str(statutory_snapshot.get('variable_earnings') or 0))
                if gross_wages == 0 and ncp_days != row.days_in_month:
                    errors.append(f'{label}: EPFO requires NCP days equal to the full wage month when reported wages are zero; payroll has {int(ncp_days)} of {row.days_in_month}.')
                    continue
                if pf_wage > gross_wages:
                    errors.append(f'{label}: PF wage base ₹{pf_wage} exceeds wages payable ₹{gross_wages}. The current payroll result cannot be represented as a valid ECR row; reconcile the PF wage basis with payable salary first.')
                    continue
                if any(value > gross_wages for value in (epf_employee, eps_employer, epf_employer)):
                    errors.append(f'{label}: PF contributions exceed wages payable in the run. Correct the payroll wage/contribution basis before exporting ECR.')
                    continue
                export_rows.append({
                    'employee': employee,
                    'uan': uan,
                    'gross_wages': gross_wages,
                    'pf_wages': pf_wage,
                    # ECR uses separate pensionable and EDLI wage bases. The
                    # notified ceiling rose to ₹25,000 from 17 Sep 2026; older
                    # wage months retain the prior ₹15,000 ceiling.
                    'eps_wages': min(pf_wage, Decimal('25000') if period_end >= date(2026, 9, 17) else Decimal('15000')) if eps_employer > 0 else Decimal('0'),
                    'edli_wages': min(pf_wage, Decimal('25000') if period_end >= date(2026, 9, 17) else Decimal('15000')),
                    'employee_share': epf_employee,
                    'eps_share': eps_employer,
                    'epf_share': epf_employer,
                    'ncp_days': int(ncp_days),
                })
            else:
                ip_number = str(
                    (profile.esi_number if profile else '')
                    or profile_data.get('latest_esi_number')
                    or ''
                ).strip()
                has_esi_components = any(code in amounts for code in ('ESI_EMP', 'ESI_ER'))
                if not ip_number and not has_esi_components:
                    continue
                if not re.fullmatch(r'\d{10}', ip_number):
                    errors.append(f'{label}: a valid 10-digit ESIC IP number is required for the ESI return.')
                    continue
                if Decimal(str(row.payable_days or 0)) != Decimal(str(row.payable_days or 0)).to_integral_value():
                    errors.append(f'{label}: the ESIC contribution return requires whole-number days; payroll has {row.payable_days}.')
                    continue
                fixed_wage_base = Decimal(str(statutory_snapshot.get('esi_wage_base') or 0))
                if has_esi_components and fixed_wage_base <= 0:
                    errors.append(f'{label}: the frozen ESI wage base is missing from this payroll snapshot. Recalculate the run before creating the ESI review export.')
                    continue
                wages_paid = Decimal(str(statutory_snapshot.get('fixed_gross_pay_prorated') or 0))
                employee_pf = amounts.get('PF_EMP', Decimal('0'))
                employee_esi = amounts.get('ESI_EMP', Decimal('0'))
                lop_deduction = sum((
                    Decimal(str(detail.amount or 0))
                    for detail in details
                    if not detail.component_id and (detail.component_label or '').startswith('Leave / LOP Deduction')
                ), Decimal('0'))
                export_rows.append({
                    'employee': employee,
                    'ip_number': ip_number,
                    'days_paid': int(Decimal(str(row.payable_days or 0))),
                    'wages_paid': wages_paid,
                    'esi_wage_base': fixed_wage_base,
                    'gross_pay': Decimal(str(row.gross_pay or 0)),
                    'total_deductions': Decimal(str(row.total_deductions or 0)),
                    'lop_deduction': lop_deduction,
                    'employee_pf': employee_pf,
                    'employee_esi': employee_esi,
                    'other_deductions': Decimal(str(row.total_deductions or 0)) - lop_deduction - employee_pf - employee_esi,
                    'reimbursements': Decimal(str(row.total_reimbursements or 0)),
                    'net_pay': Decimal(str(row.net_pay or 0)),
                    'employee_share': employee_esi,
                    'employer_share': amounts.get('ESI_ER', Decimal('0')),
                    'base_source': 'frozen payroll ESI wage base' if fixed_wage_base else 'missing from payroll snapshot',
                })

        if errors:
            return Response({
                'detail': 'The statutory export was not generated because employee data needs correction.',
                'errors': errors,
            }, status=400)
        if not export_rows:
            return Response({'detail': f'No employees with {export_type.upper()} membership were found in this run.'}, status=400)

        year, month = run.pay_calendar.year, run.pay_calendar.month
        if export_type == 'pf':
            # EPFO ECR 2.0: 11 fields separated by #~#, in the official field order.
            response = HttpResponse(content_type='text/plain; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="EPFO_ECR_{year}_{month:02d}.txt"'
            lines = []
            for item in export_rows:
                lines.append('#~#'.join([
                    item['uan'],
                    re.sub(r'#~#', ' ', item['employee'].full_name).strip(),
                    str(_whole_rupees(item['gross_wages'])),
                    str(_whole_rupees(item['pf_wages'])),
                    str(_whole_rupees(item['eps_wages'])),
                    str(_whole_rupees(item['edli_wages'])),
                    str(_whole_rupees(item['employee_share'])),
                    str(_whole_rupees(item['eps_share'])),
                    str(_whole_rupees(item['epf_share'])),
                    str(item['ncp_days']),
                    '0',
                ]))
            response.write('\r\n'.join(lines))
            response['Cache-Control'] = 'no-store, private'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
        from openpyxl.worksheet.table import Table, TableStyleInfo
        from django.conf import settings
        from HRMSapp.models import CompanyLogo

        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = 'ESI Return Detail'
        company = CompanyLogo.objects.filter(is_active=True).first()
        company_name = company.name if company else getattr(settings, 'COMPANY_NAME', 'Company')
        navy = '17365D'
        pale_blue = 'DCE6F1'
        light_gray = 'F3F6FA'
        white = 'FFFFFF'
        thin_gray = Side(style='thin', color='D6DEE8')

        worksheet.merge_cells('A1:I1')
        worksheet['A1'] = company_name
        worksheet['A1'].font = Font(name='Aptos Display', size=18, bold=True, color=white)
        worksheet['A1'].fill = PatternFill('solid', fgColor=navy)
        worksheet['A1'].alignment = Alignment(horizontal='left', vertical='center')
        worksheet.row_dimensions[1].height = 32

        worksheet.merge_cells('A2:I2')
        worksheet['A2'] = 'ESIC MONTHLY CONTRIBUTION DETAIL'
        worksheet['A2'].font = Font(name='Aptos', size=12, bold=True, color=navy)
        worksheet['A2'].alignment = Alignment(horizontal='left', vertical='center')
        worksheet.row_dimensions[2].height = 24

        worksheet['A3'] = 'Payroll month'
        worksheet['B3'] = f'{calendar.month_name[month]} {year}'
        worksheet['D3'] = 'Pay run status'
        worksheet['E3'] = run.status
        worksheet['G3'] = 'Beneficiaries'
        worksheet['H3'] = len(export_rows)
        for cell in ('A3', 'D3', 'G3'):
            worksheet[cell].font = Font(bold=True, color=navy)
        worksheet.merge_cells('B3:C3')
        worksheet.merge_cells('E3:F3')
        worksheet.merge_cells('H3:I3')
        for row_cells in worksheet.iter_rows(min_row=3, max_row=3, min_col=1, max_col=9):
            for cell in row_cells:
                cell.fill = PatternFill('solid', fgColor=light_gray)
                cell.alignment = Alignment(vertical='center')

        worksheet.merge_cells('A4:I4')
        worksheet['A4'] = 'INTERNAL REVIEW REPORT — this workbook is not the ESIC portal upload template.'
        worksheet['A4'].font = Font(bold=True, color='8A4B08')
        worksheet['A4'].fill = PatternFill('solid', fgColor='FFF2CC')
        worksheet['A4'].alignment = Alignment(vertical='center')
        worksheet.row_dimensions[4].height = 22

        worksheet.merge_cells('A5:I5')
        worksheet['A5'] = 'ESI wages payable are prorated payable wages before employee PF/ESI deductions. The fixed monthly ESI base is the salary basis used to calculate contributions. Verify figures in the ESIC employer portal before filing.'
        worksheet['A5'].font = Font(italic=True, size=9, color='44546A')
        worksheet['A5'].alignment = Alignment(wrap_text=True, vertical='center')
        worksheet.row_dimensions[5].height = 30

        worksheet['A6'] = 'Report generated'
        worksheet['B6'] = timezone.localtime().strftime('%d %b %Y, %H:%M')
        worksheet['D6'] = 'Payroll run reference'
        worksheet['E6'] = str(run.id)
        worksheet.merge_cells('E6:I6')
        for cell in ('A6', 'D6'):
            worksheet[cell].font = Font(bold=True, color=navy)
        for row_cells in worksheet.iter_rows(min_row=6, max_row=6, min_col=1, max_col=9):
            for cell in row_cells:
                cell.alignment = Alignment(vertical='center')

        headers = [
            'ESIC IP Number', 'Employee ID', 'Employee Name', 'Payable Days',
            'ESI Wages Payable Before Employee Deductions (₹)', 'Fixed Monthly ESI Calculation Base (₹)',
            'Employee ESI Contribution (₹)', 'Employer ESI Contribution (₹)', 'Total ESI Contribution (₹)',
        ]
        header_row = 7
        for column, value in enumerate(headers, start=1):
            cell = worksheet.cell(row=header_row, column=column, value=value)
            cell.font = Font(bold=True, color=white)
            cell.fill = PatternFill('solid', fgColor=navy)
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = Border(bottom=Side(style='medium', color=navy))
        worksheet.row_dimensions[header_row].height = 36

        first_data_row = header_row + 1
        for row_number, item in enumerate(export_rows, start=first_data_row):
            values = [
                item['ip_number'], item['employee'].employee_id, item['employee'].full_name,
                item['days_paid'], float(item['wages_paid']), float(item['esi_wage_base']),
                float(item['employee_share']), float(item['employer_share']),
                float(item['employee_share'] + item['employer_share']),
            ]
            for column, value in enumerate(values, start=1):
                cell = worksheet.cell(row=row_number, column=column, value=value)
                cell.border = Border(bottom=thin_gray)
                cell.alignment = Alignment(vertical='center', horizontal='right' if column >= 4 else 'left')
                if row_number % 2 == 0:
                    cell.fill = PatternFill('solid', fgColor=light_gray)
                if column >= 5:
                    cell.number_format = '#,##0.00'

        total_row = first_data_row + len(export_rows)
        worksheet.cell(total_row, 1, 'TOTAL')
        worksheet.cell(total_row, 2, f'{len(export_rows)} beneficiaries')
        for column in range(1, 10):
            cell = worksheet.cell(total_row, column)
            cell.font = Font(bold=True, color=navy)
            cell.fill = PatternFill('solid', fgColor=pale_blue)
            cell.border = Border(top=Side(style='medium', color=navy))
        for column in range(5, 10):
            total_key = {
                5: 'wages_paid',
                6: 'esi_wage_base',
                7: 'employee_share',
                8: 'employer_share',
            }.get(column)
            total_value = (
                sum((item[total_key] for item in export_rows), Decimal('0'))
                if total_key else
                sum((item['employee_share'] + item['employer_share'] for item in export_rows), Decimal('0'))
            )
            worksheet.cell(total_row, column, float(total_value))
            worksheet.cell(total_row, column).number_format = '#,##0.00'

        last_data_row = total_row - 1
        table = Table(displayName='ESIContributionRows', ref=f'A{header_row}:I{last_data_row}')
        table.tableStyleInfo = TableStyleInfo(name='TableStyleMedium2', showFirstColumn=False, showLastColumn=False, showRowStripes=True, showColumnStripes=False)
        worksheet.add_table(table)
        worksheet.freeze_panes = 'A8'
        worksheet.auto_filter.ref = f'A{header_row}:I{last_data_row}'
        worksheet.sheet_view.showGridLines = False
        worksheet.sheet_properties.pageSetUpPr.fitToPage = True
        worksheet.page_setup.orientation = 'landscape'
        worksheet.page_setup.fitToWidth = 1
        worksheet.page_setup.fitToHeight = 0
        worksheet.print_title_rows = f'{header_row}:{header_row}'
        worksheet.print_area = f'A1:I{total_row}'
        for column, width in enumerate((18, 16, 26, 20, 22, 22, 23, 23, 22), start=1):
            worksheet.column_dimensions[chr(64 + column)].width = width

        # Add a payroll-to-net reconciliation so the ESI wage figure is not
        # mistaken for the Gross Pay figure shown in the pay-run detail.
        reconciliation = workbook.create_sheet('Payroll Reconciliation')
        reconciliation.sheet_view.showGridLines = False
        reconciliation_headers = [
            'Employee ID', 'Employee Name', 'Gross Pay in Pay Run (Before Deductions)',
            'ESI Wages Payable Before Employee Deductions', 'Fixed Monthly ESI Calculation Base',
            'LOP Deduction', 'Employee PF Deduction', 'Employee ESI Deduction',
            'Other Deductions', 'Total Deductions', 'Reimbursements', 'Net Pay',
        ]
        reconciliation.merge_cells('A1:L1')
        reconciliation['A1'] = company_name
        reconciliation['A1'].font = Font(name='Aptos Display', size=18, bold=True, color=white)
        reconciliation['A1'].fill = PatternFill('solid', fgColor=navy)
        reconciliation['A1'].alignment = Alignment(vertical='center')
        reconciliation.row_dimensions[1].height = 32
        reconciliation.merge_cells('A2:L2')
        reconciliation['A2'] = 'PAYROLL GROSS-TO-NET RECONCILIATION'
        reconciliation['A2'].font = Font(name='Aptos', size=12, bold=True, color=navy)
        reconciliation['A2'].alignment = Alignment(vertical='center')
        reconciliation['A3'] = f'Payroll month: {calendar.month_name[month]} {year}'
        reconciliation['D3'] = f'Run status: {run.status}'
        reconciliation['G3'] = f'Employees: {len(export_rows)}'
        reconciliation.merge_cells('A3:C3')
        reconciliation.merge_cells('D3:F3')
        reconciliation.merge_cells('G3:L3')
        reconciliation.merge_cells('A4:L4')
        reconciliation['A4'] = ('Gross Pay matches Pay Run detail and is before deductions. ESI wages are prorated payable wages before employee PF/ESI. '
                                'LOP is a separate deduction. Net Pay = Gross Pay + Reimbursements − Total Deductions.')
        reconciliation['A4'].font = Font(italic=True, size=9, color='44546A')
        reconciliation['A4'].alignment = Alignment(wrap_text=True, vertical='center')
        reconciliation.row_dimensions[4].height = 32
        reconciliation.merge_cells('A5:L5')
        reconciliation['A5'] = f'Internal review only · generated {timezone.localtime().strftime("%d %b %Y, %H:%M")} · Run {run.id}'
        reconciliation['A5'].font = Font(italic=True, size=9, color='44546A')
        for column, value in enumerate(reconciliation_headers, start=1):
            cell = reconciliation.cell(7, column, value)
            cell.font = Font(bold=True, color=white)
            cell.fill = PatternFill('solid', fgColor=navy)
            cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            cell.border = Border(bottom=Side(style='medium', color=navy))
        reconciliation.row_dimensions[7].height = 46
        money_columns = set(range(3, 13))
        for row_number, item in enumerate(export_rows, start=8):
            values = [
                item['employee'].employee_id, item['employee'].full_name, float(item['gross_pay']),
                float(item['wages_paid']), float(item['esi_wage_base']), float(item['lop_deduction']),
                float(item['employee_pf']), float(item['employee_esi']), float(item['other_deductions']),
                float(item['total_deductions']), float(item['reimbursements']), float(item['net_pay']),
            ]
            for column, value in enumerate(values, start=1):
                cell = reconciliation.cell(row_number, column, value)
                cell.border = Border(bottom=thin_gray)
                cell.alignment = Alignment(vertical='center', horizontal='right' if column in money_columns else 'left')
                if row_number % 2 == 0:
                    cell.fill = PatternFill('solid', fgColor=light_gray)
                if column in money_columns:
                    cell.number_format = '#,##0.00'
        recon_total_row = 8 + len(export_rows)
        reconciliation.cell(recon_total_row, 1, 'TOTAL')
        for column in range(1, 13):
            cell = reconciliation.cell(recon_total_row, column)
            cell.font = Font(bold=True, color=navy)
            cell.fill = PatternFill('solid', fgColor=pale_blue)
            cell.border = Border(top=Side(style='medium', color=navy))
            if column in money_columns:
                cell.value = sum((item[{
                    3: 'gross_pay', 4: 'wages_paid', 5: 'esi_wage_base', 6: 'lop_deduction',
                    7: 'employee_pf', 8: 'employee_esi', 9: 'other_deductions',
                    10: 'total_deductions', 11: 'reimbursements', 12: 'net_pay',
                }[column]] for item in export_rows), Decimal('0'))
                cell.number_format = '#,##0.00'
        last_recon_data_row = recon_total_row - 1
        if last_recon_data_row >= 8:
            table = Table(displayName='PayrollReconciliationRows', ref=f'A7:L{last_recon_data_row}')
            table.tableStyleInfo = TableStyleInfo(name='TableStyleMedium2', showRowStripes=True, showColumnStripes=False)
            reconciliation.add_table(table)
            reconciliation.auto_filter.ref = f'A7:L{last_recon_data_row}'
        reconciliation.freeze_panes = 'A8'
        reconciliation.sheet_properties.pageSetUpPr.fitToPage = True
        reconciliation.page_setup.orientation = 'landscape'
        reconciliation.page_setup.fitToWidth = 1
        reconciliation.page_setup.fitToHeight = 0
        reconciliation.print_title_rows = '7:7'
        reconciliation.print_area = f'A1:L{recon_total_row}'
        for column, width in enumerate((16, 25, 25, 28, 27, 17, 19, 19, 19, 20, 17, 17), start=1):
            reconciliation.column_dimensions[chr(64 + column)].width = width

        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="ESIC_Contribution_Review_{year}_{month:02d}.xlsx"'
        response['Cache-Control'] = 'no-store, private'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class StatutoryHistoryExportView(APIView):
    """Serve employee PF/ESI history for the UI and employee Excel exports."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from HRMSapp.models import Employee
        is_admin = is_hr_or_system_admin(request.user)
        json_mode = request.query_params.get('format') == 'json'
        scope = request.query_params.get('scope', 'mine' if json_mode else '')
        export_all = not json_mode and scope == 'all'
        employee_filter = None
        if json_mode:
            if scope == 'all':
                if not is_admin:
                    return Response({'detail': 'Only HR or system administrators can view all employee history.'}, status=403)
                selected_employees = list(Employee.objects.filter(is_deleted=False).order_by('employee_id'))
            elif scope == 'mine':
                employee = getattr(request.user, 'employee', None)
                if employee is None:
                    return Response({'detail': 'No employee profile is linked to this account.'}, status=404)
                selected_employees = [employee]
            else:
                return Response({'detail': 'scope must be mine or all.'}, status=400)
        else:
            if export_all:
                if not is_admin:
                    return Response({'detail': 'Only HR or system administrators can export all employee history.'}, status=403)
                selected_employees = list(Employee.objects.filter(is_deleted=False).order_by('employee_id'))
            else:
                if not _can_manage_payment_batches(request.user):
                    return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
                employee_id = request.query_params.get('employee_id', '').strip()
                if not employee_id:
                    return Response({'detail': 'Select an employee to download their PF and ESI history.'}, status=400)
                try:
                    employee_uuid = UUID(employee_id)
                except (ValueError, TypeError, AttributeError):
                    return Response({'detail': 'A valid employee ID is required.'}, status=400)
                employee_filter = Employee.objects.filter(id=employee_uuid, is_deleted=False).first()
                if employee_filter is None:
                    return Response({'detail': 'Employee not found.'}, status=404)
                selected_employees = [employee_filter]
        selected_employee_ids = [employee.id for employee in selected_employees]

        today = timezone.localdate()
        runs = PayrollRun.objects.filter(
            run_type='REGULAR', status__in=['FINALIZED', 'PAID'],
            pay_calendar__period_start__lte=today,
        ).select_related('pay_calendar').order_by(
            'pay_calendar__year', 'pay_calendar__month', '-status', '-updated_at',
        )

        monthly = {}
        employees = {}
        seen_periods = set()
        pf_members = set()
        esi_members = set()
        pf_rule_cache = {}
        pf_codes = {'PF_EMP', 'PF_ER', 'EPS_ER', 'EPF_ER'}
        esi_codes = {'ESI_EMP', 'ESI_ER'}
        for run in runs:
            period_key = (run.pay_calendar.year, run.pay_calendar.month)
            if period_key in seen_periods:
                continue
            run_rows = list(
                PayrollRunEmployee.objects.filter(
                    run=run, status='CALCULATED', employee_id__in=selected_employee_ids,
                )
                .select_related('employee')
                .prefetch_related('component_details__component')
                .order_by('employee__employee_id')
            )
            if not run_rows:
                continue
            seen_periods.add(period_key)
            profiles = _statutory_profiles_for_run(run_rows, run.pay_calendar.period_end)
            for row in run_rows:
                employee = row.employee
                employees[employee.id] = employee
                details = list(row.component_details.all())
                amounts = {
                    detail.component.code: Decimal(str(detail.amount or 0))
                    for detail in details if detail.component_id and detail.component
                }
                has_pf = any(detail.component and detail.component.code in pf_codes for detail in details)
                has_esi = any(detail.component and detail.component.code in esi_codes for detail in details)
                profile_data = profiles.get(employee.id, {})
                profile = profile_data.get('effective')
                snapshot = row.input_snapshot or {}

                pf_data = None
                if has_pf:
                    basic = Decimal(str(snapshot.get('basic_full_month') or 0))
                    pf_detail = next((detail for detail in details if detail.component and detail.component.code in pf_codes and detail.rule_reference), None)
                    rule = None
                    if pf_detail:
                        rule_key = str(pf_detail.rule_reference)
                        if rule_key not in pf_rule_cache:
                            try:
                                pf_rule_cache[rule_key] = StatutoryRule.objects.filter(
                                    id=rule_key, statutory_type='PF',
                                ).first()
                            except (ValueError, TypeError):
                                pf_rule_cache[rule_key] = None
                        rule = pf_rule_cache[rule_key]
                    pf_wages = min(basic, rule.wage_ceiling) if rule and rule.wage_ceiling > 0 else basic
                    gross_wages = Decimal(str(
                        snapshot.get('fixed_gross_pay_prorated')
                        if 'fixed_gross_pay_prorated' in snapshot else row.gross_pay or 0
                    )) + Decimal(str(snapshot.get('variable_earnings') or 0))
                    employee_pf = amounts.get('PF_EMP', Decimal('0'))
                    employer_eps = amounts.get('EPS_ER', Decimal('0'))
                    employer_epf = amounts.get('EPF_ER', Decimal('0'))
                    if not employer_epf and not any(detail.component and detail.component.code == 'EPF_ER' for detail in details):
                        employer_epf = amounts.get('PF_ER', Decimal('0')) - employer_eps
                    pf_data = {
                        'uan': str((profile.uan if profile else '') or profile_data.get('latest_uan') or employee.uan_number_encrypted or '').strip(),
                        'gross_wages': gross_wages,
                        'pf_wages': pf_wages,
                        'employee_share': employee_pf,
                        'employer_eps': employer_eps,
                        'employer_epf': employer_epf,
                        'total_contribution': employee_pf + employer_eps + employer_epf,
                        'ncp_days': Decimal(str(row.lop_days or 0)),
                    }

                esi_data = None
                if has_esi:
                    employee_esi = amounts.get('ESI_EMP', Decimal('0'))
                    employer_esi = amounts.get('ESI_ER', Decimal('0'))
                    esi_data = {
                        'ip_number': str((profile.esi_number if profile else '') or profile_data.get('latest_esi_number') or '').strip(),
                        'days_paid': Decimal(str(row.payable_days or 0)),
                        'wages_paid': Decimal(str(snapshot.get('fixed_gross_pay_prorated') or 0)),
                        'esi_wage_base': Decimal(str(snapshot.get('esi_wage_base') or 0)),
                        'employee_share': employee_esi,
                        'employer_share': employer_esi,
                        'total_contribution': employee_esi + employer_esi,
                    }

                if has_pf:
                    pf_members.add(employee.id)
                if has_esi:
                    esi_members.add(employee.id)
                monthly[(employee.id, *period_key)] = {
                    'run': run,
                    'pf': pf_data,
                    'esi': esi_data,
                }

        if not pf_members and not esi_members and not json_mode:
            return Response({'detail': 'No finalized or paid payroll records with PF or ESI components were found.'}, status=400)

        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill

        workbook = Workbook()
        workbook.remove(workbook.active)
        navy = '17365D'
        light_blue = 'DCE6F1'
        light_gray = 'F3F6FA'
        currency_format = '#,##0.00'

        def add_sheet(title, headers, data_rows, money_columns=()):
            sheet = workbook.create_sheet(title)
            sheet.sheet_view.showGridLines = False
            sheet.append(headers)
            for cell in sheet[1]:
                cell.font = Font(bold=True, color='FFFFFF')
                cell.fill = PatternFill('solid', fgColor=navy)
                cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
            sheet.row_dimensions[1].height = 36
            for values in data_rows:
                sheet.append(values)
                row_number = sheet.max_row
                for cell in sheet[row_number]:
                    cell.alignment = Alignment(vertical='center')
                    if row_number % 2 == 0:
                        cell.fill = PatternFill('solid', fgColor=light_gray)
                for column in money_columns:
                    sheet.cell(row_number, column).number_format = currency_format
            if sheet.max_row > 1:
                sheet.auto_filter.ref = sheet.dimensions
            sheet.freeze_panes = 'A2'
            for column, header in enumerate(headers, start=1):
                width = min(max(len(str(header)) + 2, 14), 32)
                sheet.column_dimensions[chr(64 + column)].width = width
            return sheet

        def month_rows(member_ids, kind):
            result = []
            summary = []
            today_month = date(today.year, today.month, 1)
            for employee_id in sorted(member_ids, key=lambda item: employees[item].employee_id):
                employee = employees[employee_id]
                start = date(employee.date_of_joining.year, employee.date_of_joining.month, 1)
                last_day = min(today, employee.date_of_exit) if employee.date_of_exit else today
                end = date(last_day.year, last_day.month, 1)
                if start > today_month or start > end:
                    continue
                cumulative = {
                    'employee_share': Decimal('0'),
                    'employer_share': Decimal('0'),
                    'employer_eps': Decimal('0'),
                    'employer_epf': Decimal('0'),
                    'total_contribution': Decimal('0'),
                }
                month = start
                last_reported = ''
                while month <= end:
                    record = monthly.get((employee_id, month.year, month.month))
                    values = record.get(kind) if record else None
                    if values:
                        cumulative['employee_share'] += values['employee_share']
                        cumulative['total_contribution'] += values['total_contribution']
                        if kind == 'pf':
                            cumulative['employer_eps'] += values['employer_eps']
                            cumulative['employer_epf'] += values['employer_epf']
                            employer_share = values['employer_eps'] + values['employer_epf']
                            uan_or_ip = values['uan']
                            wage_value = values['pf_wages']
                            employer_eps = values['employer_eps']
                            employer_epf = values['employer_epf']
                            employer_contribution = employer_share
                            employee_contribution = values['employee_share']
                        else:
                            cumulative['employer_share'] += values['employer_share']
                            uan_or_ip = values['ip_number']
                            wage_value = values['wages_paid']
                            employer_eps = None
                            employer_epf = None
                            employer_contribution = values['employer_share']
                            employee_contribution = values['employee_share']
                        status_text = f"Payroll {record['run'].status}"
                        last_reported = f'{month.year}-{month.month:02d}'
                        row_values = [
                            employee.employee_id, employee.full_name, employee.date_of_joining.isoformat(),
                            f'{month.year}-{month.month:02d}', uan_or_ip, float(wage_value),
                            float(employee_contribution),
                        ]
                        if kind == 'pf':
                            row_values.extend([float(employer_eps), float(employer_epf), float(employer_contribution)])
                        else:
                            row_values.append(float(employer_contribution))
                        row_values.extend([float(values['total_contribution']), float(cumulative['employee_share'])])
                        if kind == 'pf':
                            cumulative_employer = cumulative['employer_eps'] + cumulative['employer_epf']
                        else:
                            cumulative_employer = cumulative['employer_share']
                        row_values.extend([float(cumulative_employer), float(cumulative['total_contribution']), status_text, str(record['run'].id)])
                    else:
                        status_text = (
                            f"No {kind.upper()} contribution line in finalized payroll"
                            if record else 'No finalized payroll result for this month'
                        )
                        row_values = [
                            employee.employee_id, employee.full_name, employee.date_of_joining.isoformat(),
                            f'{month.year}-{month.month:02d}', '', None, None,
                        ]
                        if kind == 'pf':
                            row_values.extend([None, None, None])
                            cumulative_employer = cumulative['employer_eps'] + cumulative['employer_epf']
                        else:
                            row_values.append(None)
                            cumulative_employer = cumulative['employer_share']
                        row_values.extend([
                            None, float(cumulative['employee_share']), float(cumulative_employer),
                            float(cumulative['total_contribution']), status_text, '',
                        ])
                    result.append(row_values)
                    month = date(month.year + (1 if month.month == 12 else 0), 1 if month.month == 12 else month.month + 1, 1)
                summary.append([
                    employee.employee_id, employee.full_name, employee.date_of_joining.isoformat(),
                    employee.date_of_exit.isoformat() if employee.date_of_exit else '', last_reported,
                    float(cumulative['employee_share']),
                    float((cumulative['employer_eps'] + cumulative['employer_epf']) if kind == 'pf' else cumulative['employer_share']),
                    float(cumulative['total_contribution']),
                ])
            return result, summary

        pf_rows, pf_summary = month_rows(pf_members, 'pf')
        esi_rows, esi_summary = month_rows(esi_members, 'esi')
        pf_headers = [
            'Employee ID', 'Employee Name', 'DOJ', 'Wage Month', 'UAN', 'PF Wages (₹)',
            'Employee PF (₹)', 'Employer EPS (₹)', 'Employer EPF (₹)', 'Employer Total (₹)',
            'Monthly Total (₹)', 'Cumulative Employee PF (₹)', 'Cumulative Employer PF (₹)',
            'Cumulative PF Total (₹)', 'Payroll Status', 'Payroll Run ID',
        ]
        esi_headers = [
            'Employee ID', 'Employee Name', 'DOJ', 'Wage Month', 'ESIC IP Number', 'ESI Wages (₹)',
            'Employee ESI (₹)', 'Employer ESI (₹)', 'Monthly Total (₹)',
            'Cumulative Employee ESI (₹)', 'Cumulative Employer ESI (₹)',
            'Cumulative ESI Total (₹)', 'Payroll Status', 'Payroll Run ID',
        ]
        summary_headers = [
            'Employee ID', 'Employee Name', 'DOJ', 'DOE', 'Last Reported Wage Month',
            'Employee Contributions (₹)', 'Employer Contributions (₹)', 'Total Contributions (₹)',
        ]
        if json_mode:
            response = Response({
                'scope': scope,
                'pf_headers': pf_headers,
                'pf_monthly': pf_rows,
                'pf_totals': pf_summary,
                'esi_headers': esi_headers,
                'esi_monthly': esi_rows,
                'esi_totals': esi_summary,
                'employees': [
                    {'id': employee.id, 'employee_id': employee.employee_id, 'full_name': employee.full_name}
                    for employee in selected_employees
                ],
            })
            response['Cache-Control'] = 'no-store, private'
            return response
        pf_money = (6, 7, 8, 9, 10, 11, 12, 13, 14)
        esi_money = (6, 7, 8, 9, 10, 11, 12)
        summary_money = (6, 7, 8)
        add_sheet('PF Monthly History', pf_headers, pf_rows, pf_money)
        add_sheet('PF Employee Totals', summary_headers, pf_summary, summary_money)
        add_sheet('ESI Monthly History', esi_headers, esi_rows, esi_money)
        add_sheet('ESI Employee Totals', summary_headers, esi_summary, summary_money)
        notes = add_sheet('Read Me', ['Report Notes'], [
            ['Includes finalized and paid Regular payroll runs only; open, reversed, off-cycle, arrears, and F&F runs are excluded.'],
            ['Monthly History starts at DOJ month and continues through the current month, or DOE month for exited employees.'],
            ['Months without a finalized contribution are flagged and left blank; cumulative totals include only finalized/paid payroll contribution lines.'],
            ['Totals are payroll contribution totals. They do not include EPFO/ESIC portal postings, interest, or account balances.'],
            ['EPFO upload remains a separate monthly .txt file. EPFO ECR 2.0 requires 11 #~#-separated fields and the wage period is selected in the portal.'],
        ])
        notes.column_dimensions['A'].width = 120
        output = BytesIO()
        workbook.save(output)
        response = HttpResponse(
            output.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        filename = (
            f'PF_ESI_History_All_Employees_{today:%Y%m%d}.xlsx' if export_all
            else f'PF_ESI_History_{employee_filter.employee_id}_{today:%Y%m%d}.xlsx'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Cache-Control'] = 'no-store, private'
        response['Access-Control-Expose-Headers'] = 'Content-Disposition'
        return response


class PaymentBatchRefreshBankDetailsView(APIView):
    """Refresh frozen bank snapshots before any payment file has been generated."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, batch_id):
        if not _can_manage_payment_batches(request.user):
            return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
        try:
            batch = PaymentBatch.objects.select_for_update().select_related(
                'run__pay_calendar',
            ).get(id=batch_id)
        except PaymentBatch.DoesNotExist:
            return Response({'detail': 'Payment batch not found.'}, status=404)
        if batch.status != 'PENDING' or batch.file_generated:
            return Response({
                'detail': 'Bank details can only be refreshed while the batch is pending and no bank file has been generated.'
            }, status=400)

        lines = list(batch.lines.select_related('run_employee__employee'))
        if any(line.status != 'PENDING' for line in lines):
            return Response({'detail': 'Bank details cannot be refreshed after any payment line has been uploaded or reconciled.'}, status=400)
        pay_date = batch.run.payment_date or batch.run.pay_calendar.pay_date
        employee_ids = [line.run_employee.employee_id for line in lines]
        profiles = EmployeePayrollProfile.objects.filter(
            employee_id__in=employee_ids, is_active=True, effective_from__lte=pay_date,
        ).filter(models_Q_to_gte_or_null(pay_date)).order_by('employee_id', '-effective_from')
        profile_by_employee = {}
        for profile in profiles:
            profile_by_employee.setdefault(profile.employee_id, profile)

        updates = []
        errors = []
        for line in lines:
            employee = line.run_employee.employee
            profile = profile_by_employee.get(employee.id)
            account = ((profile.bank_account if profile else '') or employee.bank_account_encrypted or '').strip()
            ifsc = ((profile.ifsc_code if profile else '') or employee.bank_ifsc_code or '').strip().upper()
            holder = ((profile.account_holder_name if profile else '') or employee.bank_account_holder_name or '').strip()
            if not account or not ifsc or not holder:
                errors.append(f'{_payment_employee_label(employee)}: account number, IFSC, and account holder are required.')
            elif not re.fullmatch(r'[A-Za-z0-9]{6,34}', account):
                errors.append(f'{_payment_employee_label(employee)}: account number must contain 6–34 letters or digits.')
            elif not re.fullmatch(r'[A-Z]{4}0[A-Z0-9]{6}', ifsc):
                errors.append(f'{_payment_employee_label(employee)}: IFSC must be 11 characters in the format ABCD0123456.')
            else:
                line.bank_account = account
                line.ifsc_code = ifsc
                line.account_holder_name = holder
                line.updated_at = timezone.now()
                updates.append(line)
        if errors:
            return Response({'detail': 'Bank details were not refreshed.', 'invalid_payment_details': errors}, status=400)
        PaymentBatchLine.objects.bulk_update(updates, ['bank_account', 'ifsc_code', 'account_holder_name', 'updated_at'])
        return Response({'detail': 'Bank details refreshed from the profiles effective on the payment date.', 'refreshed_lines': len(updates)})


class PaymentBatchLineStatusView(APIView):
    """Finance updates bank upload and settlement details per employee."""
    permission_classes = [IsAuthenticated]
    ALLOWED = {'UPLOADED', 'SETTLED', 'FAILED', 'RETURNED', 'REPAYMENT_PENDING'}

    def patch(self, request, batch_id, line_id):
        if not _can_manage_payment_batches(request.user):
            return Response({'detail': 'Finance or payroll admin access is required.'}, status=403)
        try:
            line = PaymentBatchLine.objects.select_related('batch').get(
                id=line_id, batch_id=batch_id,
            )
        except PaymentBatchLine.DoesNotExist:
            return Response({'detail': 'Payment line not found.'}, status=404)
        new_status = request.data.get('status')
        if new_status not in self.ALLOWED:
            return Response({'status': f'Choose one of: {", ".join(sorted(self.ALLOWED))}.'}, status=400)
        utr_number = str(request.data.get('utr_number', line.utr_number) or '').strip()
        failure_reason = str(request.data.get('failure_reason', line.failure_reason) or '').strip()
        settlement_date = request.data.get('settlement_date', line.settlement_date)
        if settlement_date:
            try:
                settlement_date = date.fromisoformat(str(settlement_date))
            except ValueError:
                return Response({'settlement_date': 'Enter a date in YYYY-MM-DD format.'}, status=400)
        if new_status == 'SETTLED' and not utr_number:
            return Response({'utr_number': 'UTR is required when marking a payment as settled.'}, status=400)
        if new_status in {'FAILED', 'RETURNED'} and not failure_reason:
            return Response({'failure_reason': 'A reason is required for failed or returned payments.'}, status=400)

        line.status = new_status
        line.utr_number = utr_number
        line.settlement_date = settlement_date if new_status == 'SETTLED' else None
        line.failure_reason = failure_reason if new_status in {'FAILED', 'RETURNED'} else ''
        line.status_updated_at = timezone.now()
        line.status_updated_by = getattr(request.user, 'employee', None)
        line.save(update_fields=[
            'status', 'utr_number', 'settlement_date', 'failure_reason',
            'status_updated_at', 'status_updated_by', 'updated_at',
        ])
        lines = line.batch.lines.all()
        statuses = list(lines.values_list('status', flat=True))
        if statuses and all(value == 'SETTLED' for value in statuses):
            line.batch.status = 'RECONCILED'
        elif statuses and all(value == 'UPLOADED' for value in statuses):
            line.batch.status = 'UPLOADED'
        elif any(value != 'PENDING' for value in statuses):
            line.batch.status = 'PARTIALLY_RECONCILED'
        else:
            line.batch.status = 'PENDING'
        line.batch.save(update_fields=['status', 'updated_at'])
        return Response(PayRunPaymentBatchView._serialize(line.batch))


class RunEmployeeListView(APIView):
    """GET /runs/<run_id>/employees/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id):
        if not is_hr_or_system_admin(request.user) and not _can_manage_payment_batches(request.user):
            employee = getattr(request.user, 'employee', None)
            if employee is None or not PayrollRunApprovalAction.objects.filter(
                run_id=run_id, assigned_to=employee,
            ).exists():
                return Response({'detail': 'You are not assigned to review this pay run.'}, status=403)
        qs = PayrollRunEmployee.objects.filter(
            run_id=run_id
        ).select_related('employee').order_by('employee__employee_id')
        ser = PayrollRunEmployeeListSerializer(qs, many=True)
        return Response(ser.data)


class RunAdjustmentListCreateView(APIView):
    """List or add month-specific variable pay, deductions, and reimbursements."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request, run_id):
        rows = PayrollRunAdjustment.objects.filter(run_id=run_id).select_related('employee')
        return Response(PayrollRunAdjustmentSerializer(rows, many=True).data)

    def post(self, request, run_id):
        try:
            run = PayrollRun.objects.get(id=run_id)
        except PayrollRun.DoesNotExist:
            return Response({'detail': 'Pay run not found.'}, status=404)
        if run.run_type == 'ARREARS':
            return Response({'detail': 'Arrears run items are loaded automatically from generated, unsettled arrears when inputs are locked.'}, status=400)
        can_add_before_calculation = run.status == 'LOCKED'
        can_add_to_returned_run = run.status == 'CALCULATED' and bool(run.returned_by_id)
        if not (can_add_before_calculation or can_add_to_returned_run):
            return Response(
                {'detail': 'Adjustments can only be entered before calculation or while a run is returned for correction.'},
                status=400,
            )
        if run.run_type == 'OFF_CYCLE' and not request.data.get('reason', '').strip():
            return Response({'reason': 'A business reason is required for every off-cycle pay item.'}, status=400)
        serializer = PayrollRunAdjustmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if run.run_type == 'OFF_CYCLE' and serializer.validated_data.get('category') == 'INCREMENT_DIFFERENCE':
            if not serializer.validated_data.get('reference_period_start') or not serializer.validated_data.get('reference_period_end'):
                return Response({'reference_period_start': 'Enter the from and through dates covered by this increment difference.'}, status=400)
        employee = serializer.validated_data['employee']
        if not PayrollRunEmployee.objects.filter(
            run=run, employee=employee, status__in=['PENDING', 'CALCULATED'],
        ).exists():
            return Response({'detail': 'Employee is not included in this pay run.'}, status=400)
        row = serializer.save(
            run=run, created_by=getattr(request.user, 'employee', None),
        )
        PayrollAuditLog.objects.create(
            run=run, employee=employee, action='OFF_CYCLE_ADJUSTMENT_ADDED' if run.run_type == 'OFF_CYCLE' else 'RUN_ADJUSTMENT_ADDED',
            reason=row.reason, performed_by=getattr(request.user, 'employee', None),
            new_values={
                'adjustment_id': str(row.id), 'category': row.category,
                'adjustment_type': row.adjustment_type, 'label': row.label,
                'amount': str(row.amount), 'taxable': row.taxable,
                'reference_period_start': str(row.reference_period_start) if row.reference_period_start else None,
                'reference_period_end': str(row.reference_period_end) if row.reference_period_end else None,
            },
        )
        return Response(PayrollRunAdjustmentSerializer(row).data, status=201)


class RunAdjustmentDetailView(APIView):
    """Delete a mistaken line before calculation or while correcting a returned run."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def delete(self, request, run_id, adjustment_id):
        try:
            run = PayrollRun.objects.get(id=run_id)
            row = PayrollRunAdjustment.objects.select_related('employee').get(
                id=adjustment_id, run=run,
            )
        except (PayrollRun.DoesNotExist, PayrollRunAdjustment.DoesNotExist):
            return Response({'detail': 'Pay run adjustment not found.'}, status=404)
        if not (run.status == 'LOCKED' or (run.status == 'CALCULATED' and run.returned_by_id)):
            return Response({'detail': 'Pay items can only be removed before calculation or while a run is returned for correction.'}, status=400)
        if row.source_claim_id:
            return Response({'detail': 'A reimbursement imported from an approved claim cannot be removed here.'}, status=400)
        if row.arrears_item_id:
            return Response({'detail': 'Generated arrears cannot be removed from a run. Reverse the run to release them, or correct the source assignment and regenerate before settlement.'}, status=400)
        actor = getattr(request.user, 'employee', None)
        PayrollAuditLog.objects.create(
            run=run, employee=row.employee, action='RUN_ADJUSTMENT_REMOVED',
            reason=request.data.get('reason', 'Adjustment removed before approval.'),
            performed_by=actor,
            old_values={
                'adjustment_id': str(row.id), 'category': row.category,
                'adjustment_type': row.adjustment_type, 'label': row.label,
                'amount': str(row.amount), 'taxable': row.taxable,
                'reason': row.reason,
            },
        )
        row.delete()
        return Response({'detail': 'Pay item removed.'})


class RunEmployeeDetailView(APIView):
    """GET /runs/<run_id>/employees/<pk>/"""
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id, pk):
        try:
            re = PayrollRunEmployee.objects.select_related(
                'employee', 'salary_assignment'
            ).prefetch_related('component_details__component').get(
                id=pk, run_id=run_id,
            )
        except PayrollRunEmployee.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        if not is_hr_or_system_admin(request.user) and not _can_manage_payment_batches(request.user):
            employee = getattr(request.user, 'employee', None)
            if employee is None or not PayrollRunApprovalAction.objects.filter(
                run_id=run_id, assigned_to=employee,
            ).exists():
                return Response({'detail': 'You are not assigned to review this pay run.'}, status=403)
        payload = PayrollRunEmployeeDetailSerializer(re).data
        locked_day_data = ((re.input_snapshot or {}).get('locked_inputs') or {}).get('day_data') or {}
        off_day_dates = [
            day for day, day_status in (locked_day_data.get('day_map') or {}).items()
            if day_status == 'off_day_worked'
        ]
        if off_day_dates:
            from leaveapp.models import CompOffCreditLog
            payload['off_day_credit_days_by_date'] = {
                item['credit_date'].isoformat(): str(item['comp_off_days'])
                for item in CompOffCreditLog.objects.filter(
                    employee=re.employee, credit_date__in=off_day_dates,
                ).values('credit_date', 'comp_off_days')
            }
        else:
            payload['off_day_credit_days_by_date'] = {}
        return Response(payload)


class RunEmployeeOffDayAllocationView(APIView):
    """Update how a calculated regular-run employee's off-day work is settled."""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    @transaction.atomic
    def post(self, request, run_id, pk):
        run = PayrollRun.objects.select_for_update().filter(id=run_id).first()
        if not run:
            return Response({'detail': 'Payroll run not found.'}, status=status.HTTP_404_NOT_FOUND)
        if run.run_type != 'REGULAR':
            return Response({'detail': 'Extra worked-day allocation is available only for regular payroll runs.'}, status=400)
        if run.status != 'CALCULATED':
            return Response({'detail': 'Update the allocation while the run is calculated and before it is submitted for approval.'}, status=400)

        row = PayrollRunEmployee.objects.select_for_update().filter(
            id=pk, run=run, status='CALCULATED',
        ).select_related('employee').first()
        if not row:
            return Response({'detail': 'Calculated employee record not found.'}, status=404)

        try:
            requested_paid_days = Decimal(str(request.data.get('paid_days', '')))
        except Exception:
            return Response({'detail': 'paid_days must be a whole number.'}, status=400)
        if not requested_paid_days.is_finite() or requested_paid_days != requested_paid_days.to_integral_value():
            return Response({'detail': 'Paid extra-work days must be a whole number.'}, status=400)

        snapshot = row.input_snapshot or {}
        locked_day_data = (snapshot.get('locked_inputs') or {}).get('day_data') or {}
        worked_dates = sorted(
            str(day) for day, day_status in (locked_day_data.get('day_map') or {}).items()
            if day_status == 'off_day_worked'
        )
        total_worked_days = len(worked_dates)
        paid_count = int(requested_paid_days)
        if paid_count < 0 or paid_count > total_worked_days:
            return Response({'detail': f'Enter a number from 0 to {total_worked_days}.'}, status=400)

        paid_dates = worked_dates[:paid_count]
        comp_off_dates = worked_dates[paid_count:]
        try:
            from leaveapp.models import CompOffCreditLog
            credit_rows = list(CompOffCreditLog.objects.filter(
                employee=row.employee, credit_date__in=comp_off_dates,
                paid_in_payroll_run_id='',
            ).values_list('comp_off_days', flat=True))
            eligible_comp_off_days = sum((Decimal(str(value)) for value in credit_rows), Decimal('0'))
        except ImportError:
            eligible_comp_off_days = Decimal('0')

        previous_allocation = snapshot.get('off_day_allocation') or {}
        allocation = {
            **previous_allocation,
            'total_worked_days': str(total_worked_days),
            'paid_days': str(paid_count),
            'comp_off_work_days': str(len(comp_off_dates)),
            'eligible_comp_off_days': str(eligible_comp_off_days),
            'paid_dates': paid_dates,
            'comp_off_dates': comp_off_dates,
            'selected_at': timezone.now().isoformat(),
            'selected_by': getattr(getattr(request.user, 'employee', None), 'employee_id', ''),
        }
        row.input_snapshot = {**snapshot, 'off_day_allocation': allocation}
        row.save(update_fields=['input_snapshot', 'updated_at'])

        old_paid_days = previous_allocation.get(
            'paid_days', snapshot.get('off_day_paid_days', total_worked_days),
        )
        PayrollCalculationService.calculate_for_run(run, row.employee)
        row.refresh_from_db()
        RunLifecycleService._recalc_totals(run)
        PayrollAuditLog.objects.create(
            run=run, employee=row.employee,
            action='OFF_DAY_ALLOCATION_UPDATED',
            reason='Extra worked days split between salary and Comp-Off before payroll approval.',
            performed_by=getattr(request.user, 'employee', None),
            old_values={'paid_days': str(old_paid_days)},
            new_values={
                'paid_days': str(paid_count),
                'comp_off_work_days': str(len(comp_off_dates)),
                'eligible_comp_off_days': str(eligible_comp_off_days),
                'paid_dates': paid_dates,
                'comp_off_dates': comp_off_dates,
            },
        )
        payload = PayrollRunEmployeeDetailSerializer(row).data
        locked_day_data = ((row.input_snapshot or {}).get('locked_inputs') or {}).get('day_data') or {}
        off_day_dates = [
            day for day, day_status in (locked_day_data.get('day_map') or {}).items()
            if day_status == 'off_day_worked'
        ]
        if off_day_dates:
            from leaveapp.models import CompOffCreditLog
            payload['off_day_credit_days_by_date'] = {
                item['credit_date'].isoformat(): str(item['comp_off_days'])
                for item in CompOffCreditLog.objects.filter(
                    employee=row.employee, credit_date__in=off_day_dates,
                ).values('credit_date', 'comp_off_days')
            }
        else:
            payload['off_day_credit_days_by_date'] = {}
        return Response(payload)


class RunEmployeeExcludeView(APIView):
    """POST /runs/<run_id>/employees/<pk>/exclude/"""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def post(self, request, run_id, pk):
        reason = request.data.get('reason', '')
        if not reason:
            return Response(
                {'detail': 'Reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            RunLifecycleService.exclude_employee(
                run_id=run_id,
                run_employee_id=pk,
                user=request.user,
                reason=reason,
            )
            return Response({'detail': 'Employee excluded.'})
        except RunLifecycleError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except PayrollRunEmployee.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


class RunVarianceView(APIView):
    """GET /runs/<run_id>/variance/"""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request, run_id):
        try:
            data = RunLifecycleService.get_variance(run_id)
            return Response(data)
        except PayrollRun.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)


class RunAuditLogView(APIView):
    """GET /runs/<run_id>/audit-log/"""
    permission_classes = [IsAuthenticated, IsHRAdmin]

    def get(self, request, run_id):
        qs = PayrollAuditLog.objects.filter(
            run_id=run_id
        ).select_related('performed_by', 'employee').order_by('-timestamp')
        ser = PayrollAuditLogSerializer(qs, many=True)
        return Response(ser.data)


class PayslipEligibleRunsView(APIView):
    """List paid and reconciled payroll months for the signed-in employee."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, 'employee', None)
        if employee is None:
            return Response({'detail': 'Your user account is not linked to an employee record.'}, status=400)
        rows = PayrollRunEmployee.objects.filter(
            employee=employee, status='CALCULATED', run__status='PAID',
        ).select_related('run__pay_calendar').order_by('-run__pay_calendar__year', '-run__pay_calendar__month')
        requests_by_run = {}
        for item in PayslipRequest.objects.filter(
            employee=employee, run__in=[r.run_id for r in rows],
        ).order_by('run_id', '-requested_at'):
            requests_by_run.setdefault(str(item.run_id), item)
        return Response([{
            'run_id': str(row.run_id),
            'run_employee_id': str(row.id),
            'year': row.run.pay_calendar.year,
            'month': row.run.pay_calendar.month,
            'run_type': row.run.run_type,
            'run_type_display': row.run.get_run_type_display(),
            'net_pay': row.net_pay,
            'request': PayslipRequestSerializer(
                requests_by_run[str(row.run_id)], context={'request': request},
            ).data
                if str(row.run_id) in requests_by_run else None,
        } for row in rows])


class PayslipRequestListCreateView(APIView):
    """Employees see their own requests; only current assigned approvers see review items."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        employee = getattr(request.user, 'employee', None)
        qs = PayslipRequest.objects.select_related(
            'employee', 'run__pay_calendar', 'approved_by',
        ).prefetch_related('approval_actions__assigned_to', 'approval_actions__acted_by')
        if employee is None:
            # An account without an employee record cannot be the requester or
            # a configured employee approver, so it must not see this queue.
            return Response([])
        current_pending_step = PayslipRequestApprovalAction.objects.filter(
            request_id=OuterRef('pk'), status='PENDING',
        ).order_by('step_number').values('step_number')[:1]
        approver_request_ids = PayslipRequest.objects.filter(
            status='PENDING_APPROVAL',
        ).annotate(
            _current_step_number=Subquery(current_pending_step),
        ).filter(
            approval_actions__assigned_to=employee,
            approval_actions__status='PENDING',
            approval_actions__step_number=F('_current_step_number'),
        ).values('pk')
        qs = qs.filter(Q(employee=employee) | Q(pk__in=approver_request_ids)).distinct()
        state = request.query_params.get('status')
        if state:
            qs = qs.filter(status=state.upper())
        return Response(PayslipRequestSerializer(qs, many=True, context={'request': request}).data)

    @transaction.atomic
    def post(self, request):
        employee = getattr(request.user, 'employee', None)
        if employee is None:
            return Response({'detail': 'Your user account is not linked to an employee record.'}, status=400)
        serializer = PayslipRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        run_id = serializer.validated_data['run_id']
        run_employee = PayrollRunEmployee.objects.filter(
            employee=employee, run_id=run_id, status='CALCULATED',
            run__status='PAID',
        ).select_related('run').first()
        if run_employee is None:
            return Response({'detail': 'Payslips can only be requested for your own paid and reconciled payroll months.'}, status=400)
        if PayslipRequest.objects.filter(
            employee=employee, run_id=run_id, status__in=['SUBMITTED', 'PENDING_APPROVAL', 'APPROVED'],
        ).exists():
            return Response({'detail': 'A pending or approved request already exists for this payroll month.'}, status=400)
        from HRMSapp.models import ApprovalWorkflow
        from HRMSapp.services.workflow_service import WorkflowService

        workflow = ApprovalWorkflow.objects.filter(
            module='PAYSLIP', is_active=True,
        ).prefetch_related('steps').first()
        if not workflow or not workflow.steps.exists():
            return Response({'detail': 'Configure and activate a Payslip Requests workflow in Settings → Approval Workflow.'}, status=400)

        action_rows = []
        for step in workflow.steps.order_by('step_number'):
            approvers = WorkflowService.resolve_approvers(step, employee)
            approver_ids = {approver.id for approver in approvers if approver and approver.id != employee.id}
            if not approver_ids:
                return Response({
                    'detail': f'No eligible approver was found for workflow step {step.step_number} ({step.step_name}). Update the workflow settings.'
                }, status=400)
            action_rows.extend(PayslipRequestApprovalAction(
                workflow=workflow, step_number=step.step_number,
                step_name=step.step_name, assigned_to_id=approver_id,
            ) for approver_id in approver_ids)

        item = PayslipRequest.objects.create(
            employee=employee, run_id=run_id, status='PENDING_APPROVAL',
            reason=serializer.validated_data.get('reason', ''),
            ip_address=self._client_ip(request),
        )
        for action in action_rows:
            action.request = item
        PayslipRequestApprovalAction.objects.bulk_create(action_rows)
        PayrollAuditLog.objects.create(
            run=item.run, employee=employee, action='PAYSLIP_REQUESTED',
            reason=item.reason, performed_by=employee,
            new_values={'request_id': str(item.id), 'status': item.status},
        )
        return Response(PayslipRequestSerializer(item, context={'request': request}).data, status=201)

    @staticmethod
    def _client_ip(request):
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        return forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')


class PayslipRequestDecisionView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, request_id, decision):
        if decision not in ('approve', 'reject'):
            return Response({'detail': 'Decision must be approve or reject.'}, status=400)
        try:
            item = PayslipRequest.objects.select_for_update().select_related('run', 'employee').get(id=request_id)
        except PayslipRequest.DoesNotExist:
            return Response({'detail': 'Payslip request not found.'}, status=404)
        if item.status != 'PENDING_APPROVAL':
            return Response({'detail': 'Only pending requests can be reviewed.'}, status=400)
        if item.run.status != 'PAID' or not PayrollRunEmployee.objects.filter(
            employee=item.employee, run=item.run, status='CALCULATED',
        ).exists():
            return Response({'detail': 'The employee does not have an available payslip in a paid, reconciled run.'}, status=400)
        actor_employee = getattr(request.user, 'employee', None)
        if actor_employee is None:
            return Response({'detail': 'Your user account is not linked to an employee record.'}, status=403)
        current_step = item.approval_actions.filter(status='PENDING').order_by(
            'step_number',
        ).values_list('step_number', flat=True).first()
        action = item.approval_actions.select_for_update().filter(
            assigned_to=actor_employee, step_number=current_step, status='PENDING',
        ).first()
        if action is None:
            return Response({'detail': 'You are not an assigned approver for the current payslip approval step.'}, status=403)
        reason = (request.data.get('reason') or '').strip()
        if decision == 'reject' and not reason:
            return Response({'detail': 'A reason is required when rejecting a request.'}, status=400)
        action.acted_by = actor_employee
        action.acted_at = timezone.now()
        action.comments = reason
        action.status = 'APPROVED' if decision == 'approve' else 'REJECTED'
        action.save(update_fields=['acted_by', 'acted_at', 'comments', 'status'])
        if decision == 'reject':
            item.status = 'REJECTED'
            item.rejection_reason = reason
            item.approval_actions.filter(status='PENDING').update(status='CANCELLED')
            item.save(update_fields=['status', 'rejection_reason'])
        elif not item.approval_actions.filter(status='PENDING').exists():
            item.status = 'APPROVED'
            item.approved_by = actor_employee
            item.approved_at = timezone.now()
            item.save(update_fields=['status', 'approved_by', 'approved_at'])
        PayrollAuditLog.objects.create(
            run=item.run, employee=item.employee,
            action=f'PAYSLIP_REQUEST_{decision.upper()}', reason=reason,
            performed_by=actor_employee,
            old_values={'status': 'PENDING_APPROVAL'},
            new_values={
                'request_id': str(item.id), 'status': item.status,
                'step_number': action.step_number, 'step_name': action.step_name,
            },
        )
        item.refresh_from_db()
        return Response(PayslipRequestSerializer(item, context={'request': request}).data)


class PayslipDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            item = PayslipRequest.objects.select_related('run', 'employee').get(id=request_id)
        except PayslipRequest.DoesNotExist:
            return Response({'detail': 'Payslip request not found.'}, status=404)
        if item.status != 'APPROVED' or item.run.status != 'PAID':
            return Response({'detail': 'An approved request and paid, reconciled payroll run are required.'}, status=403)
        if getattr(request.user, 'employee', None) != item.employee:
            return Response({'detail': 'You can only download your own payslip.'}, status=403)
        run_employee = PayrollRunEmployee.objects.filter(
            employee=item.employee, run=item.run, status='CALCULATED',
        ).first()
        if run_employee is None:
            return Response({'detail': 'No calculated payroll result exists for this request.'}, status=404)
        content, filename = generate_payslip_pdf(run_employee.id)
        response = HttpResponse(content, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Cache-Control'] = 'private, no-store'
        return response
