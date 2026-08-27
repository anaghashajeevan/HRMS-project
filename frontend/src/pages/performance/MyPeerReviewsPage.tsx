// import { useEffect, useMemo, useState } from 'react';
// import {
//   Users2, Loader2, Clock, CheckCircle2, XCircle,
//   Star, AlertCircle, Send, X, MessageSquare, Info,
// } from 'lucide-react';
// import Sidebar from '../../components/Sidebar';
// import Topbar from '../../components/Topbar';
// import { peerRatingsApi } from '../../api/performance';
// import type { PendingPeerReview, PeerRatingStatus } from '../../types/performance';
// import toast from 'react-hot-toast';

// const STATUS_CONFIG: Record<PeerRatingStatus, { label: string; className: string; icon: any }> = {
//   PENDING: { label: 'Pending', className: 'bg-amber-100 text-amber-700', icon: Clock },
//   SUBMITTED: { label: 'Submitted', className: 'bg-green-100 text-green-700', icon: CheckCircle2 },
//   DECLINED: { label: 'Declined', className: 'bg-gray-100 text-gray-600', icon: XCircle },
// };

// export default function MyPeerReviewsPage() {
//   const [reviews, setReviews] = useState<PendingPeerReview[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [filter, setFilter] = useState<'PENDING' | 'ALL'>('PENDING');
//   const [selectedReview, setSelectedReview] = useState<PendingPeerReview | null>(null);
//   const [showRatingModal, setShowRatingModal] = useState(false);
//   const [showDeclineModal, setShowDeclineModal] = useState(false);

//   const fetchReviews = async () => {
//     setLoading(true);
//     try {
//       const data = await peerRatingsApi.myPendingReviews();
//       setReviews(data);
//     } catch (err) {
//       toast.error('Failed to load peer reviews');
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchReviews();
//   }, []);

//   const filtered = useMemo(() => {
//     if (filter === 'PENDING') return reviews.filter((r) => r.status === 'PENDING');
//     return reviews;
//   }, [reviews, filter]);

//   const stats = useMemo(() => ({
//     pending: reviews.filter((r) => r.status === 'PENDING').length,
//     submitted: reviews.filter((r) => r.status === 'SUBMITTED').length,
//     total: reviews.length,
//   }), [reviews]);

//   const formatDate = (dateStr: string | null) => {
//     if (!dateStr) return '—';
//     return new Date(dateStr).toLocaleDateString('en-IN', {
//       day: 'numeric', month: 'short', year: 'numeric',
//     });
//   };

//   const openRatingModal = (review: PendingPeerReview) => {
//     setSelectedReview(review);
//     setShowRatingModal(true);
//   };

//   const openDeclineModal = (review: PendingPeerReview) => {
//     setSelectedReview(review);
//     setShowDeclineModal(true);
//   };

//   return (
//     <div className="flex h-screen bg-gray-50">
//       <Sidebar />
//       <div className="flex flex-1 flex-col overflow-hidden">
//         <Topbar />
//         <main className="flex-1 overflow-y-auto p-6">
//           {/* Header */}
//           <div className="mb-6">
//             <div className="flex items-center gap-2">
//               <Users2 className="h-6 w-6 text-primary-600" />
//               <h1 className="text-2xl font-bold text-gray-900">Peer Reviews</h1>
//             </div>
//             <p className="mt-1 text-sm text-gray-500">
//               Rate colleagues nominated for peer feedback on their KRAs
//             </p>
//           </div>

//           {/* Info banner */}
//           <div className="mb-6 flex items-start gap-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-800 ring-1 ring-blue-100">
//             <Info className="mt-0.5 h-5 w-5 flex-shrink-0" />
//             <div>
//               <p className="font-medium">Confidentiality Note</p>
//               <p className="mt-1 text-blue-700">
//                 Your ratings contribute to the peer average (visible to the rated employee).
//                 Your comments are visible ONLY to HR and the reporting manager — not to the
//                 employee being rated. Please be honest and constructive.
//               </p>
//             </div>
//           </div>

