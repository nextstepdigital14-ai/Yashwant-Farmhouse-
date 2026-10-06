import React, { useState, useEffect } from 'react';
import {
  IndianRupee,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSiteData } from '../context/SiteContext';
import { safeFetch } from '../utils/api';

export default function AdminPrices() {
  const { token } = useAuth();
  const { prices: sitePrices, refreshData } = useSiteData();

  const [pricesList, setPricesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState(null);

  // Form state
  const [form, setForm] = useState({
    title: '',
    category: '',
    amount: '',
    unit: 'per night',
    description: '',
    badge: '',
    featuresText: '',
    active: true
  });

  const [toastMessage, setToastMessage] = useState('');

  // Fetch prices on load
  const fetchAllPrices = async () => {
    try {
      setLoading(true);
      const res = await safeFetch(`/api/prices?_t=${Date.now()}`);
      if (res.ok && res.data?.success && Array.isArray(res.data?.prices)) {
        setPricesList(res.data.prices);
      } else if (Array.isArray(sitePrices) && sitePrices.length > 0) {
        setPricesList(sitePrices);
      }
    } catch (err) {
      console.error(err);
      if (Array.isArray(sitePrices) && sitePrices.length > 0) setPricesList(sitePrices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllPrices();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const handleOpenAdd = () => {
    setEditingPrice(null);
    setForm({
      title: '',
      category: '',
      amount: '',
      unit: 'per night',
      description: '',
      badge: '',
      featuresText: 'Entire Private Farmhouse & Grounds\nFull Swimming Pool Access\nCooking Facility & Kitchen\nUp to 10 Guests',
      active: true
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (price) => {
    setEditingPrice(price);
    setForm({
      title: price.title || '',
      category: price.category || '',
      amount: price.amount || '',
      unit: price.unit || 'per night',
      description: price.description || '',
      badge: price.badge || '',
      featuresText: (price.features || []).join('\n'),
      active: price.active !== false
    });
    setModalOpen(true);
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    setLoading(true);

    const featuresArray = form.featuresText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      title: form.title,
      category: form.category,
      amount: Number(form.amount),
      unit: form.unit,
      description: form.description,
      badge: form.badge,
      features: featuresArray,
      active: form.active
    };

    try {
      const url = editingPrice ? `/api/prices/${editingPrice._id}` : '/api/prices';
      const method = editingPrice ? 'PUT' : 'POST';

      const res = await safeFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok || !res.data?.success) {
        throw new Error(res.error || res.data?.message || 'Failed to save price');
      }

      await fetchAllPrices();
      await refreshData();
      setModalOpen(false);
      showToast(editingPrice ? 'Price updated successfully!' : 'New price category added!');
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await safeFetch(`/api/prices/${id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok && res.data?.success) {
        await fetchAllPrices();
        await refreshData();
        showToast(res.data.message);
      } else {
        alert(res.error || 'Failed to toggle price');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeletePrice = async (id) => {
    if (!window.confirm('Are you sure you want to delete this price category?')) return;

    try {
      const res = await safeFetch(`/api/prices/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok && res.data?.success) {
        await fetchAllPrices();
        await refreshData();
        showToast('Price category deleted.');
      } else {
        alert(res.error || 'Failed to delete price');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#163624]">
            Prices & Rates
          </h1>
          <p className="text-sm text-[#6B726D] mt-1">
            Manage weekday, weekend, day outing and seasonal pricing rates.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#163624] hover:bg-[#102419] text-white font-semibold text-xs sm:text-sm uppercase tracking-wider transition-all shadow self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-[#C69A52]" />
          <span>Add Price Category</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-3 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Prices Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pricesList.map((tier) => (
          <div
            key={tier._id}
            className={`rounded-3xl p-6 sm:p-7 border card-shadow flex flex-col justify-between transition-all ${
              tier.active
                ? 'bg-white border-[#E5DFD7]'
                : 'bg-gray-50 border-gray-200 opacity-60'
            }`}
          >
            <div>
              {/* Category & Status */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#C69A52]">
                  {tier.category}
                </span>

                <button
                  onClick={() => handleToggleActive(tier._id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                    tier.active
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-gray-100 text-gray-600 border-gray-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${tier.active ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                  <span>{tier.active ? 'Active' : 'Inactive'}</span>
                </button>
              </div>

              {/* Title & Badge */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-serif text-2xl font-bold text-[#163624]">
                  {tier.title}
                </h3>
                {tier.badge && (
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#C69A52]/40 text-[#C69A52] text-[10px] font-bold uppercase">
                    {tier.badge}
                  </span>
                )}
              </div>

              {/* Amount */}
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="font-serif text-3xl font-bold text-[#163624]">
                  {formatCurrency(tier.amount)}
                </span>
                <span className="text-xs text-[#6B726D]">
                  / {tier.unit || 'night'}
                </span>
              </div>

              <p className="text-xs text-[#6B726D] mb-4 line-clamp-2">
                {tier.description}
              </p>

              {/* Inclusions summary */}
              {tier.features && tier.features.length > 0 && (
                <div className="space-y-1.5 pt-3 border-t border-[#F3EFE9] text-xs text-[#4D433A]">
                  {tier.features.slice(0, 3).map((feat, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[#1F4A32] font-bold">✓</span>
                      <span className="line-clamp-1">{feat}</span>
                    </div>
                  ))}
                  {tier.features.length > 3 && (
                    <span className="text-[10px] text-[#796E64] italic">
                      + {tier.features.length - 3} more items included
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-6 mt-4 border-t border-[#F3EFE9] flex items-center justify-between gap-2">
              <button
                onClick={() => handleOpenEdit(tier)}
                className="flex-1 py-2 px-3 rounded-xl bg-[#FAF8F5] hover:bg-[#E7EFEA] text-[#163624] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 border border-[#E5DFD7]"
              >
                <Edit2 className="w-3.5 h-3.5 text-[#C69A52]" />
                <span>Edit Price</span>
              </button>

              <button
                onClick={() => handleDeletePrice(tier._id)}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                title="Delete price tier"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* Modal for Add / Edit Price */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 card-shadow border border-[#E5DFD7] my-8 animate-fade-in">
            
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-[#E5DFD7]">
              <h3 className="font-serif text-2xl font-bold text-[#163624]">
                {editingPrice ? 'Edit Price Tier' : 'Add Price Category'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-full text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrice} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                  Title * (e.g. Weekday Stay)
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Weekday Stay"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-sm text-[#222B24]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                  Category * (e.g. Monday - Thursday)
                </label>
                <input
                  type="text"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Monday - Thursday"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-sm text-[#222B24]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="8500"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-sm text-[#222B24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                    Unit (e.g. per night)
                  </label>
                  <input
                    type="text"
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="per night"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-sm text-[#222B24]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                  Badge (Optional, e.g. Most Popular)
                </label>
                <input
                  type="text"
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="e.g. Most Popular"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-sm text-[#222B24]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="A peaceful getaway for family and friends..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-sm text-[#222B24]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#796E64] mb-1">
                  Features Included (One item per line)
                </label>
                <textarea
                  rows="4"
                  value={form.featuresText}
                  onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
                  placeholder="Entire Private Farmhouse\nSwimming Pool Access\nEquipped Kitchen"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5DFD7] text-xs text-[#222B24] resize-none font-mono"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="price-active"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 text-[#163624] rounded"
                />
                <label htmlFor="price-active" className="text-xs font-semibold text-[#163624]">
                  Active (Visible on public website)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 rounded-full border border-[#E5DFD7] text-xs font-semibold text-[#796E64] hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="px-7 py-2.5 rounded-full bg-[#163624] hover:bg-[#102419] text-white text-xs uppercase tracking-wider font-semibold shadow"
                >
                  {loading ? 'Saving...' : 'Save Price'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
