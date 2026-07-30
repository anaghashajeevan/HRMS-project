// import { useEffect, useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import {
//   ArrowLeft, Save, Loader2, Upload, Bold, Italic,
//   List, Heading2, Heading3, Type,
// } from 'lucide-react';
// import toast from 'react-hot-toast';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { policiesApi, policyCategoriesApi } from '../../api/policy';
// import { employeesApi } from '../../api/employees';
// import { structuresApi } from '../../api/masterData';
// import type { PolicyCategory } from '../../types/policy';

// export default function PolicyCreatePage() {
//   const navigate = useNavigate();

//   const [categories, setCategories] = useState<PolicyCategory[]>([]);
//   const [departments, setDepartments] = useState<any[]>([]);
//   const [managers, setManagers] = useState<any[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);

//   // Form
//   const [title, setTitle] = useState('');
//   const [summary, setSummary] = useState('');
//   const [categoryId, setCategoryId] = useState('');
//   const [priority, setPriority] = useState('MEDIUM');
//   const [tags, setTags] = useState('');
//   const [contentText, setContentText] = useState('');
//   const [effectiveDate, setEffectiveDate] = useState(
//     new Date().toISOString().split('T')[0]
//   );
//   const [expiryDate, setExpiryDate] = useState('');
//   const [appliesToAll, setAppliesToAll] = useState(true);
//   const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
//   const [requiresAck, setRequiresAck] = useState(true);
//   const [ackDeadlineDays, setAckDeadlineDays] = useState(14);
//   const [isMandatory, setIsMandatory] = useState(false);
//   const [reviewMonths, setReviewMonths] = useState(12);
//   const [policyOwnerId, setPolicyOwnerId] = useState('');
//   const [contentFile, setContentFile] = useState<File | null>(null);

//   useEffect(() => {
//     loadData();
//   }, []);

//   const loadData = async () => {
//     try {
//       const [cats, deptsData, mgrs] = await Promise.all([
//         policyCategoriesApi.list(),
//         structuresApi.list({ type: 'DEPARTMENT' }),
//         employeesApi.getManagers(),
//       ]);
//       setCategories(Array.isArray(cats) ? cats : []);
//       const deptList = deptsData?.results || deptsData || [];
//       setDepartments(Array.isArray(deptList) ? deptList : []);
//       setManagers(Array.isArray(mgrs) ? mgrs : []);
//     } catch (error) {
//       toast.error('Failed to load form data');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Convert plain text to simple HTML
//   const textToHtml = (text: string): string => {
//     if (!text) return '';
//     return text
//       .split('\n\n')
//       .map((para) => {
//         const trimmed = para.trim();
//         if (!trimmed) return '';
//         if (trimmed.startsWith('# ')) return `<h2>${trimmed.slice(2)}</h2>`;
//         if (trimmed.startsWith('## ')) return `<h3>${trimmed.slice(3)}</h3>`;
//         // Convert bullet points
//         if (trimmed.includes('\n- ') || trimmed.startsWith('- ')) {
//           const items = trimmed
//             .split('\n')
//             .filter((l) => l.trim().startsWith('- '))
//             .map((l) => `<li>${l.trim().slice(2)}</li>`)
//             .join('');
//           const headerLine = trimmed.split('\n')[0];
//           const header = headerLine.startsWith('- ') ? '' : `<p><strong>${headerLine}</strong></p>`;
//           return `${header}<ul>${items}</ul>`;
//         }
//         return `<p>${trimmed}</p>`;
//       })
//       .join('\n');
//   };

//   const handleSave = async () => {
//     if (!title.trim()) return toast.error('Title is required');
//     if (!categoryId) return toast.error('Category is required');
//     if (!contentText.trim() && !contentFile) return toast.error('Policy content is required');

//     setSaving(true);
//     try {
//       const formData = new FormData();
//       formData.append('title', title.trim());
//       formData.append('summary', summary.trim());
//       formData.append('category', categoryId);
//       formData.append('priority', priority);
//       formData.append('tags', tags);
//       formData.append('content_html', textToHtml(contentText));
//       formData.append('effective_date', effectiveDate);
//       if (expiryDate) formData.append('expiry_date', expiryDate);
//       formData.append('applies_to_all', appliesToAll ? 'true' : 'false');
//       if (!appliesToAll && selectedDepartments.length > 0) {
//   selectedDepartments.forEach((deptId) => {
//     formData.append('applicable_departments', deptId);
//   });
// }
//       formData.append('requires_acknowledgment', requiresAck ? 'true' : 'false');
//       formData.append('acknowledgment_deadline_days', String(ackDeadlineDays));
//       formData.append('is_mandatory', isMandatory ? 'true' : 'false');
//       formData.append('review_interval_months', String(reviewMonths));
//       if (policyOwnerId) formData.append('policy_owner', policyOwnerId);
//       if (contentFile) {
//         formData.append('content_file', contentFile);
//         formData.append('content_type', contentFile.name.endsWith('.pdf') ? 'PDF' : 'DOCX');
//       } else {
//         formData.append('content_type', 'HTML');
//       }

