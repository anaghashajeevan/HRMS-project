// import { useState, useRef, useEffect } from 'react';
// import {
//   Download, Maximize2, Minimize2, CheckCircle2,
//   Shield, Award, FileText, FileSpreadsheet, X,
//   ExternalLink, AlertTriangle, ArrowDown,
// } from 'lucide-react';
// import type { PolicyDetail, ApprovalChain } from '../../types/policy';

// interface PolicyDocumentViewerProps {
//   policy: PolicyDetail;
//   onClose?: () => void;
//   fullScreenMode?: boolean;
// }

// export default function PolicyDocumentViewer({
//   policy,
//   onClose,
//   fullScreenMode = false,
// }: PolicyDocumentViewerProps) {
//   const [isFullScreen, setIsFullScreen] = useState(fullScreenMode);
//   const [viewerError, setViewerError] = useState(false);
//   const [scrolledToBottom, setScrolledToBottom] = useState(false);
//   const scrollContainerRef = useRef<HTMLDivElement>(null);

//   const version = policy.current_version;
//   const fileUrl = version?.file_url || version?.preview_url;
//   const contentType = version?.content_type || 'HTML';
//   const isPublished = policy.status === 'PUBLISHED';
//   const approvalChain = policy.approval_chain;

//   // Track scrolling to notify users to scroll to the end to view the approval page
//   const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
//     const target = e.currentTarget;
//     const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 150;
//     setScrolledToBottom(isAtBottom);
//   };

//   const getFileExtension = (): string => {
//     if (fileUrl) {
//       const match = fileUrl.match(/\.(\w+)(\?|$)/);
//       if (match) return match[1].toLowerCase();
//     }
//     if (contentType === 'PDF') return 'pdf';
//     if (contentType === 'DOCX') return 'docx';
//     if (contentType === 'XLSX') return 'xlsx';
//     return '';
//   };

//   const ext = getFileExtension();
//   const isPdf = ext === 'pdf' || contentType === 'PDF';
//   const isWord = ['docx', 'doc'].includes(ext) || contentType === 'DOCX';
//   const isExcel = ['xlsx', 'xls'].includes(ext) || contentType === 'XLSX';
//   const isHtml = contentType === 'HTML' && !!version?.content_html;

//   const getViewerUrl = (): string | null => {
//     if (!fileUrl) return null;
//     if (isPdf) {
//       return `${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`;
//     }
//     if (isWord || isExcel) {
//       const encodedUrl = encodeURIComponent(fileUrl);
//       return `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
//     }
//     return null;
//   };

//   const viewerUrl = getViewerUrl();
//   const isLocalhost = fileUrl?.includes('localhost') || fileUrl?.includes('127.0.0.1');
//   const canUseOfficeViewer = (isWord || isExcel) && !isLocalhost && !!fileUrl;

//   const handleDownload = () => {
//     if (!fileUrl) return;
//     const link = document.createElement('a');
//     link.href = fileUrl;
//     link.download = `${policy.policy_number}_v${version?.version_number || '1.0'}.${ext || 'pdf'}`;
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const containerClass = isFullScreen
//     ? 'fixed inset-0 z-50 bg-[#323639] flex flex-col'
//     : 'flex flex-col rounded-xl bg-gray-100 shadow-sm ring-1 ring-gray-200 overflow-hidden';

//   const FileTypeIcon = isExcel ? FileSpreadsheet : FileText;
//   const fileTypeLabel = isPdf ? 'PDF Document'
//     : isWord ? 'Word Document'
//     : isExcel ? 'Excel Spreadsheet'
//     : 'Document';

//   return (
//     <div className={containerClass} style={{ height: isFullScreen ? '100vh' : '750px' }}>
//       {/* ── Top Header Toolbar ── */}
//       <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm z-10">
//         <div className="flex items-center gap-3">
//           <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
//             <FileTypeIcon className="h-5 w-5" />
//           </div>
//           <div>
//             <h3 className="text-sm font-bold text-gray-900">{policy.title}</h3>
//             <p className="text-xs text-gray-500 font-medium">
//               {policy.policy_number} • Version v{version?.version_number || '1.0'} • {fileTypeLabel}
//             </p>
//           </div>
//         </div>

//         <div className="flex items-center gap-2">
//           {fileUrl && (
//             <button
//               onClick={handleDownload}
//               className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-sm"
//             >
//               <Download className="h-3.5 w-3.5" />
//               Download Original
//             </button>
//           )}
//           <button
//             onClick={() => {
//               if (isFullScreen && onClose) onClose();
//               setIsFullScreen(!isFullScreen);
//             }}
//             className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition"
//           >
//             {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
//           </button>
//           {isFullScreen && onClose && (
//             <button onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
//               <X className="h-4 w-4" />
//             </button>
//           )}
//         </div>
//       </div>

