import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import {
  ArrowLeft, Sparkles, Save, Loader2, Eye, EyeOff, Code2,
  FileText, Wand2, Info, ChevronDown, Copy,
} from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { letterTemplatesApi } from '../../api/workflow';
import type {
  LetterTemplate,
  LetterTemplateType,
  CreationMethod,
} from '../../types/workflow';
import toast from 'react-hot-toast';

// ==============================================================================
// AVAILABLE PLACEHOLDERS (matches backend AI prompt)
// ==============================================================================

// ==============================================================================
// AVAILABLE PLACEHOLDERS (matches backend AI prompt)
// Grouped by usage: Lifecycle + Performance + Common
// ==============================================================================

const AVAILABLE_VARIABLES = [
  // ===== COMMON (all letters) =====
  { key: 'employee_name', desc: 'Full name of the employee', group: 'Common' },
  { key: 'employee_id', desc: 'Employee ID', group: 'Common' },
  { key: 'employee_position', desc: 'Employee position/title', group: 'Common' },
  { key: 'employee_department', desc: 'Employee department', group: 'Common' },
  { key: 'company_name', desc: 'Company name', group: 'Common' },
  { key: 'current_date', desc: "Today's date", group: 'Common' },
  { key: 'reporting_manager', desc: "Manager's name", group: 'Common' },
  { key: 'notification_message', desc: 'Probation reminder or updated probation date message', group: 'Probation' },
  { key: 'days_remaining', desc: 'Days until the last day of probation', group: 'Probation' },
  { key: 'last_probation_date', desc: 'Last day of the probation period', group: 'Probation' },
  { key: 'previous_probation_department', desc: 'Department before the change', group: 'Probation' },
  { key: 'new_probation_department', desc: 'Department after the change', group: 'Probation' },
  { key: 'previous_probation_position', desc: 'Position before the change', group: 'Probation' },
  { key: 'new_probation_position', desc: 'Position after the change', group: 'Probation' },
  { key: 'previous_status', desc: 'Employee status before the change', group: 'Employment Status' },
  { key: 'new_status', desc: 'Employee status after the change', group: 'Employment Status' },
  { key: 'status_change_date', desc: 'Date the status changed', group: 'Employment Status' },
  { key: 'status_change_message', desc: 'Summary of the status change', group: 'Employment Status' },
  { key: 'previous_employee_id', desc: 'Employee ID before the change', group: 'Employee ID' },
  { key: 'new_employee_id', desc: 'Employee ID after the change', group: 'Employee ID' },
  { key: 'employee_id_change_date', desc: 'Date the employee ID changed', group: 'Employee ID' },
  { key: 'employee_id_change_message', desc: 'Summary of the employee ID change', group: 'Employee ID' },

  // ===== LIFECYCLE (promotion, transfer, etc.) =====
  { key: 'current_position', desc: 'Current job title', group: 'Lifecycle' },
  { key: 'current_department', desc: 'Current department', group: 'Lifecycle' },
  { key: 'new_position', desc: 'New job title', group: 'Lifecycle' },
  { key: 'new_department', desc: 'New department name', group: 'Lifecycle' },
  { key: 'new_manager', desc: 'New reporting manager', group: 'Lifecycle' },
  { key: 'effective_date', desc: 'Date changes take effect', group: 'Lifecycle' },
  { key: 'reason', desc: 'Reason for change', group: 'Lifecycle' },

  // ===== PERFORMANCE (rating letter, PIP, appraisal) =====
  { key: 'cycle_name', desc: 'Performance cycle name (e.g. FY 2026 Q1)', group: 'Performance' },
  { key: 'cycle_period', desc: 'Cycle period dates', group: 'Performance' },
  { key: 'final_score', desc: 'Final % score', group: 'Performance' },
  { key: 'final_rating', desc: 'Rating number (1-5)', group: 'Performance' },
  { key: 'rating_label', desc: 'Rating label (Outstanding/Exceeds/etc.)', group: 'Performance' },
  { key: 'self_score', desc: "Employee's self-assessment %", group: 'Performance' },
  { key: 'peer_score', desc: 'Aggregated peer score %', group: 'Performance' },
  { key: 'manager_score', desc: "Manager's assessment %", group: 'Performance' },
  { key: 'kra_breakdown', desc: 'KRA-wise score breakdown', group: 'Performance' },

  { key: 'leave_type', desc: 'Leave type name (e.g. Casual Leave)', group: 'Leave' },
  { key: 'leave_type_code', desc: 'Leave code (e.g. CL, SL)', group: 'Leave' },
  { key: 'start_date', desc: 'Leave start date', group: 'Leave' },
  { key: 'end_date', desc: 'Leave end date', group: 'Leave' },
  { key: 'total_days', desc: 'Total leave days', group: 'Leave' },
  { key: 'is_half_day', desc: '"Yes" or "No"', group: 'Leave' },
  { key: 'half_day_period', desc: '"Morning" or "Afternoon"', group: 'Leave' },
  { key: 'application_number', desc: 'Reference number (e.g. LEAVE-2026-0001)', group: 'Leave' },
  { key: 'contact_during_leave', desc: 'Emergency contact', group: 'Leave' },
  { key: 'handover_to', desc: 'Colleague handling responsibilities', group: 'Leave' },
  { key: 'handover_notes', desc: 'Handover instructions', group: 'Leave' },
  { key: 'approver_name', desc: 'Current approver name', group: 'Leave' },
  { key: 'manager_name', desc: 'Reporting manager name', group: 'Leave' },
  { key: 'is_lop', desc: '"Yes" or "No"', group: 'Leave' },
  { key: 'lop_days', desc: 'Days that will be Loss of Pay', group: 'Leave' },

  // ===== ASSET ALLOCATION =====
{ key: 'asset_name', desc: 'Asset name (e.g. MacBook Pro)', group: 'Asset' },
{ key: 'asset_tag', desc: 'Asset tag (e.g. AST-LAP-001)', group: 'Asset' },
{ key: 'serial_number', desc: 'Serial number', group: 'Asset' },
{ key: 'category', desc: 'Asset category (Laptops, etc.)', group: 'Asset' },
{ key: 'brand', desc: 'Brand', group: 'Asset' },
{ key: 'model_number', desc: 'Model number', group: 'Asset' },
{ key: 'allocated_date', desc: 'Date allocated', group: 'Asset' },
{ key: 'expected_return_date', desc: 'Expected return date', group: 'Asset' },
{ key: 'handover_notes', desc: 'Handover / accessories notes', group: 'Asset' },
{ key: 'allocated_by', desc: 'Who allocated the asset', group: 'Asset' },
{ key: 'portal_url', desc: 'Link to My Assets page', group: 'Asset' },
{ key: 'return_status', desc: 'Status (Returned/Damaged/Lost)', group: 'Asset' },
{ key: 'return_notes', desc: 'Condition upon return', group: 'Asset' },
{ key: 'recovery_cost', desc: 'Cost recovered from employee', group: 'Asset' },
];