//       const policy = await policiesApi.create(formData);
//       toast.success(`Policy ${policy.policy_number} created!`);
//       navigate(`/policies/${policy.id}`);
//     } catch (error: any) {
//       toast.error(error?.response?.data?.detail || 'Failed to create policy');
//     } finally {
//       setSaving(false);
//     }
//   };

//   if (loading) {
//     return (
//       <div className="flex h-screen bg-gray-50">
//         <Sidebar />
//         <div className="flex flex-1 flex-col overflow-hidden">
//           <Topbar />
//           <div className="flex items-center justify-center py-16">
//             <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6 flex items-center gap-3">
//             <button onClick={() => navigate('/policies')} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100">
//               <ArrowLeft className="h-5 w-5" />
//             </button>
//             <div className="flex-1">
//               <h1 className="text-2xl font-bold text-gray-900">Create New Policy</h1>
//               <p className="mt-1 text-sm text-gray-600">
//                 Fill in details below. After saving, submit for approval.
//               </p>
//             </div>
//             <button
//               onClick={handleSave}
//               disabled={saving}
//               className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
//             >
//               {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
//               Save as Draft
//             </button>
//           </div>

//           <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
//             {/* Left — Main */}
//             <div className="lg:col-span-2 space-y-4">
//               {/* Basic Info */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <h2 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h2>
//                 <div className="space-y-4">
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">Policy Title *</label>
//                     <input
//                       type="text"
//                       value={title}
//                       onChange={(e) => setTitle(e.target.value)}
//                       placeholder="e.g., Work From Home Policy"
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">Brief Summary</label>
//                     <textarea
//                       value={summary}
//                       onChange={(e) => setSummary(e.target.value)}
//                       rows={2}
//                       placeholder="Short description employees will see in the policy library..."
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                     />
//                   </div>
//                   <div className="grid grid-cols-2 gap-4">
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
//                       <select
//                         value={categoryId}
//                         onChange={(e) => setCategoryId(e.target.value)}
//                         className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                       >
//                         <option value="">Select category</option>
//                         {categories.map((c) => (
//                           <option key={c.id} value={c.id}>{c.name}</option>
//                         ))}
//                       </select>
//                     </div>
//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
//                       <select
//                         value={priority}
//                         onChange={(e) => setPriority(e.target.value)}
//                         className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                       >
//                         <option value="LOW">Low</option>
//                         <option value="MEDIUM">Medium</option>
//                         <option value="HIGH">High</option>
//                         <option value="CRITICAL">Critical</option>
//                       </select>
//                     </div>
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
//                     <input
//                       type="text"
//                       value={tags}
//                       onChange={(e) => setTags(e.target.value)}
//                       placeholder="Comma-separated: remote, wfh, flexible"
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                     />
//                   </div>
//                 </div>
//               </div>

//               {/* Content */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <h2 className="text-sm font-semibold text-gray-900 mb-2">Policy Content</h2>

//                 {/* File Upload */}
//                 <div className="mb-4">
//                   <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-4 hover:border-primary-400 hover:bg-primary-50 transition">
//                     <Upload className="mr-2 h-5 w-5 text-gray-400" />
//                     <span className="text-sm text-gray-600">
//                       {contentFile ? `📎 ${contentFile.name}` : 'Upload PDF or Word document (optional)'}
//                     </span>
//                     <input
//                       type="file"
//                       accept=".pdf,.docx,.doc"
//                       onChange={(e) => setContentFile(e.target.files?.[0] || null)}
//                       className="hidden"
//                     />
//                   </label>
//                 </div>

//                 {/* Simple Text Editor */}
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Or write the policy content below:
//                   </label>

//                   {/* Formatting Guide */}
//                   <div className="mb-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
//                     <p className="text-xs font-semibold text-blue-900 mb-1">✨ Simple Formatting Tips:</p>
//                     <div className="grid grid-cols-2 gap-1 text-xs text-blue-800">
//                       <span><code className="bg-blue-100 px-1 rounded"># Title</code> → Main heading</span>
//                       <span><code className="bg-blue-100 px-1 rounded">## Subtitle</code> → Sub heading</span>
//                       <span><code className="bg-blue-100 px-1 rounded">- Item</code> → Bullet point</span>
//                       <span>Empty line → New paragraph</span>
//                     </div>
//                   </div>