//       {/* ── Document Container (Unified Scroll Viewport) ── */}
//       <div
//         ref={scrollContainerRef}
//         onScroll={handleScroll}
//         className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 focus:outline-none"
//       >
//         <div className="max-w-4xl mx-auto space-y-6">
          
//           {/* Document Content Block */}
//           <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden min-h-[500px]">
//             {/* HTML Rendering */}
//             {isHtml && (
//               <div className="p-8">
//                 <div
//                   className="prose prose-indigo max-w-none text-gray-800 leading-relaxed"
//                   dangerouslySetInnerHTML={{ __html: version!.content_html }}
//                 />
//               </div>
//             )}

//             {/* PDF Rendering */}
//             {isPdf && fileUrl && !viewerError && (
//               <iframe
//                 src={viewerUrl!}
//                 className="w-full bg-white"
//                 style={{ height: '620px' }}
//                 title={`${policy.title} - PDF Preview`}
//                 onError={() => setViewerError(true)}
//               />
//             )}

//             {/* Word/Excel Cloud Viewer */}
//             {(isWord || isExcel) && canUseOfficeViewer && !viewerError && (
//               <iframe
//                 src={viewerUrl!}
//                 className="w-full bg-white border-0"
//                 style={{ height: '620px' }}
//                 title={`${policy.title} - Office Preview`}
//                 onError={() => setViewerError(true)}
//               />
//             )}

//             {/* Fallbacks */}
//             {(isWord || isExcel) && isLocalhost && (
//               <div className="flex flex-col items-center justify-center p-12 text-center bg-white min-h-[500px]">
//                 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50">
//                   <FileTypeIcon className="h-8 w-8 text-indigo-600" />
//                 </div>
//                 <h3 className="text-md font-bold text-gray-900 mb-1">Localhost Environment</h3>
//                 <p className="text-xs text-gray-500 max-w-sm mb-4">
//                   In-browser previews for document files require cloud communication. In production, this file will render natively. Please use download to view locally.
//                 </p>
//                 <button
//                   onClick={handleDownload}
//                   className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
//                 >
//                   <Download className="h-3.5 w-3.5" /> Download {fileTypeLabel}
//                 </button>
//               </div>
//             )}

//             {viewerError && (
//               <FallbackViewer fileTypeLabel={fileTypeLabel} onDownload={handleDownload} fileUrl={fileUrl || ''} />
//             )}
//           </div>

//           {/* ── Last Page Indicator Prompt ── */}
//           {!scrolledToBottom && isPublished && approvalChain?.approved && (
//             <div className="flex items-center justify-center gap-2 text-gray-500 text-xs font-semibold animate-pulse">
//               <ArrowDown className="h-3.5 w-3.5" />
//               Scroll down to view signature endorsements
//             </div>
//           )}

//           {/* ── THE LAST PAGE: Formal Certificate of Digital Signature ── */}
//           {isPublished && approvalChain?.approved && (
//             <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 md:p-12 space-y-8 relative">
              
//               {/* Certificate Decorative Background Frame */}
//               <div className="absolute inset-4 border-2 border-dashed border-green-200 rounded-lg pointer-events-none" />

//               <div className="relative z-10 space-y-8">
//                 {/* Stamp Header */}
//                 <div className="text-center space-y-2">
//                   <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-green-600 border border-green-200">
//                     <Shield className="h-6 w-6 animate-pulse" />
//                   </div>
//                   <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">
//                     Digital Seal & Endorsement Page
//                   </h2>
//                   <p className="text-xs text-gray-500 max-w-md mx-auto">
//                     This page marks the official close of the policy document and provides digital validation of all stakeholders.
//                   </p>
//                 </div>

//                 {/* Grid layout of signatures */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
//                   {/* Author Stamp */}
//                   <SignatureStampCard
//                     title="Prepared By"
//                     name={policy.created_by_name || 'HR Author'}
//                     role="Policy Author / HR Administrator"
//                     date={policy.created_at}
//                     color="blue"
//                   />

//                   {/* Approvers from workflow chain */}
//                   {approvalChain.steps.map((step, idx) => (
//                     <SignatureStampCard
//                       key={idx}
//                       title={step.step_name || 'Approver Step'}
//                       name={step.approver_name}
//                       role={step.approver_position || 'Assigned Reviewer'}
//                       date={step.approved_at}
//                       employeeId={step.approver_employee_id}
//                       comments={step.comments}
//                       color="green"
//                     />
//                   ))}

//                   {/* Publisher Stamp */}
//                   {approvalChain.published_at && (
//                     <SignatureStampCard
//                       title="Published & Issued By"
//                       name={approvalChain.published_by || 'HR Administrator'}
//                       role="System Registrar"
//                       date={approvalChain.published_at}
//                       color="emerald"
//                     />
//                   )}
//                 </div>