//           {/* Stats */}
//           <div className="mb-6 grid grid-cols-3 gap-3">
//             <StatCard label="Pending" value={stats.pending} color="bg-amber-50 text-amber-700" icon={Clock} highlight={stats.pending > 0} />
//             <StatCard label="Submitted" value={stats.submitted} color="bg-green-50 text-green-700" icon={CheckCircle2} />
//             <StatCard label="Total" value={stats.total} color="bg-primary-50 text-primary-700" icon={Users2} />
//           </div>

//           {/* Filter tabs */}
//           <div className="mb-4 flex gap-2 border-b border-gray-200">
//             <button
//               onClick={() => setFilter('PENDING')}
//               className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
//                 filter === 'PENDING'
//                   ? 'border-primary-600 text-primary-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700'
//               }`}
//             >
//               Pending {stats.pending > 0 && <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">{stats.pending}</span>}
//             </button>
//             <button
//               onClick={() => setFilter('ALL')}
//               className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
//                 filter === 'ALL'
//                   ? 'border-primary-600 text-primary-600'
//                   : 'border-transparent text-gray-500 hover:text-gray-700'
//               }`}
//             >
//               All ({stats.total})
//             </button>
//           </div>

//           {/* Content */}
//           {loading ? (
//             <div className="flex justify-center py-16">
//               <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
//             </div>
//           ) : filtered.length === 0 ? (
//             <div className="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-gray-100">
//               <Users2 className="mx-auto h-12 w-12 text-gray-300" />
//               <h3 className="mt-4 text-base font-semibold text-gray-900">
//                 {filter === 'PENDING' ? 'No pending peer reviews' : 'No peer reviews yet'}
//               </h3>
//               <p className="mt-1 text-sm text-gray-500">
//                 {filter === 'PENDING'
//                   ? 'You\'re all caught up! Check back when your team members submit new KRAs.'
//                   : 'You haven\'t been nominated for any peer reviews yet.'}
//               </p>
//             </div>
//           ) : (
//             <div className="space-y-3">
//               {filtered.map((review) => (
//                 <ReviewCard
//                   key={review.id}
//                   review={review}
//                   onRate={() => openRatingModal(review)}
//                   onDecline={() => openDeclineModal(review)}
//                 />
//               ))}
//             </div>
//           )}

//           {/* Rating Modal */}
//           {showRatingModal && selectedReview && (
//             <RatingModal
//               review={selectedReview}
//               onClose={() => setShowRatingModal(false)}
//               onSuccess={() => {
//                 setShowRatingModal(false);
//                 fetchReviews();
//               }}
//             />
//           )}

//           {/* Decline Modal */}
//           {showDeclineModal && selectedReview && (
//             <DeclineModal
//               review={selectedReview}
//               onClose={() => setShowDeclineModal(false)}
//               onSuccess={() => {
//                 setShowDeclineModal(false);
//                 fetchReviews();
//               }}
//             />
//           )}
//         </main>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // STAT CARD
// // ==============================================================================

// function StatCard({ label, value, color, icon: Icon, highlight }: any) {
//   return (
//     <div className={`flex items-center gap-3 rounded-xl p-4 ${color} ${highlight ? 'ring-2 ring-amber-400' : ''}`}>
//       <Icon className="h-8 w-8 opacity-80" />
//       <div>
//         <div className="text-2xl font-bold">{value}</div>
//         <div className="text-xs font-medium opacity-80">{label}</div>
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // REVIEW CARD
// // ==============================================================================

// function ReviewCard({
//   review,
//   onRate,
//   onDecline,
// }: {
//   review: PendingPeerReview;
//   onRate: () => void;
//   onDecline: () => void;
// }) {
//   const statusCfg = STATUS_CONFIG[review.status];
//   const StatusIcon = statusCfg.icon;
//   const dueDate = review.due_at ? new Date(review.due_at) : null;
//   const isOverdue = dueDate && dueDate < new Date() && review.status === 'PENDING';