// Preview data — used to render sample PDF with realistic values
const PREVIEW_DATA: Record<string, string> = {
  // Common
  employee_name: 'Jithin Raj C',
  employee_id: 'EMP-2026-001',
  employee_position: 'Software Engineer',
  employee_department: 'Engineering',
  company_name: 'Your Company Ltd',
  current_date: '20 July 2026',
  reporting_manager: 'John Doe',
  notification_message: 'The probation period will complete in 7 days. Please discuss and finalize the employee status.',
  days_remaining: '7',
  last_probation_date: '27 July 2026',
  previous_probation_department: 'Operations',
  new_probation_department: 'Engineering',
  previous_probation_position: 'Coordinator',
  new_probation_position: 'Software Engineer',
  previous_status: 'Probation',
  new_status: 'Active',
  status_change_date: '9 October 2026',
  status_change_message: 'Your employment status changed from Probation to Active on 9 October 2026.',
  previous_employee_id: 'EMP-2026-012',
  new_employee_id: 'EMP-2026-120',
  employee_id_change_date: '9 October 2026',
  employee_id_change_message: 'Your employee ID has been updated from EMP-2026-012 to EMP-2026-120 on 9 October 2026.',

  // Lifecycle
  current_position: 'Software Engineer',
  current_department: 'Engineering',
  new_position: 'Senior Software Engineer',
  new_department: 'Engineering',
  new_manager: 'Sarah Kumar',
  effective_date: '15 January 2026',
  reason: 'Outstanding performance and consistent delivery of high-impact projects',

  // Performance
  cycle_name: 'FY 2026 Q1 Review',
  cycle_period: '1 April 2026 to 30 June 2026',
  final_score: '92',
  final_rating: '4',
  rating_label: 'Exceeds Expectations',
  self_score: '95',
  peer_score: '88',
  manager_score: '92',
  kra_breakdown:
    '• Code Quality (Weight: 30%) - Score: 95%\n• Team Collaboration (Weight: 25%) - Score: 88%\n• Sprint Delivery (Weight: 25%) - Score: 92%\n• Learning (Weight: 20%) - Score: 90%',
  leave_type: 'Casual Leave',
  leave_type_code: 'CL',
  start_date: '25 July 2026',
  end_date: '27 July 2026',
  total_days: '3',
  is_half_day: 'No',
  half_day_period: '—',
  application_number: 'LEAVE-2026-0042',
  contact_during_leave: '+91 98765 43210',
  handover_to: 'Nisha Yadav',
  handover_notes: 'Please monitor emails and cover urgent client calls',
  approver_name: 'John Manager',
  manager_name: 'John Manager',
  is_lop: 'No',
  lop_days: '0',


  // Asset
asset_name: 'MacBook Pro 16" M3 Pro',
asset_tag: 'AST-LAP-001',
serial_number: 'C02XG2MDMD6T',
category: 'Laptops',
brand: 'Apple',
model_number: 'MBP16-M3-2024',
allocated_date: '20 August 2026',
expected_return_date: 'N/A',
allocated_by: 'Sarah HR',
portal_url: 'http://localhost:5173/assets/my-assets',
returned_date: '25 August 2026',
return_status: 'Returned (Good Condition)',
return_notes: 'Minor scratch on lid.',
recovery_cost: '0',
};