//                 {/* Validation Footer Seal */}
//                 <div className="border-t border-gray-100 pt-6 flex flex-col items-center space-y-4">
//                   <div className="relative flex items-center justify-center rounded-full border-4 border-double border-green-600 h-20 w-20 bg-green-50/50">
//                     <div className="text-center">
//                       <Award className="mx-auto h-6 w-6 text-green-600" />
//                       <p className="font-extrabold text-green-700 text-[8px] uppercase tracking-wider mt-0.5">
//                         Approved
//                       </p>
//                     </div>
//                     <div className="absolute inset-0 flex items-center justify-center">
//                       <div className="rounded-full border border-green-400 h-16 w-16 animate-ping opacity-10" />
//                     </div>
//                   </div>

//                   <div className="text-center space-y-1">
//                     <p className="text-[10px] font-mono font-semibold text-gray-400">
//                       System Verification Hash ID: {policy.id.slice(0, 8).toUpperCase()}-{version?.id.slice(0, 8).toUpperCase()}
//                     </p>
//                     <p className="text-[11px] text-gray-500 font-medium">
//                       Approved through secure HRMS Digital Workflow standard. No manual signatures required.
//                     </p>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           )}

//         </div>
//       </div>
//     </div>
//   );
// }

// /* =========================================================================== */
// /* FALLBACK PREVIEW                                                            */
// /* =========================================================================== */
// function FallbackViewer({ fileTypeLabel, onDownload, fileUrl }: {
//   fileTypeLabel: string; onDownload: () => void; fileUrl: string;
// }) {
//   return (
//     <div className="flex flex-col items-center justify-center p-12 text-center bg-white min-h-[500px]">
//       <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
//         <AlertTriangle className="h-8 w-8 text-red-500" />
//       </div>
//       <h3 className="text-md font-bold text-gray-900 mb-1">Preview Generation Failed</h3>
//       <p className="text-xs text-gray-500 max-w-sm mb-6">
//         The system could not initialize the inline preview window. You can bypass this by opening the document directly.
//       </p>
//       <div className="flex gap-3">
//         <button
//           onClick={onDownload}
//           className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition"
//         >
//           <Download className="h-3.5 w-3.5" /> Download
//         </button>
//         <a
//           href={fileUrl}
//           target="_blank"
//           rel="noopener noreferrer"
//           className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
//         >
//           <ExternalLink className="h-3.5 w-3.5" /> Open Direct Link
//         </a>
//       </div>
//     </div>
//   );
// }

// /* =========================================================================== */
// /* DIGITAL SIGNATURE STAMP CARD                                                */
// /* =========================================================================== */
// function SignatureStampCard({
//   title, name, role, date, employeeId, comments, color,
// }: {
//   title: string; name: string; role: string; date: string | null;
//   employeeId?: string; comments?: string; color: 'blue' | 'green' | 'emerald';
// }) {
//   const colorMap = {
//     blue: { bg: 'bg-blue-50/50', border: 'border-blue-200', text: 'text-blue-800', sign: 'text-blue-900', ribbon: 'bg-blue-600' },
//     green: { bg: 'bg-green-50/50', border: 'border-green-200', text: 'text-green-800', sign: 'text-green-900', ribbon: 'bg-green-600' },
//     emerald: { bg: 'bg-emerald-50/50', border: 'border-emerald-200', text: 'text-emerald-800', sign: 'text-emerald-900', ribbon: 'bg-emerald-600' },
//   };

//   const c = colorMap[color];

//   return (
//     <div className={`rounded-xl border border-gray-200 ${c.bg} p-5 space-y-4 shadow-sm relative overflow-hidden`}>
//       <div className={`absolute top-0 left-0 w-1.5 h-full ${c.ribbon}`} />
      
//       <div className="space-y-1">
//         <span className={`text-[10px] font-bold uppercase tracking-wider ${c.text}`}>
//           {title}
//         </span>
//         <h4 className="text-sm font-bold text-gray-900 leading-tight">
//           {name}
//         </h4>
//         <p className="text-[11px] text-gray-500 font-medium">
//           {role}
//         </p>
//         {employeeId && (
//           <p className="text-[9px] font-mono text-gray-400">
//             ID: {employeeId}
//           </p>
//         )}
//       </div>

//       {/* Cursive Digital Endorsement Signature */}
//       <div className="border-b border-gray-200/80 pb-3 pt-2">
//         <p
//           className={`text-lg font-bold select-none ${c.sign} rotate-[-3deg] transform origin-left tracking-wide`}
//           style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
//         >
//           {name}
//         </p>
//       </div>

//       {/* Time and Feedback */}
//       <div className="space-y-1 text-[10px] text-gray-400">
//         {date && (
//           <p className="font-semibold">
//             Date: {new Date(date).toLocaleString('en-IN', {
//               day: '2-digit', month: 'short', year: 'numeric',
//               hour: '2-digit', minute: '2-digit'
//             })}
//           </p>
//         )}
//         {comments && (
//           <p className="italic text-gray-500 font-medium bg-white/60 p-1.5 rounded border border-gray-100">
//             "{comments}"
//           </p>
//         )}
//       </div>
//     </div>
//   );
// }