//   return (
//     <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 transition hover:shadow-md ${
//       review.status === 'PENDING' ? 'ring-amber-200' : 'ring-gray-100'
//     }`}>
//       <div className="flex items-start justify-between gap-4">
//         <div className="flex flex-1 items-start gap-3">
//           <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
//             {review.employee_name
//               .split(' ')
//               .map((n) => n[0])
//               .join('')
//               .slice(0, 2)
//               .toUpperCase()}
//           </div>
//           <div className="flex-1">
//             <div className="flex flex-wrap items-center gap-2">
//               <h3 className="text-base font-semibold text-gray-900">
//                 {review.employee_name}
//               </h3>
//               <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.className}`}>
//                 <StatusIcon className="h-3 w-3" />
//                 {statusCfg.label}
//               </span>
//               {isOverdue && (
//                 <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
//                   <AlertCircle className="h-3 w-3" />
//                   Overdue
//                 </span>
//               )}
//             </div>
//             <p className="mt-0.5 text-xs text-gray-500">
//               {review.employee_id_display}
//               {review.employee_position && ` • ${review.employee_position}`}
//             </p>

//             {/* KRA */}
//             <div className="mt-3 rounded-lg bg-pink-50 p-3 ring-1 ring-pink-100">
//               <div className="flex items-center gap-1 text-xs font-semibold text-pink-700">
//                 <Star className="h-3 w-3 fill-current" />
//                 Rate this KRA:
//               </div>
//               <h4 className="mt-1 text-sm font-semibold text-gray-900">
//                 {review.kra_name}
//               </h4>
//               <p className="mt-0.5 text-xs text-gray-600 line-clamp-2">
//                 {review.kra_description}
//               </p>
//             </div>

//             {/* Meta */}
//             <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
//               <span>📅 {review.cycle_name}</span>
//               {dueDate && (
//                 <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
//                   Due: {dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
//                 </span>
//               )}
//               {review.submitted_at && (
//                 <span>✓ Submitted on {new Date(review.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
//               )}
//               {review.status === 'SUBMITTED' && review.rating && (
//                 <span className="rounded-full bg-primary-50 px-2 py-0.5 font-medium text-primary-700">
//                   Your rating: {review.rating}/5
//                 </span>
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Actions */}
//         {review.status === 'PENDING' && (
//           <div className="flex flex-col gap-2">
//             <button
//               onClick={onRate}
//               className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-medium text-white hover:bg-primary-700"
//             >
//               <Star className="h-3.5 w-3.5" />
//               Rate Now
//             </button>
//             <button
//               onClick={onDecline}
//               className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
//             >
//               Decline
//             </button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// // ==============================================================================
// // RATING MODAL
// // ==============================================================================

// function RatingModal({
//   review,
//   onClose,
//   onSuccess,
// }: {
//   review: PendingPeerReview;
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const [rating, setRating] = useState<number>(0);
//   const [strengths, setStrengths] = useState('');
//   const [improvements, setImprovements] = useState('');
//   const [additional, setAdditional] = useState('');
//   const [submitting, setSubmitting] = useState(false);

//   const handleSubmit = async () => {
//     if (rating < 1 || rating > 5) {
//       toast.error('Please select a rating (1-5)');
//       return;
//     }
//     setSubmitting(true);
//     try {
//       await peerRatingsApi.submit(review.id, {
//         rating,
//         strengths_comment: strengths.trim(),
//         improvements_comment: improvements.trim(),
//         additional_comments: additional.trim(),
//       });
//       toast.success('Peer rating submitted. Thank you!');
//       onSuccess();
//     } catch (err: any) {
//       toast.error(err?.response?.data?.detail || 'Submission failed');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
//         <div className="flex items-center justify-between border-b border-gray-100 p-5">
//           <div className="flex items-center gap-2">
//             <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-100">
//               <Star className="h-4 w-4 text-pink-600 fill-current" />
//             </div>
//             <div>
//               <h3 className="text-base font-semibold text-gray-900">
//                 Rate: {review.employee_name}
//               </h3>
//               <p className="text-xs text-gray-500">{review.kra_name}</p>
//             </div>
//           </div>
//           <button onClick={onClose} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100">
//             <X className="h-4 w-4" />
//           </button>
//         </div>

