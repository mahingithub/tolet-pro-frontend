import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Star, Send, CheckCircle2, Loader2, Lock, Trash2, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { reviewService } from '../../services/reviewService';

// Interactive 1–5 star picker for the submit form.
const StarPicker = ({ value, onChange }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <button
        key={s}
        type="button"
        onClick={() => onChange(s)}
        aria-label={`${s} star${s > 1 ? 's' : ''}`}
        className="transition-transform hover:scale-110 active:scale-95"
      >
        <Star size={26} className={s <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
      </button>
    ))}
  </div>
);

// Read-only star row for a listed review.
const StarsRow = ({ value }) => (
  <div className="flex gap-0.5 shrink-0">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={14} className={s <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'} />
    ))}
  </div>
);

/**
 * ProfileReviews — person-to-person reviews shown on a landlord/tenant profile.
 *
 * Props:
 *   • revieweeId   — the profile owner's user id
 *   • revieweeRole — 'landlord' | 'tenant' (which reputation this profile shows)
 *   • revieweeName — display name, used only in the form placeholder
 *
 * Rules (product-confirmed):
 *   • Reviews are visible to LOGGED-IN users only → anonymous visitors get a
 *     "log in" prompt instead of the list.
 *   • Any logged-in user may leave/edit exactly ONE review — no booking gate.
 *   • You can't review your own profile (form hidden; backend also blocks it).
 */
export default function ProfileReviews({ revieweeId, revieweeRole, revieweeName = 'this user' }) {
  const { user, isAuthenticated } = useAuth();
  const myId = user?.id || user?._id || null;
  const isOwnProfile = !!myId && String(myId) === String(revieweeId);
  const roleLabel = revieweeRole === 'landlord' ? 'landlord' : 'tenant';

  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ avg: 0, count: 0 });
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const load = useCallback(async () => {
    if (!isAuthenticated || !revieweeId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const data = await reviewService.getReviews(revieweeId, revieweeRole);
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setSummary(data.summary || { avg: 0, count: 0 });
      if (data.myReview) {
        setRating(data.myReview.rating || 5);
        setComment(data.myReview.comment || '');
      }
    } catch (e) {
      setError(e.serverMessage || 'Could not load reviews.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, revieweeId, revieweeRole]);

  useEffect(() => { load(); }, [load]);

  const myReview = reviews.find((r) => myId && String(r.reviewerId) === String(myId)) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await reviewService.submitReview({ revieweeId, revieweeRole, rating, comment });
      setReviews((prev) => {
        const others = prev.filter((r) => String(r.reviewerId) !== String(myId));
        return data.review ? [data.review, ...others] : others;
      });
      if (data.summary) setSummary(data.summary);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    } catch (e2) {
      setError(e2.serverMessage || 'Could not submit your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await reviewService.deleteReview(myReview.id);
      setReviews((prev) => prev.filter((r) => String(r.reviewerId) !== String(myId)));
      if (data.summary) setSummary(data.summary);
      setRating(5);
      setComment('');
    } catch (e2) {
      setError(e2.serverMessage || 'Could not delete your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const cardCls = 'bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 md:p-8';

  // ── Not logged in → gated prompt (reviews are login-only) ─────────────────
  if (!isAuthenticated) {
    return (
      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare size={18} className="text-[#ba0036]" />
          <h3 className="text-lg md:text-xl font-black text-gray-900">Reviews</h3>
        </div>
        <div className="text-center py-8">
          <Lock size={30} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-bold text-gray-600 mb-4">Log in to see reviews and leave one.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#ba0036] text-white text-sm font-black hover:bg-[#7c0026] transition-all active:scale-95"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cardCls}>
      {/* Header + aggregate */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-[#ba0036]" />
          <h3 className="text-lg md:text-xl font-black text-gray-900">Reviews</h3>
        </div>
        {summary.count > 0 && (
          <div className="flex items-center gap-2">
            <Star size={16} className="fill-yellow-400 text-yellow-400" />
            <span className="text-lg font-black text-gray-900">{summary.avg}</span>
            <span className="text-xs font-bold text-gray-400">({summary.count})</span>
          </div>
        )}
      </div>

      {/* Submit / edit form — hidden on your own profile */}
      {!isOwnProfile ? (
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-2xl bg-gray-50/80 border border-gray-100">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">
            {myReview ? 'Update your review' : `Rate this ${roleLabel}`}
          </p>
          <StarPicker value={rating} onChange={setRating} />
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder={`Share your experience with ${revieweeName}...`}
            className="mt-3 w-full p-3.5 rounded-xl text-sm font-bold text-gray-900 bg-white border border-gray-200 outline-none focus:border-[#ba0036]/40 resize-none transition-all"
          />
          {error && <p className="mt-2 text-xs font-bold text-[#ba0036]">{error}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#ba0036] text-white text-sm font-black hover:bg-[#7c0026] transition-all active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {myReview ? 'Update' : 'Submit'}
            </button>
            {myReview && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full text-gray-500 text-sm font-bold hover:text-[#ba0036] hover:bg-red-50 transition-all active:scale-95 disabled:opacity-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
            {justSaved && (
              <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-black">
                <CheckCircle2 size={14} /> Saved
              </span>
            )}
          </div>
        </form>
      ) : (
        <p className="mb-5 text-xs font-bold text-gray-400">
          This is how others have rated you as a {roleLabel}.
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-8">
          <Loader2 size={22} className="mx-auto animate-spin text-gray-300" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8">
          <Star size={30} className="mx-auto mb-2 text-gray-200" />
          <p className="text-sm font-bold text-gray-500">
            No reviews yet.{!isOwnProfile ? ' Be the first.' : ''}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => (
            <div key={r.id} className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
              <div className="flex items-start gap-3">
                <img
                  src={r.reviewerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.reviewerName || 'User')}&background=fce4ec&color=ba0036`}
                  alt={r.reviewerName || 'User'}
                  className="w-10 h-10 rounded-full shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                    <div>
                      <p className="font-black text-gray-900 text-sm">
                        {r.reviewerName || 'User'}
                        {myId && String(r.reviewerId) === String(myId) && (
                          <span className="ml-2 text-[10px] font-black text-[#ba0036]">You</span>
                        )}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : ''}
                      </p>
                    </div>
                    <StarsRow value={r.rating} />
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 font-medium leading-relaxed">{r.comment}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