// import React from 'react';
// import type { PolicyDetail } from '../../types/policy';

// interface PolicyDocumentViewerProps {
//   policy: PolicyDetail;
// }

// export default function PolicyDocumentViewer({ policy }: PolicyDocumentViewerProps) {
//   const version = policy.current_version;

//   if (!version) {
//     return (
//       <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
//         No document version available.
//       </div>
//     );
//   }

//   // Uses backend preview endpoint which delivers the stamped PDF directly
// const previewUrl = `http://127.0.0.1:8000/api/v1/policies/policies/${policy.id}/preview/`;

//   const contentType = version.content_type?.toUpperCase() || '';
//   const isPdf = contentType === 'PDF' || version.file_url?.toLowerCase().endsWith('.pdf');

//   if (isPdf) {
//     return (
//       <div className="w-full bg-slate-800 rounded-xl p-2 shadow-inner">
//         <iframe
//           src={previewUrl}
//           className="w-full h-[850px] rounded-lg border-0 bg-white"
//           title={policy.title}
//         />
//       </div>
//     );
//   }

//   if (version.content_html) {
//     return (
//       <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 min-h-[500px] prose max-w-none">
//         <div dangerouslySetInnerHTML={{ __html: version.content_html }} />
//       </div>
//     );
//   }

//   return (
//     <div className="w-full bg-slate-800 rounded-xl p-2 shadow-inner">
//       <iframe
//         src={previewUrl}
//         className="w-full h-[850px] rounded-lg border-0 bg-white"
//         title={policy.title}
//       />
//     </div>
//   );
// }


// import { useEffect, useState } from 'react';
// import mammoth from 'mammoth';
// import * as XLSX from 'xlsx';
// import api from '../../api/axios';
// import type { PolicyDetail } from '../../types/policy';

// interface PolicyDocumentViewerProps {
//   policy: PolicyDetail;
// }

// // function ApprovalStampFooter({ policy }: { policy: PolicyDetail }) {
// //   const chain = (policy as any).approval_chain;
// //   if (!chain || !chain.approved || !chain.steps?.length) return null;

// //   return (
// //     <div className="mt-6 rounded-xl border-2 border-emerald-600 bg-white overflow-hidden">
// //       <div className="bg-emerald-600 text-white text-center text-xs font-bold py-1.5 tracking-wide">
// //         OFFICIALLY APPROVED & DIGITALLY SEALED DOCUMENT
// //       </div>
// //       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
// //         {chain.steps.map((step: any, i: number) => (
// //           <div key={i}>
// //             <p className="text-[10px] font-bold text-gray-500 uppercase">
// //               {step.step_name || 'Approved By'}
// //             </p>
// //             <p className="text-sm font-bold text-gray-900">{step.approver_name}</p>
// //             <p className="text-xs text-gray-500">
// //               {step.approved_at ? new Date(step.approved_at).toLocaleDateString('en-IN') : 'N/A'}
// //             </p>
// //             {step.approver_employee_id && (
// //               <p className="text-xs text-gray-500">Emp ID: {step.approver_employee_id}</p>
// //             )}
// //             <span className="mt-1 inline-block rounded-full bg-emerald-50 border border-emerald-600 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
// //               ✓ DIGITALLY SIGNED
// //             </span>
// //           </div>
// //         ))}
// //       </div>
// //     </div>
// //   );
// // }
// function ApprovalStampFooter({ policy }: { policy: PolicyDetail }) {
//   const chain = (policy as any).approval_chain;
//   if (!chain || !chain.approved || !chain.steps?.length) return null;

//   return (
//     <div className="border-t-2 border-emerald-600">
//       <div className="bg-emerald-600 text-white text-center text-xs font-bold py-1.5 tracking-wide">
//         OFFICIALLY APPROVED & DIGITALLY SEALED DOCUMENT
//       </div>
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
//         {chain.steps.map((step: any, i: number) => (
//           <div key={i}>
//             <p className="text-[10px] font-bold text-gray-500 uppercase">
//               {step.step_name || 'Approved By'}
//             </p>
//             <p className="text-sm font-bold text-gray-900">{step.approver_name}</p>
//             <p className="text-xs text-gray-500">
//               {step.approved_at ? new Date(step.approved_at).toLocaleDateString('en-IN') : 'N/A'}
//             </p>
//             {step.approver_employee_id && (
//               <p className="text-xs text-gray-500">Emp ID: {step.approver_employee_id}</p>
//             )}
//             <span className="mt-1 inline-block rounded-full bg-emerald-50 border border-emerald-600 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
//               ✓ DIGITALLY SIGNED
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }
// export default function PolicyDocumentViewer({ policy }: PolicyDocumentViewerProps) {
//   const version = policy.current_version;
//   const [htmlContent, setHtmlContent] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const contentType = version?.content_type?.toUpperCase() || '';
//   const isPdf = contentType === 'PDF' || !!version?.file_url?.toLowerCase().endsWith('.pdf');
//   const isDocx = contentType === 'DOCX' || !!version?.file_url?.toLowerCase().match(/\.docx?$/);
//   const isXlsx = contentType === 'XLSX' || !!version?.file_url?.toLowerCase().match(/\.xlsx?$/);