//         <div className="flex-1 overflow-y-auto p-5 space-y-4">
//           {/* Rating (1-5 stars) */}
//           <div>
//             <label className="mb-2 block text-sm font-medium text-gray-700">
//               Your Rating <span className="text-red-500">*</span>
//             </label>
//             <div className="flex items-center gap-2">
//               {[1, 2, 3, 4, 5].map((n) => (
//                 <button
//                   key={n}
//                   type="button"
//                   onClick={() => setRating(n)}
//                   className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 text-lg font-bold transition ${
//                     rating >= n
//                       ? 'border-pink-500 bg-pink-500 text-white'
//                       : 'border-gray-200 bg-white text-gray-400 hover:border-pink-300'
//                   }`}
//                 >
//                   {n}
//                 </button>
//               ))}
//               {rating > 0 && (
//                 <span className="ml-2 text-sm font-medium text-gray-700">
//                   {rating === 5 ? 'Outstanding' :
//                    rating === 4 ? 'Exceeds' :
//                    rating === 3 ? 'Meets' :
//                    rating === 2 ? 'Needs Improvement' : 'Unsatisfactory'}
//                 </span>
//               )}
//             </div>
//           </div>

//           {/* Confidentiality warning */}
//           <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
//             <MessageSquare className="mb-1 inline h-3.5 w-3.5" />
//             <span className="ml-1 font-medium">Your comments are confidential.</span>
//             {' '}Only HR and the reporting manager will see them — the employee will
//             only see the aggregated numeric score.
//           </div>

//           {/* Strengths */}
//           <div>
//             <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//               Strengths (optional)
//             </label>
//             <textarea
//               value={strengths}
//               onChange={(e) => setStrengths(e.target.value)}
//               rows={2}
//               className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//               placeholder="What does this person do well in this area?"
//             />
//           </div>

//           {/* Improvements */}
//           <div>
//             <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//               Areas for Improvement (optional)
//             </label>
//             <textarea
//               value={improvements}
//               onChange={(e) => setImprovements(e.target.value)}
//               rows={2}
//               className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//               placeholder="What could this person improve?"
//             />
//           </div>

//           {/* Additional */}
//           <div>
//             <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//               Additional Comments (optional)
//             </label>
//             <textarea
//               value={additional}
//               onChange={(e) => setAdditional(e.target.value)}
//               rows={2}
//               className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
//               placeholder="Any other feedback?"
//             />
//           </div>
//         </div>

//         <div className="flex justify-end gap-2 border-t border-gray-100 p-4">
//           <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
//             Cancel
//           </button>
//           <button
//             onClick={handleSubmit}
//             disabled={submitting || rating < 1}
//             className="flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700 disabled:opacity-50"
//           >
//             {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
//             Submit Rating
//           </button>
//         </div>
//       </div>
//       <div className="absolute inset-0 -z-10" onClick={onClose} />
//     </div>
//   );
// }

// // ==============================================================================
// // DECLINE MODAL
// // ==============================================================================

// function DeclineModal({
//   review,
//   onClose,
//   onSuccess,
// }: {
//   review: PendingPeerReview;
//   onClose: () => void;
//   onSuccess: () => void;
// }) {
//   const [reason, setReason] = useState('');
//   const [submitting, setSubmitting] = useState(false);