// ==============================================================================
// MAIN COMPONENT
// ==============================================================================

export default function LetterTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);

  // Form state
  const [mode, setMode] = useState<'AI' | 'MANUAL'>('AI');
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState<LetterTemplateType>('PROMOTION');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [creationMethod, setCreationMethod] = useState<CreationMethod>('AI');

  const [showPreview, setShowPreview] = useState(true);
  const [showHtml, setShowHtml] = useState(false);
  const [originalAIHtml, setOriginalAIHtml] = useState('');

  const quillRef = useRef<ReactQuill | null>(null);

  // ---------- Load existing template if editing ----------
  useEffect(() => {
    if (!id) return;
    const fetchTemplate = async () => {
      setLoading(true);
      try {
        const t = await letterTemplatesApi.getById(id);
        setName(t.name);
        setTemplateType(t.template_type);
        setSubject(t.subject);
        setBodyHtml(t.body_html);
        setAiPrompt(t.ai_prompt || '');
        setIsDefault(t.is_default);
        setIsActive(t.is_active);
        setCreationMethod(t.creation_method);
        setMode(t.creation_method === 'MANUAL' ? 'MANUAL' : 'AI');
      } catch (err) {
        toast.error('Failed to load template');
        navigate('/settings/letter-templates');
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [id, navigate]);

  // ---------- Generate with AI ----------
  const handleGenerateAI = async () => {
    if (aiPrompt.trim().length < 10) {
      toast.error('Prompt must be at least 10 characters');
      return;
    }
    setGeneratingAI(true);
    try {
      const { html } = await letterTemplatesApi.generateWithAI({
        prompt: aiPrompt,
        template_type: templateType,
      });
      setBodyHtml(html);
      setOriginalAIHtml(html);
      setCreationMethod('AI');
      toast.success('Template generated! You can now edit it below.');
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail || 'AI generation failed. Try again.';
      toast.error(detail);
    } finally {
      setGeneratingAI(false);
    }
  };

  // ---------- Insert variable at cursor ----------
  const insertVariable = (variable: string) => {
    const placeholder = `{{${variable}}}`;

    if (mode === 'AI' && showHtml) {
      // Insert into HTML textarea
      setBodyHtml((prev) => prev + placeholder);
      return;
    }

    // Insert into Quill editor
    const editor = quillRef.current?.getEditor();
    if (editor) {
      const range = editor.getSelection(true);
      editor.insertText(range?.index || 0, placeholder);
    } else {
      setBodyHtml((prev) => prev + placeholder);
    }
  };

  // ---------- Preview rendered HTML ----------
  const renderedPreview = useMemo(() => {
    let html = bodyHtml;
    Object.entries(PREVIEW_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      html = html.replace(regex, value);
    });
    return html;
  }, [bodyHtml]);

  // ---------- Save ----------
  const handleSave = async () => {
    if (!name.trim()) return toast.error('Name is required');
    if (!subject.trim()) return toast.error('Subject is required');
    if (!bodyHtml.trim()) return toast.error('Template body is required');

    // Determine final creation method
    let finalMethod: CreationMethod = creationMethod;
    if (mode === 'MANUAL') {
      finalMethod = 'MANUAL';
    } else if (originalAIHtml && bodyHtml !== originalAIHtml) {
      finalMethod = 'AI_EDITED';
    }

    const payload = {
      name: name.trim(),
      template_type: templateType,
      subject: subject.trim(),
      body_html: bodyHtml,
      creation_method: finalMethod,
      ai_prompt: mode === 'AI' ? aiPrompt : undefined,
      is_default: isDefault,
      is_active: isActive,
    };

    setSaving(true);
    try {
      if (isEdit) {
        await letterTemplatesApi.update(id!, payload);
        toast.success('Template updated');
      } else {
        await letterTemplatesApi.create(payload);
        toast.success('Template created');
      }
      navigate('/settings/letter-templates');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Save failed';
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/settings/letter-templates')}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                {isEdit ? 'Edit Template' : 'Create New Template'}
              </h1>
              <p className="text-sm text-gray-500">
                {isEdit
                  ? 'Update template content and settings'
                  : 'Design a letter template using AI or write it manually'}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Template
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* LEFT: Form + Editor */}
            <div className="space-y-4 lg:col-span-2">
              {/* Basic Details */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900">
                  Template Details
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="e.g. Standard Promotion Letter"
                    />
                  </div>
                  <div>
  <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
    Type <span className="text-red-500">*</span>
  </label>
  <select
  value={templateType}
  onChange={(e) => {
    const next = e.target.value as LetterTemplateType;
    setTemplateType(next);
    
    // Auto-fill AI prompt for Assets
    if (next === 'ASSET_ALLOCATION' && !aiPrompt.trim()) {
      setAiPrompt(
        'Write a professional asset allocation letter informing the employee that {{asset_name}} (Tag: {{asset_tag}}, Serial: {{serial_number}}) has been allocated to them on {{allocated_date}}. Mention they are responsible for safe custody and must return it on exit. Include handover notes {{handover_notes}}.'
      );
    } else if (next === 'ASSET_RETURN' && !aiPrompt.trim()) {
      setAiPrompt(
        'Write an asset return confirmation letter acknowledging that {{asset_name}} (Tag: {{asset_tag}}) was returned on {{returned_date}}. The condition was marked as {{return_status}} with notes: {{return_notes}}. Recovery cost if any: ₹{{recovery_cost}}.'
      );
    } else if (next === 'PROBATION_REMINDER' && !aiPrompt.trim()) {
      setAiPrompt(
        'Create a probation review reminder email to {{employee_name}}. State {{notification_message}} and clearly show {{last_probation_date}}.'
      );
    } else if (next === 'PROBATION_PERIOD_CHANGED' && !aiPrompt.trim()) {
      setAiPrompt(
        'Create a probation period change email to {{employee_name}}. Explain {{notification_message}}, show the department change from {{previous_probation_department}} to {{new_probation_department}}, the position change from {{previous_probation_position}} to {{new_probation_position}}, and clearly state the new last day {{last_probation_date}}.'
      );
    } else if (next === 'EMPLOYMENT_STATUS_CHANGED' && !aiPrompt.trim()) {
      setAiPrompt(
        'Write an employment status change email to {{employee_name}}. Clearly state {{status_change_message}}, including the previous status {{previous_status}}, new status {{new_status}}, and date {{status_change_date}}.'
      );
    } else if (next === 'EMPLOYEE_ID_CHANGED' && !aiPrompt.trim()) {
      setAiPrompt(
        'Write an email to {{employee_name}} informing them that their employee ID changed from {{previous_employee_id}} to {{new_employee_id}} on {{employee_id_change_date}}. Include {{employee_id_change_message}}.'
      );
    } else if (next === 'PAYROLL_APPROVAL_REQUEST') {
      setAiPrompt(
        'Write a confidential payroll approval request email to {{recipient_name}}. Tell them a {{run_type}} payroll run for {{period_label}} is waiting for their review at step {{step_number}}: {{step_name}}. Include the preparer {{prepared_by_name}} and a link {{run_url}}. Do not include salary amounts.'
      );
    } else if (next === 'PAYROLL_RUN_APPROVED') {
      setAiPrompt(
        'Write a payroll status email to {{recipient_name}} confirming the {{run_type}} payroll run for {{period_label}} was approved. Include {{approved_by_name}} and {{run_url}}. Do not include salary amounts.'
      );
    } else if (next === 'PAYROLL_RUN_RETURNED') {
      setAiPrompt(
        'Write a payroll status email to {{recipient_name}} explaining that the {{run_type}} payroll run for {{period_label}} was returned for correction. Include the return reason {{reason}}, the reviewer {{actor_name}}, and link {{run_url}}. Do not include salary amounts.'
      );
    } else if (next === 'PAYROLL_RUN_PAID') {
      setAiPrompt(
        'Write a payroll status email to {{recipient_name}} confirming that the {{run_type}} payroll run for {{period_label}} has been marked paid. Direct the employee to {{run_url}} to submit a payslip request, and explain that the payslip is available only after approval through the payslip approval workflow. Do not mention a return or correction, do not imply the payslip is immediately available, and do not include salary amounts or bank details.'
      );
    }
  }}
  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
>
  <optgroup label="🔄 Lifecycle Letters">
    <option value="PROMOTION">Promotion Letter</option>
    <option value="TRANSFER">Transfer Letter</option>
    <option value="REDESIGNATION">Re-designation Letter</option>
    <option value="CONFIRMATION">Confirmation Letter</option>
    <option value="MANAGER_CHANGE">Manager Change Letter</option>
  </optgroup>
  <optgroup label="🎯 Performance Letters">
    <option value="PERFORMANCE_RATING">Performance Rating Letter</option>
    <option value="APPRAISAL_LETTER">Appraisal Letter</option>
    <option value="PIP_LETTER">PIP Letter</option>
  </optgroup>
  <optgroup label="🏖️ Leave Letters">
    <option value="LEAVE_APPLICATION">Leave Application Letter</option>
    <option value="LEAVE_APPROVAL">Leave Approval Letter</option>
  </optgroup>
  <optgroup label="📦 Asset Letters">
    <option value="ASSET_ALLOCATION">Asset Allocation Letter</option>
    <option value="ASSET_RETURN">Asset Return Confirmation</option>
  </optgroup>
  <optgroup label="Probation Notifications">
    <option value="PROBATION_REMINDER">Probation Review Reminder</option>
    <option value="PROBATION_PERIOD_CHANGED">Probation Period Changed</option>
  </optgroup>
  <optgroup label="Employment Notifications">
    <option value="EMPLOYMENT_STATUS_CHANGED">Employment Status Changed</option>
    <option value="EMPLOYEE_ID_CHANGED">Employee ID Changed</option>
  </optgroup>
  <optgroup label="Payroll Notifications">
    <option value="PAYROLL_APPROVAL_REQUEST">Payroll Approval Request</option>
    <option value="PAYROLL_RUN_APPROVED">Payroll Run Approved</option>
    <option value="PAYROLL_RUN_RETURNED">Payroll Run Returned</option>
    <option value="PAYROLL_RUN_PAID">Payroll Run Paid</option>
  </optgroup>
</select>
</div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
                      Email Subject <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      placeholder="e.g. Congratulations on your promotion!"
                    />
                  </div>
                  {templateType.startsWith('PAYROLL_') && (
                    <p className="md:col-span-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                      Payroll email templates support Django placeholders such as {'{{recipient_name}}'}, {'{{run_type}}'}, {'{{period_label}}'}, {'{{run_url}}'}, {'{{prepared_by_name}}'}, {'{{approved_by_name}}'}, {'{{step_number}}'}, {'{{step_name}}'}, and {'{{reason}}'}. Use only the placeholders relevant to this template. Salary amounts and bank details are not included.
                    </p>
                  )}
                </div>
              </div>

              {/* Mode Toggle */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Template Content
                  </h2>
                  <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                    <button
                      onClick={() => setMode('AI')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        mode === 'AI'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Assistant
                    </button>
                    <button
                      onClick={() => setMode('MANUAL')}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                        mode === 'MANUAL'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Manual
                    </button>
                  </div>
                </div>

                {/* AI MODE — Prompt Input */}
                {mode === 'AI' && (
                  <div className="mb-4 rounded-xl border border-purple-100 bg-purple-50/50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Wand2 className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-purple-900">
                        Describe what you want (Groq AI)
                      </span>
                    </div>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      placeholder="e.g. Create a warm, professional promotion letter for a software engineer being promoted to senior engineer. Include a congratulatory paragraph, mention the new position, effective date, and standard closing."
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <p className="flex items-center gap-1 text-xs text-purple-700">
                        <Info className="h-3 w-3" />
                        AI will use placeholders like {'{{employee_name}}'} in
                        the generated template
                      </p>
                      <button
                        onClick={handleGenerateAI}
                        disabled={generatingAI || aiPrompt.trim().length < 10}
                        className="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {generatingAI ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {generatingAI ? 'Generating...' : 'Generate'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Editor Toggle */}
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    Template Body
                  </span>
                  <button
                    onClick={() => setShowHtml(!showHtml)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    {showHtml ? 'Rich Text' : 'HTML Source'}
                  </button>
                </div>

                {/* Editor */}
                {showHtml ? (
                  <textarea
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={16}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 p-3 font-mono text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="<div>Your HTML template here...</div>"
                  />
                ) : (
                  <div className="rounded-lg border border-gray-300">
                    <ReactQuill
                      ref={quillRef}
                      theme="snow"
                      value={bodyHtml}
                      onChange={setBodyHtml}
                      modules={{
                        toolbar: [
                          [{ header: [1, 2, 3, false] }],
                          ['bold', 'italic', 'underline'],
                          [{ list: 'ordered' }, { list: 'bullet' }],
                          [{ align: [] }],
                          ['link'],
                          ['clean'],
                        ],
                      }}
                      style={{ minHeight: '350px' }}
                      placeholder="Start writing your template or generate one with AI above..."
                    />
                  </div>
                )}
              </div>

              {/* Settings */}
              <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">
                  Settings
                </h2>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Active (available for use)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    Set as default for this letter type
                  </label>
                </div>
              </div>
            </div>

            {/* RIGHT: Variables + Preview */}
            <div className="space-y-4">
              {/* Available Variables */}
              {/* Available Variables (Grouped) */}
<div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-sm font-semibold text-gray-900">
      Available Variables
    </h2>
    <span className="text-xs text-gray-500">Click to insert</span>
  </div>

  {/* Group by category */}
 {['Common', 'Lifecycle', 'Performance', 'Leave', 'Asset', 'Probation', 'Employment Status', 'Employee ID'].map((group) => {
  const groupVars = AVAILABLE_VARIABLES.filter((v) => {
    if (v.group !== group) return false;
    
    const isPerformanceTemplate = ['PERFORMANCE_RATING', 'APPRAISAL_LETTER', 'PIP_LETTER'].includes(templateType);
    const isLifecycleTemplate = [
      'PROMOTION', 'TRANSFER', 'REDESIGNATION', 'CONFIRMATION', 'MANAGER_CHANGE'
    ].includes(templateType);
    const isLeaveTemplate = ['LEAVE_APPLICATION', 'LEAVE_APPROVAL'].includes(templateType);
    const isAssetTemplate = templateType === 'ASSET_ALLOCATION';
    const isProbationTemplate = ['PROBATION_REMINDER', 'PROBATION_PERIOD_CHANGED'].includes(templateType);
    const isEmploymentStatusTemplate = templateType === 'EMPLOYMENT_STATUS_CHANGED';
    const isEmployeeIdTemplate = templateType === 'EMPLOYEE_ID_CHANGED';
    
    if (group === 'Lifecycle' && !isLifecycleTemplate) return false;
    if (group === 'Performance' && !isPerformanceTemplate) return false;
    if (group === 'Leave' && !isLeaveTemplate) return false;
    if (group === 'Asset' && !isAssetTemplate) return false;
    if (group === 'Probation' && !isProbationTemplate) return false;
    if (group === 'Employment Status' && !isEmploymentStatusTemplate) return false;
    if (group === 'Employee ID' && !isEmployeeIdTemplate) return false;
    
    return true;
  });
  if (groupVars.length === 0) return null;

  const groupColor =
  group === 'Common'
    ? 'text-gray-600'
    : group === 'Lifecycle'
    ? 'text-blue-600'
    : group === 'Performance'
    ? 'text-purple-600'
    : group === 'Leave'
    ? 'text-green-600'
    : group === 'Probation'
    ? 'text-amber-700'
    : group === 'Employment Status'
    ? 'text-cyan-700'
    : group === 'Employee ID'
    ? 'text-sky-700'
    : 'text-orange-600';

  const groupBadge =
  group === 'Common'
    ? '📌 All Letters'
    : group === 'Lifecycle'
    ? '🔄 Promotion/Transfer'
    : group === 'Performance'
    ? '🎯 Rating/PIP'
    : group === 'Leave'
    ? '🏖️ Leave Letters'
    : group === 'Probation'
    ? 'Probation Notification'
    : group === 'Employment Status'
    ? 'Employment Status Notification'
    : group === 'Employee ID'
    ? 'Employee ID Notification'
    : '📦 Asset Allocation';

  return (
    <div key={group} className="mb-3 last:mb-0">
      <div
        className={`mb-1.5 flex items-center gap-1 border-b border-gray-100 pb-1 text-xs font-bold ${groupColor}`}
      >
        {groupBadge}
      </div>
      <div className="space-y-0.5">
        {groupVars.map((v) => (
          <button
            key={v.key}
            onClick={() => insertVariable(v.key)}
            className="group flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-primary-50"
          >
            <Copy className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400 group-hover:text-primary-600" />
            <div className="flex-1 min-w-0">
              <code className="block truncate text-xs font-medium text-primary-700">
                {'{{'}
                {v.key}
                {'}}'}
              </code>
              <span className="text-[10px] text-gray-500">{v.desc}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
})}
</div>

              {/* Preview Toggle */}
              <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex w-full items-center justify-between p-5"
                >
                  <div className="flex items-center gap-2">
                    {showPreview ? (
                      <Eye className="h-4 w-4 text-gray-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-600" />
                    )}
                    <h2 className="text-sm font-semibold text-gray-900">
                      Live Preview
                    </h2>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition ${
                      showPreview ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {showPreview && (
                  <div className="border-t border-gray-100 p-5">
                    <p className="mb-3 text-xs text-gray-500">
                      Preview with sample employee data:
                    </p>
                    {bodyHtml ? (
                      <div
                        className="prose prose-sm max-h-[500px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs"
                        dangerouslySetInnerHTML={{ __html: renderedPreview }}
                      />
                    ) : (
                      <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-xs text-gray-400">
                        Start writing to see preview
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