//   useEffect(() => {
//     if (!version || isPdf || !(isDocx || isXlsx)) return;

//     let cancelled = false;
//     setLoading(true);
//     setError(null);
//     setHtmlContent(null);

//     api
//       .get(`/policies/policies/${policy.id}/download/`, { responseType: 'arraybuffer' })
//       .then(async (res) => {
//         if (cancelled) return;
//         if (isDocx) {
//           const result = await mammoth.convertToHtml({ arrayBuffer: res.data });
//           if (!cancelled) setHtmlContent(result.value);
//         } else if (isXlsx) {
//           const workbook = XLSX.read(new Uint8Array(res.data), { type: 'array' });
//           const firstSheetName = workbook.SheetNames[0];
//           const sheet = workbook.Sheets[firstSheetName];
//           const html = XLSX.utils.sheet_to_html(sheet);
//           if (!cancelled) setHtmlContent(html);
//         }
//       })
//       .catch(() => {
//         if (!cancelled) setError('Failed to load document preview.');
//       })
//       .finally(() => {
//         if (!cancelled) setLoading(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [policy.id, version, isDocx, isXlsx, isPdf]);

//   if (!version) {
//     return (
//       <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
//         No document version available.
//       </div>
//     );
//   }

//   const previewUrl = `${api.defaults.baseURL}/policies/policies/${policy.id}/preview/`;

//   if (isPdf) {
//     return (
//       <div className="w-full bg-slate-800 rounded-xl p-2 shadow-inner">
//         <iframe
//           src={previewUrl}
//           className="w-full h-[850px] rounded-lg border-0 bg-white"
//           title={policy.title}
//         />
//       </div>
//     );
//   }

//   if (isDocx || isXlsx) {
//     if (loading) {
//       return (
//         <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
//           Loading document…
//         </div>
//       );
//     }
//     if (error) {
//       return (
//         <div className="rounded-xl bg-white p-12 text-center text-red-600 shadow-sm border border-gray-200">
//           {error}
//         </div>
//       );
//     }
//     if (htmlContent) {
//       return (
//         <div>
//           <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 min-h-[500px] max-h-[850px] overflow-auto prose max-w-none">
//             <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
//           </div>
//           <ApprovalStampFooter policy={policy} />
//         </div>
//       );
//     }
//   }

//   if (version.content_html) {
//     return (
//       <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 min-h-[500px] prose max-w-none">
//         <div dangerouslySetInnerHTML={{ __html: version.content_html }} />
//       </div>
//     );
//   }

//   return (
//     <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
//       Preview not available for this file type.
//     </div>
//   );
// }

// =================================================================================================================

// import { useEffect, useRef, useState } from 'react';
// import mammoth from 'mammoth';
// import * as XLSX from 'xlsx';
// import api from '../../api/axios';
// import type { PolicyDetail } from '../../types/policy';

// interface PolicyDocumentViewerProps {
//   policy: PolicyDetail;
// }

// // Simulated A4 page at 96dpi
// const PAGE_WIDTH = 794;
// const PAGE_HEIGHT = 1123;
// const PAGE_PADDING = 56;
// const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2;
// const STAMP_ESTIMATED_HEIGHT = 190; // conservative height for the stamp block

// function ApprovalStamp({ policy }: { policy: PolicyDetail }) {
//   const chain = (policy as any).approval_chain;
//   if (!chain || !chain.approved || !chain.steps?.length) return null;