//   const handleDecline = async () => {
//     if (reason.trim().length < 5) {
//       toast.error('Please provide a reason (min 5 characters)');
//       return;
//     }
//     setSubmitting(true);
//     try {
//       await peerRatingsApi.decline(review.id, { decline_reason: reason.trim() });
//       toast.success('Declined');
//       onSuccess();
//     } catch (err: any) {
//       toast.error(err?.response?.data?.detail || 'Failed');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
//       <div className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
//         <div className="p-6">
//           <div className="mb-4 flex items-center gap-2">
//             <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
//               <XCircle className="h-5 w-5 text-red-600" />
//             </div>
//             <h3 className="text-base font-semibold text-gray-900">Decline Peer Review</h3>
//           </div>
//           <p className="mb-4 text-sm text-gray-600">
//             You can decline if you feel you don't have enough interaction with{' '}
//             <strong>{review.employee_name}</strong> to provide meaningful feedback on this KRA.
//           </p>
//           <div className="mb-4">
//             <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
//               Reason <span className="text-red-500">*</span>
//             </label>
//             <textarea
//               value={reason}
//               onChange={(e) => setReason(e.target.value)}
//               rows={3}
//               className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
//               placeholder="e.g. I haven't worked closely with this person on this area..."
//             />
//           </div>
//           <div className="flex justify-end gap-2">
//             <button onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
//               Cancel
//             </button>
//             <button
//               onClick={handleDecline}
//               disabled={submitting || reason.trim().length < 5}
//               className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
//             >
//               {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
//               Confirm Decline
//             </button>
//           </div>
//         </div>
//       </div>
//       <div className="absolute inset-0 -z-10" onClick={onClose} />
//     </div>
//   );
// }


import { useEffect, useState } from 'react';
import { Users2, Loader2, CheckCircle2, Star, Send, XCircle } from 'lucide-react';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import { peerRatingsApi } from '../../api/performance';
import toast from 'react-hot-toast';

export default function MyPeerReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const data = await peerRatingsApi.myPendingReviews();
      setReviews(data);
    } catch {
      toast.error('Failed to load peer reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleSubmitRating = async () => {
    if (!selectedReview) return;
    setSubmitting(true);
    try {
      await peerRatingsApi.submit(selectedReview.id, {
        rating: ratingScore,
        strengths_comment: comments,
      });
      toast.success('Peer review submitted successfully');
      setSelectedReview(null);
      setComments('');
      fetchReviews();
    } catch {
      toast.error('Failed to submit peer review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center gap-3">
            <Users2 className="h-6 w-6 text-pink-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pending Peer Reviews</h1>
              <p className="text-sm text-gray-500">Provide constructive feedback for colleagues who nominated you</p>
            </div>
          </div>

          {loading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-pink-600" />
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm border">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h3 className="mt-4 text-base font-bold text-gray-900">All Caught Up!</h3>
              <p className="text-sm text-gray-500">You have no pending peer reviews at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {reviews.map((rev) => (
                <div key={rev.id} className="rounded-2xl bg-white p-5 shadow-sm border space-y-3">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{rev.target_employee_name}</h3>
                      <p className="text-xs text-gray-500">{rev.target_employee_id}</p>
                    </div>
                    <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700">
                      {rev.financial_year}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">KRA Name</span>
                    <p className="font-bold text-indigo-600">{rev.kra_name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{rev.kra_description}</p>
                  </div>

                  <button
                    onClick={() => setSelectedReview(rev)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-pink-600 py-2.5 text-xs font-bold text-white hover:bg-pink-700"
                  >
                    <Star className="h-4 w-4" /> Submit Peer Feedback
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Peer Feedback Modal */}
          {selectedReview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                <h3 className="font-bold text-gray-900">
                  Rating for {selectedReview.target_employee_name}
                </h3>
                <p className="text-xs text-gray-500">KRA: {selectedReview.kra_name}</p>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Rating (1 to 5 Stars)</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRatingScore(star)}
                        className={`h-10 w-10 rounded-xl font-bold border ${
                          ratingScore >= star ? 'bg-pink-600 text-white border-pink-600' : 'bg-gray-50 text-gray-400'
                        }`}
                      >
                        {star} ★
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  placeholder="Constructive feedback / comments..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full rounded-xl border p-3 text-xs"
                  rows={3}
                />

                <div className="flex justify-end gap-2">
                  <button onClick={() => setSelectedReview(null)} className="px-4 py-2 border rounded-xl text-xs">
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitRating}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-bold rounded-xl text-xs"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit Feedback
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}