//                   <textarea
//                     value={contentText}
//                     onChange={(e) => setContentText(e.target.value)}
//                     rows={20}
//                     placeholder={`# Work From Home Policy

// ## 1. Purpose
// This policy outlines the guidelines for employees who wish to work from home.

// ## 2. Eligibility
// - All confirmed employees with 6+ months of service
// - Subject to manager approval
// - Not applicable during probation period

// ## 3. Working Hours
// - Must be available during core hours (10 AM - 5 PM)
// - Must attend all scheduled meetings
// - Must be reachable on official communication channels

// ## 4. Equipment
// - Company will provide laptop and necessary tools
// - Employee is responsible for internet connectivity
// - Internet reimbursement: ₹500/month

// ## 5. Compliance
// - Must follow all data security guidelines
// - Must use VPN for accessing company systems
// - Must not share sensitive information outside secure channels`}
//                     className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
//                     style={{ fontFamily: "'Segoe UI', sans-serif" }}
//                   />
//                   <p className="mt-1 text-xs text-gray-500">
//                     Just type naturally. Use # for headings, - for bullet points, and blank lines between paragraphs.
//                   </p>
//                 </div>
//               </div>
//             </div>

//             {/* Right — Settings */}
//             <div className="space-y-4">
//               {/* Dates */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">Dates</h3>
//                 <div className="space-y-3">
//                   <div>
//                     <label className="block text-xs font-medium text-gray-500 mb-1">Effective Date *</label>
//                     <input
//                       type="date"
//                       value={effectiveDate}
//                       onChange={(e) => setEffectiveDate(e.target.value)}
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
//                     <input
//                       type="date"
//                       value={expiryDate}
//                       onChange={(e) => setExpiryDate(e.target.value)}
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                     />
//                     <p className="mt-1 text-xs text-gray-400">Leave empty if no expiry</p>
//                   </div>
//                   <div>
//                     <label className="block text-xs font-medium text-gray-500 mb-1">
//                       Review Every (months)
//                     </label>
//                     <input
//                       type="number"
//                       value={reviewMonths}
//                       onChange={(e) => setReviewMonths(Number(e.target.value))}
//                       min="0"
//                       className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                     />
//                     <p className="mt-1 text-xs text-gray-400">System will remind to review. 0 = no auto-review.</p>
//                   </div>
//                 </div>
//               </div>

//               {/* Who Should See This */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">Who Should See This?</h3>
//                 <div className="space-y-3">
//                   <label className="flex items-start gap-2 cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={appliesToAll}
//                       onChange={(e) => setAppliesToAll(e.target.checked)}
//                       className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600"
//                     />
//                     <div>
//                       <span className="text-sm font-medium text-gray-700">All Employees</span>
//                       <p className="text-xs text-gray-500">Every active employee will receive this policy</p>
//                     </div>
//                   </label>

//                   {!appliesToAll && (
//                     <div>
//                       <label className="block text-xs font-medium text-gray-500 mb-1">
//                         Select Departments
//                       </label>
//                       <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 p-2">
//                         {departments.map((dept: any) => (
//                           <label key={dept.id} className="flex items-center gap-2 py-1 cursor-pointer">
//                             <input
//                               type="checkbox"
//                               checked={selectedDepartments.includes(dept.id)}
//                               onChange={(e) => {
//                                 if (e.target.checked) {
//                                   setSelectedDepartments([...selectedDepartments, dept.id]);
//                                 } else {
//                                   setSelectedDepartments(selectedDepartments.filter(d => d !== dept.id));
//                                 }
//                               }}
//                               className="h-4 w-4 rounded border-gray-300 text-primary-600"
//                             />
//                             <span className="text-sm text-gray-700">{dept.name}</span>
//                           </label>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>

//               {/* Acknowledgment */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">Acknowledgment</h3>
//                 <div className="space-y-3">
//                   <label className="flex items-start gap-2 cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={requiresAck}
//                       onChange={(e) => setRequiresAck(e.target.checked)}
//                       className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600"
//                     />
//                     <div>
//                       <span className="text-sm font-medium text-gray-700">Require Acknowledgment</span>
//                       <p className="text-xs text-gray-500">Employees must read and confirm they've understood</p>
//                     </div>
//                   </label>
//                   {requiresAck && (
//                     <div>
//                       <label className="block text-xs font-medium text-gray-500 mb-1">
//                         Days to Acknowledge (after publishing)
//                       </label>
//                       <input
//                         type="number"
//                         value={ackDeadlineDays}
//                         onChange={(e) => setAckDeadlineDays(Number(e.target.value))}
//                         min="1"
//                         className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                       />
//                     </div>
//                   )}
//                   <label className="flex items-start gap-2 cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={isMandatory}
//                       onChange={(e) => setIsMandatory(e.target.checked)}
//                       className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600"
//                     />
//                     <div>
//                       <span className="text-sm font-medium text-gray-700">Mandatory for New Hires</span>
//                       <p className="text-xs text-gray-500">Auto-assigned when new employee joins</p>
//                     </div>
//                   </label>
//                 </div>
//               </div>