//   return (
//     <div className="border-2 border-emerald-600 rounded-lg overflow-hidden mt-6">
//       <div className="bg-emerald-600 text-white text-center text-xs font-bold py-1.5 tracking-wide">
//         OFFICIALLY APPROVED & DIGITALLY SEALED DOCUMENT
//       </div>
//       <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
//         {chain.steps.map((step: any, i: number) => (
//           <div key={i}>
//             <p className="text-[10px] font-bold text-gray-500 uppercase">
//               {step.step_name || 'Approved By'}
//             </p>
//             <p className="text-sm font-bold text-gray-900">{step.approver_name}</p>
//             <p className="text-xs text-gray-500">
//               {step.approved_at ? new Date(step.approved_at).toLocaleDateString('en-IN') : 'N/A'}
//             </p>
//             {step.approver_employee_id && (
//               <p className="text-xs text-gray-500">Emp ID: {step.approver_employee_id}</p>
//             )}
//             <span className="mt-1 inline-block rounded-full bg-emerald-50 border border-emerald-600 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
//               ✓ DIGITALLY SIGNED
//             </span>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /**
//  * Splits raw HTML into fixed-height "pages" by measuring each top-level
//  * block element in a hidden container, then figures out whether the
//  * approval stamp fits on the last page or needs a page of its own.
//  */
// function usePaginatedDocument(htmlContent: string | null, hasStamp: boolean) {
//   const [pages, setPages] = useState<string[]>([]);
//   const [stampOnNewPage, setStampOnNewPage] = useState(false);
//   const measureRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const measureEl = measureRef.current;
//     if (!htmlContent || !measureEl) {
//       setPages([]);
//       return;
//     }

//     measureEl.innerHTML = htmlContent;
//     const blocks = Array.from(measureEl.children) as HTMLElement[];

//     const builtPages: string[] = [];
//     let currentPageHtml = '';
//     let currentHeight = 0;

//     blocks.forEach((block) => {
//       const blockHeight = block.offsetHeight;

//       // If a single block is taller than a whole page (e.g. a huge table),
//       // it still gets placed alone on its own page rather than looping forever.
//       if (currentHeight + blockHeight > CONTENT_HEIGHT && currentPageHtml) {
//         builtPages.push(currentPageHtml);
//         currentPageHtml = '';
//         currentHeight = 0;
//       }

//       currentPageHtml += block.outerHTML;
//       currentHeight += blockHeight;
//     });

//     if (currentPageHtml) {
//       builtPages.push(currentPageHtml);
//     }
//     if (builtPages.length === 0) {
//       builtPages.push('');
//     }

//     const remainingOnLastPage = CONTENT_HEIGHT - currentHeight;
//     setStampOnNewPage(hasStamp && remainingOnLastPage < STAMP_ESTIMATED_HEIGHT);
//     setPages(builtPages);

//     measureEl.innerHTML = '';
//   }, [htmlContent, hasStamp]);

//   return { pages, stampOnNewPage, measureRef };
// }

// export default function PolicyDocumentViewer({ policy }: PolicyDocumentViewerProps) {
//   const version = policy.current_version;
//   const [htmlContent, setHtmlContent] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const contentType = version?.content_type?.toUpperCase() || '';
//   const isPdf = contentType === 'PDF' || !!version?.file_url?.toLowerCase().endsWith('.pdf');
//   const isDocx = contentType === 'DOCX' || !!version?.file_url?.toLowerCase().match(/\.docx?$/);
//   const isXlsx = contentType === 'XLSX' || !!version?.file_url?.toLowerCase().match(/\.xlsx?$/);
//   const isPaginated = isDocx || isXlsx;

//   const chain = (policy as any).approval_chain;
//   const hasStamp = !!(chain && chain.approved && chain.steps?.length);

//   const { pages, stampOnNewPage, measureRef } = usePaginatedDocument(
//     isPaginated ? htmlContent : null,
//     hasStamp
//   );

//   useEffect(() => {
//     if (!version || isPdf || !isPaginated) return;

//     let cancelled = false;
//     setLoading(true);
//     setError(null);
//     setHtmlContent(null);

//     api
//       .get(`/policies/policies/${policy.id}/download/`, { responseType: 'arraybuffer' })
//       .then(async (res) => {
//         if (cancelled) return;
//         if (isDocx) {
//           const result = await mammoth.convertToHtml({ arrayBuffer: res.data });
//           if (!cancelled) setHtmlContent(result.value);
//         } else if (isXlsx) {
//           const workbook = XLSX.read(new Uint8Array(res.data), { type: 'array' });
//           const firstSheetName = workbook.SheetNames[0];
//           const sheet = workbook.Sheets[firstSheetName];
//           const html = XLSX.utils.sheet_to_html(sheet);
//           if (!cancelled) setHtmlContent(html);
//         }
//       })
//       .catch(() => {
//         if (!cancelled) setError('Failed to load document preview.');
//       })
//       .finally(() => {
//         if (!cancelled) setLoading(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [policy.id, version, isDocx, isXlsx, isPdf, isPaginated]);

//   if (!version) {
//     return (
//       <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
//         No document version available.
//       </div>
//     );
//   }

//   const previewUrl = `${api.defaults.baseURL}/policies/policies/${policy.id}/preview/`;

//   if (isPdf) {
//     return (
//       <div className="w-full bg-slate-800 rounded-xl p-2 shadow-inner">
//         <iframe
//           src={previewUrl}
//           className="w-full h-[850px] rounded-lg border-0 bg-white"
//           title={policy.title}
//         />
//       </div>
//     );
//   }

//   if (isPaginated) {
//     return (
//       <div className="w-full bg-slate-800 rounded-xl p-4 shadow-inner">
//         {/* Hidden measuring container — never visible, used only to compute block heights */}
//         <div
//           ref={measureRef}
//           className="prose max-w-none"
//           style={{
//             position: 'fixed',
//             visibility: 'hidden',
//             pointerEvents: 'none',
//             width: PAGE_WIDTH - PAGE_PADDING * 2,
//             top: -99999,
//             left: -99999,
//           }}
//         />

//         {loading && (
//           <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm">
//             Loading document…
//           </div>
//         )}

//         {error && (
//           <div className="rounded-xl bg-white p-12 text-center text-red-600 shadow-sm">
//             {error}
//           </div>
//         )}

//         {!loading && !error && pages.length > 0 && (
//           <div className="flex flex-col items-center gap-6">
//             {pages.map((pageHtml, i) => {
//               const isLastPage = i === pages.length - 1;
//               return (
//                 <div
//                   key={i}
//                   className="bg-white shadow-lg rounded-sm"
//                   style={{
//                     width: PAGE_WIDTH,
//                     minHeight: PAGE_HEIGHT,
//                     padding: PAGE_PADDING,
//                     boxSizing: 'border-box',
//                   }}
//                 >
//                   <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
//                   {isLastPage && !stampOnNewPage && <ApprovalStamp policy={policy} />}
//                 </div>
//               );
//             })}

//             {stampOnNewPage && (
//               <div
//                 className="bg-white shadow-lg rounded-sm"
//                 style={{
//                   width: PAGE_WIDTH,
//                   minHeight: PAGE_HEIGHT,
//                   padding: PAGE_PADDING,
//                   boxSizing: 'border-box',
//                 }}
//               >
//                 <ApprovalStamp policy={policy} />
//               </div>
//             )}
//           </div>
//         )}
//       </div>
//     );
//   }

//   if (version.content_html) {
//     return (
//       <div className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 min-h-[500px] prose max-w-none">
//         <div dangerouslySetInnerHTML={{ __html: version.content_html }} />
//       </div>
//     );
//   }

//   return (
//     <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
//       Preview not available for this file type.
//     </div>
//   );
// }


import { useEffect, useRef, useState } from 'react';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import api from '../../api/axios';
import type { PolicyDetail } from '../../types/policy';

interface PolicyDocumentViewerProps {
  policy: PolicyDetail;
  onReadyChange?: (ready: boolean) => void;
}

const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_PADDING = 56;
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PADDING * 2;
const STAMP_ESTIMATED_HEIGHT = 190;