//               {/* Owner */}
//               <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">Policy Owner</h3>
//                 <select
//                   value={policyOwnerId}
//                   onChange={(e) => setPolicyOwnerId(e.target.value)}
//                   className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
//                 >
//                   <option value="">Select owner (optional)</option>
//                   {managers.map((m) => (
//                     <option key={m.id} value={m.id}>{m.employee_id} - {m.full_name}</option>
//                   ))}
//                 </select>
//                 <p className="mt-1 text-xs text-gray-500">
//                   Person responsible for maintaining this policy
//                 </p>
//               </div>
//             </div>
//           </div>
//         </main>
//       </div>
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Upload, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { policiesApi, policyCategoriesApi } from '../../api/policy';
import { employeesApi } from '../../api/employees';
import { structuresApi } from '../../api/masterData';
import type { PolicyCategory } from '../../types/policy';

export default function PolicyCreatePage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state — only what's needed
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [effectiveDate, setEffectiveDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState('');
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [requiresAck, setRequiresAck] = useState(true);
  const [ackDeadlineDays, setAckDeadlineDays] = useState(14);
  const [isMandatory, setIsMandatory] = useState(false);
  const [policyOwnerId, setPolicyOwnerId] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [cats, deptsData, mgrs] = await Promise.all([
        policyCategoriesApi.list(),
        structuresApi.list({ type: 'DEPARTMENT' }),
        employeesApi.getManagers(),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      const deptList = deptsData?.results || deptsData || [];
      setDepartments(Array.isArray(deptList) ? deptList : []);
      setManagers(Array.isArray(mgrs) ? mgrs : []);
    } catch {
      toast.error('Failed to load form data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF or Word documents (.pdf, .docx) are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum 10 MB allowed');
      return;
    }
    setContentFile(file);
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error('Policy title is required');
    if (!categoryId) return toast.error('Please select a category');
    if (!contentFile) return toast.error('Please upload the policy document');
    if (!appliesToAll && selectedDepartments.length === 0) {
      return toast.error('Please select at least one department');
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('category', categoryId);
      formData.append('content_file', contentFile);
      formData.append('content_html', '');
      formData.append(
        'content_type',
        contentFile.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'DOCX'
      );
      formData.append('effective_date', effectiveDate);
      if (expiryDate) formData.append('expiry_date', expiryDate);
      formData.append('applies_to_all', appliesToAll ? 'true' : 'false');
      if (!appliesToAll) {
        selectedDepartments.forEach((id) =>
          formData.append('applicable_departments', id)
        );
      }
      formData.append('requires_acknowledgment', requiresAck ? 'true' : 'false');
      if (requiresAck) {
        formData.append('acknowledgment_deadline_days', String(ackDeadlineDays));
      }
      formData.append('is_mandatory', isMandatory ? 'true' : 'false');
      formData.append('is_active', 'true');  // ← ADD THIS
      if (policyOwnerId) formData.append('policy_owner', policyOwnerId);

      const policy = await policiesApi.create(formData);
      toast.success(`Policy ${policy.policy_number} created successfully!`);
      navigate(`/policies/${policy.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to create policy');
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
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
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

          {/* ── Header ── */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => navigate('/policies')}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">Create New Policy</h1>
              <p className="mt-1 text-sm text-gray-500">
                Upload the policy document and set who needs to acknowledge it.
                After saving, submit for approval.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5
                         text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />}
              Save as Draft
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

            {/* ── LEFT — Main Fields ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Title + Category */}
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-4 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Policy Information
                </h2>
                <div className="space-y-4">

                  {/* Title */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Policy Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Work From Home Policy"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                                 outline-none focus:border-primary-500 focus:ring-2
                                 focus:ring-primary-100"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm
                                 outline-none focus:border-primary-500 focus:ring-2
                                 focus:ring-primary-100"
                    >
                      <option value="">Select a category</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {categories.length === 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        No categories found. Ask admin to set up categories first.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Upload */}
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                <h2 className="mb-1 text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Policy Document <span className="text-red-500">*</span>
                </h2>
                <p className="mb-4 text-xs text-gray-500">
                  Upload the official policy document. Supported: PDF, Word (.docx). Max: 10 MB.
                </p>

                {!contentFile ? (
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center
                               rounded-xl border-2 border-dashed border-gray-300 bg-gray-50
                               py-12 transition hover:border-primary-400 hover:bg-primary-50"
                  >
                    <div className="mb-3 flex h-14 w-14 items-center justify-center
                                    rounded-full bg-gray-100">
                      <Upload className="h-7 w-7 text-gray-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">
                      Click to upload document
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      PDF or Word (.docx) • Max 10 MB
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between rounded-xl
                                  border border-green-200 bg-green-50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center
                                      rounded-lg bg-green-100">
                        <FileText className="h-6 w-6 text-green-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-900">
                          {contentFile.name}
                        </p>
                        <p className="text-xs text-green-700">
                          {(contentFile.size / 1024 / 1024).toFixed(2)} MB
                          {' · '}
                          {contentFile.name.toLowerCase().endsWith('.pdf')
                            ? 'PDF Document'
                            : 'Word Document'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setContentFile(null)}
                      className="rounded-lg p-2 text-gray-500 hover:bg-green-100
                                 hover:text-gray-700 transition"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT — Settings ── */}
            <div className="space-y-4">

              {/* Dates */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Dates</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Effective Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={effectiveDate}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                 outline-none focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Expiry Date
                      <span className="ml-1 text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                                 outline-none focus:border-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Applicability */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Who Should Acknowledge?
                </h3>
                <div className="space-y-3">

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg
                                    border border-gray-200 p-3 hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={appliesToAll}
                      onChange={(e) => {
                        setAppliesToAll(e.target.checked);
                        if (e.target.checked) setSelectedDepartments([]);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">All Employees</p>
                      <p className="text-xs text-gray-500">
                        Every active employee receives this policy
                      </p>
                    </div>
                  </label>

                  {!appliesToAll && (
                    <div>
                      <p className="mb-2 text-xs font-medium text-gray-600">
                        Select Departments <span className="text-red-500">*</span>
                      </p>
                      {departments.length === 0 ? (
                        <p className="text-xs text-amber-600">
                          No departments found in the system.
                        </p>
                      ) : (
                        <div className="max-h-48 overflow-y-auto rounded-lg
                                        border border-gray-200 divide-y divide-gray-100">
                          {departments.map((dept: any) => (
                            <label
                              key={dept.id}
                              className="flex cursor-pointer items-center gap-2.5
                                         px-3 py-2.5 hover:bg-gray-50 transition"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDepartments.includes(dept.id)}
                                onChange={(e) => {
                                  setSelectedDepartments(
                                    e.target.checked
                                      ? [...selectedDepartments, dept.id]
                                      : selectedDepartments.filter((d) => d !== dept.id)
                                  );
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-primary-600"
                              />
                              <span className="text-sm text-gray-700">{dept.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                      {selectedDepartments.length > 0 && (
                        <p className="mt-1.5 text-xs font-semibold text-primary-600">
                          ✓ {selectedDepartments.length} department
                          {selectedDepartments.length > 1 ? 's' : ''} selected
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Acknowledgment */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                  Acknowledgment
                </h3>
                <div className="space-y-3">

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg
                                    border border-gray-200 p-3 hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={requiresAck}
                      onChange={(e) => setRequiresAck(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Require Acknowledgment
                      </p>
                      <p className="text-xs text-gray-500">
                        Employees must confirm they've read this policy
                      </p>
                    </div>
                  </label>

                  {requiresAck && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        Acknowledgment Deadline (days after publishing)
                      </label>
                      <input
                        type="number"
                        value={ackDeadlineDays}
                        onChange={(e) => setAckDeadlineDays(Number(e.target.value))}
                        min="1"
                        max="90"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2
                                   text-sm outline-none focus:border-primary-500"
                      />
                    </div>
                  )}

                  <label className="flex cursor-pointer items-start gap-3 rounded-lg
                                    border border-gray-200 p-3 hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={isMandatory}
                      onChange={(e) => setIsMandatory(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Mandatory for New Hires
                      </p>
                      <p className="text-xs text-gray-500">
                        Auto-assigned when a new employee joins
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Policy Owner */}
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  Policy Owner
                  <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
                </h3>
                <select
                  value={policyOwnerId}
                  onChange={(e) => setPolicyOwnerId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             outline-none focus:border-primary-500"
                >
                  <option value="">Select owner</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.employee_id} — {m.full_name}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  Person responsible for keeping this policy up to date
                </p>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}