function ApprovalStamp({ policy }: { policy: PolicyDetail }) {
  const chain = (policy as any).approval_chain;
  if (!chain || !chain.approved || !chain.steps?.length) return null;

  return (
    <div className="border-2 border-emerald-600 rounded-lg overflow-hidden mt-6">
      <div className="bg-emerald-600 text-white text-center text-xs font-bold py-1.5 tracking-wide">
        OFFICIALLY APPROVED & DIGITALLY SEALED DOCUMENT
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        {chain.steps.map((step: any, i: number) => (
          <div key={i}>
            <p className="text-[10px] font-bold text-gray-500 uppercase">
              {step.step_name || 'Approved By'}
            </p>
            <p className="text-sm font-bold text-gray-900">{step.approver_name}</p>
            <p className="text-xs text-gray-500">
              {step.approved_at ? new Date(step.approved_at).toLocaleDateString('en-IN') : 'N/A'}
            </p>
            {step.approver_employee_id && (
              <p className="text-xs text-gray-500">Emp ID: {step.approver_employee_id}</p>
            )}
            <span className="mt-1 inline-block rounded-full bg-emerald-50 border border-emerald-600 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              ✓ DIGITALLY SIGNED
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function usePaginatedDocument(htmlContent: string | null, hasStamp: boolean) {
  const [pages, setPages] = useState<string[]>([]);
  const [stampOnNewPage, setStampOnNewPage] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const measureEl = measureRef.current;
    if (!htmlContent || !measureEl) {
      setPages([]);
      return;
    }

    measureEl.innerHTML = htmlContent;
    const blocks = Array.from(measureEl.children) as HTMLElement[];

    const builtPages: string[] = [];
    let currentPageHtml = '';
    let currentHeight = 0;

    blocks.forEach((block) => {
      const blockHeight = block.offsetHeight;
      if (currentHeight + blockHeight > CONTENT_HEIGHT && currentPageHtml) {
        builtPages.push(currentPageHtml);
        currentPageHtml = '';
        currentHeight = 0;
      }
      currentPageHtml += block.outerHTML;
      currentHeight += blockHeight;
    });

    if (currentPageHtml) {
      builtPages.push(currentPageHtml);
    }
    if (builtPages.length === 0) {
      builtPages.push('');
    }

    const remainingOnLastPage = CONTENT_HEIGHT - currentHeight;
    setStampOnNewPage(hasStamp && remainingOnLastPage < STAMP_ESTIMATED_HEIGHT);
    setPages(builtPages);

    measureEl.innerHTML = '';
  }, [htmlContent, hasStamp]);

  return { pages, stampOnNewPage, measureRef };
}

export default function PolicyDocumentViewer({ policy, onReadyChange }: PolicyDocumentViewerProps) {
  const version = policy.current_version;
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contentType = version?.content_type?.toUpperCase() || '';
  const isPdf = contentType === 'PDF' || !!version?.file_url?.toLowerCase().endsWith('.pdf');
  const isDocx = contentType === 'DOCX' || !!version?.file_url?.toLowerCase().match(/\.docx?$/);
  const isXlsx = contentType === 'XLSX' || !!version?.file_url?.toLowerCase().match(/\.xlsx?$/);
  const isPaginated = isDocx || isXlsx;

  const chain = (policy as any).approval_chain;
  const hasStamp = !!(chain && chain.approved && chain.steps?.length);

  const { pages, stampOnNewPage, measureRef } = usePaginatedDocument(
    isPaginated ? htmlContent : null,
    hasStamp
  );

  useEffect(() => {
    if (!version || isPdf || !isPaginated) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setHtmlContent(null);
    onReadyChange?.(false);

    api
      .get(`/policies/policies/${policy.id}/download/`, { responseType: 'arraybuffer' })
      .then(async (res) => {
        if (cancelled) return;
        if (isDocx) {
          const result = await mammoth.convertToHtml({ arrayBuffer: res.data });
          if (!cancelled) setHtmlContent(result.value);
        } else if (isXlsx) {
          const workbook = XLSX.read(new Uint8Array(res.data), { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const html = XLSX.utils.sheet_to_html(sheet);
          if (!cancelled) setHtmlContent(html);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load document preview.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [policy.id, version, isDocx, isXlsx, isPdf, isPaginated]);

  // Signal readiness once pages are actually built (or once content_html is available)
  useEffect(() => {
    if (isPaginated) {
      onReadyChange?.(!loading && !error && pages.length > 0);
    } else if (!isPdf && version?.content_html) {
      onReadyChange?.(true);
    } else if (isPdf) {
      // PDF downloads go through the stamped-PDF backend route, not html2pdf
      onReadyChange?.(false);
    }
  }, [isPaginated, loading, error, pages.length, isPdf, version?.content_html]);

  if (!version) {
    return (
      <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
        No document version available.
      </div>
    );
  }

  const previewUrl = `${api.defaults.baseURL}/policies/policies/${policy.id}/preview/`;

  if (isPdf) {
    return (
      <div className="w-full bg-slate-800 rounded-xl p-2 shadow-inner">
        <iframe
          src={previewUrl}
          className="w-full h-[850px] rounded-lg border-0 bg-white"
          title={policy.title}
        />
      </div>
    );
  }

  if (isPaginated) {
    return (
      <div className="w-full bg-slate-800 rounded-xl p-4 shadow-inner">
        <div
          ref={measureRef}
          className="prose max-w-none"
          style={{
            position: 'fixed',
            visibility: 'hidden',
            pointerEvents: 'none',
            width: PAGE_WIDTH - PAGE_PADDING * 2,
            top: -99999,
            left: -99999,
          }}
        />

        {loading && (
          <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm">
            Loading document…
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-white p-12 text-center text-red-600 shadow-sm">
            {error}
          </div>
        )}

        {!loading && !error && pages.length > 0 && (
          <div id="policy-document-content" className="flex flex-col items-center gap-6">
            {pages.map((pageHtml, i) => {
              const isLastPage = i === pages.length - 1;
              return (
                <div
                  key={i}
                  className="bg-white shadow-lg rounded-sm"
                  style={{
                    width: PAGE_WIDTH,
                    minHeight: PAGE_HEIGHT,
                    padding: PAGE_PADDING,
                    boxSizing: 'border-box',
                  }}
                >
                  <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: pageHtml }} />
                  {isLastPage && !stampOnNewPage && <ApprovalStamp policy={policy} />}
                </div>
              );
            })}

            {stampOnNewPage && (
              <div
                className="bg-white shadow-lg rounded-sm"
                style={{
                  width: PAGE_WIDTH,
                  minHeight: PAGE_HEIGHT,
                  padding: PAGE_PADDING,
                  boxSizing: 'border-box',
                }}
              >
                <ApprovalStamp policy={policy} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (version.content_html) {
    return (
      <div
        id="policy-document-content"
        className="rounded-xl bg-white p-8 shadow-sm border border-gray-200 min-h-[500px] prose max-w-none"
      >
        <div dangerouslySetInnerHTML={{ __html: version.content_html }} />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-200">
      Preview not available for this file type.
    </div>
  );
}