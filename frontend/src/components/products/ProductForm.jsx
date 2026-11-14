import React, { useState, useEffect } from 'react';
import { categoryService, productService, aiService } from '../../services/api';
import { Sparkles, Check, X, AlertCircle, Wand2, RefreshCw } from 'lucide-react';

export const ProductForm = ({ initialData = null, isEdit = false, onNavigate }) => {
  const [categories, setCategories] = useState([]);
  const [selectedCategoryObj, setSelectedCategoryObj] = useState(null);

  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    category: initialData?.category?._id || initialData?.category || '',
    subCategory: initialData?.subCategory || '',
    listingType: initialData?.listingType || 'sell',
    price: initialData?.price !== undefined ? initialData.price : '',
    condition: initialData?.condition || 'good',
    campusLocation: initialData?.campusLocation || 'Mirpur Cantonment Campus',
    exchangePreferences: initialData?.exchangePreferences || '',
    tags: initialData?.tags?.join(', ') || '',
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AI Assistant States
  const [aiGeneratingDesc, setAiGeneratingDesc] = useState(false);
  const [aiDescError, setAiDescError] = useState('');
  const [aiGeneratedDesc, setAiGeneratedDesc] = useState('');
  const [aiKeyNotes, setAiKeyNotes] = useState('');
  const [showAiNotes, setShowAiNotes] = useState(false);
  const [aiSuggestingCat, setAiSuggestingCat] = useState(false);
  const [aiCatError, setAiCatError] = useState('');
  const [aiCatSuggestion, setAiCatSuggestion] = useState(null);

  // AI Price Estimation States (Phase 13D)
  const [aiEstimatingPrice, setAiEstimatingPrice] = useState(false);
  const [aiPriceError, setAiPriceError] = useState('');
  const [aiPriceEstimate, setAiPriceEstimate] = useState(null);

  // AI Image Classification States (Phase 13D)
  const [aiClassifyingImage, setAiClassifyingImage] = useState(false);
  const [aiImageError, setAiImageError] = useState('');
  const [aiImageClassification, setAiImageClassification] = useState(null);

  const handleGenerateDescription = async () => {
    if (!formData.title || formData.title.trim().length < 3) {
      setAiDescError('Please enter a product title (at least 3 characters) first.');
      return;
    }

    setAiGeneratingDesc(true);
    setAiDescError('');
    try {
      const res = await aiService.generateDescription({
        title: formData.title,
        condition: formData.condition,
        listingType: formData.listingType,
        categoryName: selectedCategoryObj?.name || '',
        keyFeatures: aiKeyNotes,
        exchangePreferences: formData.exchangePreferences,
      });

      if (res?.success && res.data?.description) {
        setAiGeneratedDesc(res.data.description);
      } else {
        setAiDescError(res?.message || 'Could not generate description.');
      }
    } catch (err) {
      setAiDescError(err.message || 'Failed to generate description with AI.');
    } finally {
      setAiGeneratingDesc(false);
    }
  };

  const handleApplyDescription = () => {
    if (!aiGeneratedDesc) return;
    setFormData((prev) => ({ ...prev, description: aiGeneratedDesc }));
    setAiGeneratedDesc('');
  };

  const handleSuggestCategory = async () => {
    if (!formData.title || formData.title.trim().length < 3) {
      setAiCatError('Please enter a product title (at least 3 characters) first.');
      return;
    }

    setAiSuggestingCat(true);
    setAiCatError('');
    try {
      const res = await aiService.suggestCategory({
        title: formData.title,
        description: formData.description,
      });

      if (res?.success && res.data?.categoryId) {
        setAiCatSuggestion(res.data);
      } else if (res?.data?.reason) {
        setAiCatError(res.data.reason);
      } else {
        setAiCatError('No matching category found for this item.');
      }
    } catch (err) {
      setAiCatError(err.message || 'Failed to suggest category with AI.');
    } finally {
      setAiSuggestingCat(false);
    }
  };

  const handleApplyCategory = (catId) => {
    const targetId = catId || aiCatSuggestion?.categoryId;
    if (!targetId) return;
    setFormData((prev) => ({ ...prev, category: targetId, subCategory: '' }));
    const found = categories.find((c) => String(c._id) === String(targetId));
    setSelectedCategoryObj(found || null);
    setAiCatSuggestion(null);
    if (aiImageClassification) {
      setAiImageClassification(null);
    }
  };

  const handleEstimatePrice = async () => {
    if (!formData.title || formData.title.trim().length < 3) {
      setAiPriceError('Please enter a product title (at least 3 characters) first.');
      return;
    }
    if (!formData.category) {
      setAiPriceError('Please select a category first so we can analyze campus comparables.');
      return;
    }

    setAiEstimatingPrice(true);
    setAiPriceError('');
    try {
      const res = await aiService.estimatePrice({
        title: formData.title,
        categoryId: formData.category,
        condition: formData.condition,
        listingType: formData.listingType,
        description: formData.description,
      });

      if (res?.success && res.data) {
        setAiPriceEstimate(res.data);
      } else {
        setAiPriceError(res?.message || 'Could not estimate price.');
      }
    } catch (err) {
      setAiPriceError(err.message || 'Failed to estimate price with AI.');
    } finally {
      setAiEstimatingPrice(false);
    }
  };

  const handleApplyPrice = (price) => {
    setFormData((prev) => ({ ...prev, price: String(price) }));
  };

  const handleClassifyImage = async (fileToClassify) => {
    const file = fileToClassify || (selectedFiles.length > 0 ? selectedFiles[0] : null);
    if (!file) {
      setAiImageError('Please select or upload a product photo first to classify.');
      return;
    }

    setAiClassifyingImage(true);
    setAiImageError('');
    try {
      const data = new FormData();
      data.append('image', file);

      const res = await aiService.classifyProductImage(data);
      if (res?.success && res.data) {
        setAiImageClassification(res.data);
      } else {
        setAiImageError(res?.message || 'Could not classify photo.');
      }
    } catch (err) {
      setAiImageError(err.message || 'Failed to classify product image with AI.');
    } finally {
      setAiClassifyingImage(false);
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await categoryService.getCategories();
        if (res?.success) {
          setCategories(res.data || []);
          if (!formData.category && res.data.length > 0) {
            setFormData((prev) => ({ ...prev, category: res.data[0]._id }));
            setSelectedCategoryObj(res.data[0]);
          } else if (formData.category) {
            const found = res.data.find((c) => c._id === formData.category);
            setSelectedCategoryObj(found || null);
          }
        }
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    };
    fetchCats();
  }, []);

  const handleCategoryChange = (e) => {
    const catId = e.target.value;
    setFormData({ ...formData, category: catId, subCategory: '' });
    const found = categories.find((c) => c._id === catId);
    setSelectedCategoryObj(found || null);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedFiles.length > 5) {
      setError('You can upload a maximum of 5 images per product.');
      return;
    }
    setError('');
    setSelectedFiles((prev) => [...prev, ...files]);

    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemovePreview = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Dynamic price validation
    if (formData.listingType === 'sell' && (!formData.price || Number(formData.price) <= 0)) {
      setError('Please provide a valid price greater than zero for items listed for sale.');
      setLoading(false);
      return;
    }

    const postData = new FormData();
    postData.append('title', formData.title);
    postData.append('description', formData.description);
    postData.append('category', formData.category);
    postData.append('subCategory', formData.subCategory);
    postData.append('listingType', formData.listingType);
    postData.append('price', formData.listingType === 'giveaway' ? 0 : formData.price);
    postData.append('condition', formData.condition);
    postData.append('campusLocation', formData.campusLocation);
    postData.append('exchangePreferences', formData.exchangePreferences);
    postData.append('tags', formData.tags);

    selectedFiles.forEach((file) => {
      postData.append('images', file);
    });

    try {
      if (isEdit) {
        await productService.updateProduct(initialData._id, postData);
      } else {
        await productService.createProduct(postData);
      }
      onNavigate('browse-products');
    } catch (err) {
      setError(err.message || 'Failed to submit listing.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-3xl w-full mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          {isEdit ? 'Edit Product Listing' : 'List an Item for Students'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Provide accurate details to reach campus buyers quickly
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Item Title *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Casio fx-991EX ClassWiz Scientific Calculator"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Listing Type & Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Listing Type *
            </label>
            <select
              value={formData.listingType}
              onChange={(e) => setFormData({ ...formData, listingType: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="sell">Direct Sale</option>
              <option value="exchange">Barter / Exchange</option>
              <option value="giveaway">Free Giveaway</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Condition *
            </label>
            <select
              value={formData.condition}
              onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="new">Brand New (Unopened)</option>
              <option value="like-new">Like New (Barely used)</option>
              <option value="good">Good (Normal wear)</option>
              <option value="fair">Fair (Usable with marks)</option>
            </select>
          </div>
        </div>

        {/* Price & Exchange fields based on listingType */}
        {formData.listingType === 'sell' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Asking Price (BDT) *
              </label>
              <button
                type="button"
                onClick={handleEstimatePrice}
                disabled={aiEstimatingPrice || !formData.title || formData.title.trim().length < 3}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Get an AI estimate based on campus comparables and item condition"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiEstimatingPrice ? 'animate-spin text-emerald-600' : ''}`} />
                <span>{aiEstimatingPrice ? 'Estimating...' : 'Estimate Price with AI'}</span>
              </button>
            </div>
            <input
              type="number"
              required
              min="1"
              placeholder="500"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />

            {/* AI Price Estimate Card */}
            {aiPriceEstimate && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 animate-fadeIn text-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      AI Valuation Recommendation
                    </span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-extrabold text-emerald-900">
                        ৳ {aiPriceEstimate.suggestedPrice}
                      </span>
                      {aiPriceEstimate.minimumSuggestedPrice !== undefined &&
                        aiPriceEstimate.maximumSuggestedPrice !== undefined && (
                          <span className="text-xs text-emerald-700 font-medium">
                            (Suggested Range: ৳ {aiPriceEstimate.minimumSuggestedPrice} – ৳ {aiPriceEstimate.maximumSuggestedPrice})
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 capitalize">
                      {aiPriceEstimate.confidence} Confidence
                    </span>
                    <button
                      type="button"
                      onClick={() => setAiPriceEstimate(null)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[10px] text-emerald-800">
                  <span className="bg-white/80 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                    Method: {aiPriceEstimate.estimationMethod === 'historical_comparables' ? 'Historical Comparables' : 'Category Benchmark Fallback'}
                  </span>
                  {aiPriceEstimate.comparablesCount > 0 && (
                    <span className="bg-white/80 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold">
                      {aiPriceEstimate.comparablesCount} campus comparables evaluated
                    </span>
                  )}
                </div>

                {aiPriceEstimate.reasoning && (
                  <p className="text-[11px] text-emerald-900 leading-relaxed bg-white/70 p-2.5 rounded-xl border border-emerald-100">
                    {aiPriceEstimate.reasoning}
                  </p>
                )}

                {Array.isArray(aiPriceEstimate.warnings) && aiPriceEstimate.warnings.length > 0 && (
                  <ul className="text-[10px] text-emerald-700 list-disc list-inside space-y-0.5">
                    {aiPriceEstimate.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => handleApplyPrice(aiPriceEstimate.suggestedPrice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply ৳{aiPriceEstimate.suggestedPrice} to Listing
                  </button>
                  <span className="text-[10px] text-slate-500">
                    Price is advisory; you can edit anytime.
                  </span>
                </div>
              </div>
            )}

            {/* AI Price Error Alert */}
            {aiPriceError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
                <span>{aiPriceError}</span>
                <button type="button" onClick={() => setAiPriceError('')} className="text-rose-500 hover:text-rose-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {formData.listingType === 'exchange' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Exchange Preference / What do you want in return?
            </label>
            <input
              type="text"
              placeholder="e.g. Looking for Data Structures textbook or Drawing board"
              value={formData.exchangePreferences}
              onChange={(e) => setFormData({ ...formData, exchangePreferences: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {formData.listingType === 'giveaway' && (
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs text-purple-800">
            🎁 This item is marked as a <strong>Free Student Giveaway</strong>. Price is set to 0 BDT.
          </div>
        )}

        {/* Category & Subcategory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Category *
              </label>
              <button
                type="button"
                onClick={handleSuggestCategory}
                disabled={aiSuggestingCat || !formData.title || formData.title.trim().length < 3}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                title="Suggest the best matching category using AI"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiSuggestingCat ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{aiSuggestingCat ? 'Analyzing...' : 'Suggest with AI'}</span>
              </button>
            </div>
            <select
              value={formData.category}
              onChange={handleCategoryChange}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* AI Category Suggestion Pill */}
            {aiCatSuggestion && (
              <div className="mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Suggested: <strong>{aiCatSuggestion.categoryName}</strong>
                    {aiCatSuggestion.confidence > 0 && (
                      <span className="text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full font-bold ml-1">
                        {Math.round(aiCatSuggestion.confidence * 100)}% Match
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiCatSuggestion(null)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {aiCatSuggestion.reason && (
                  <p className="text-[11px] text-indigo-700 leading-tight">{aiCatSuggestion.reason}</p>
                )}
                {formData.category !== aiCatSuggestion.categoryId && (
                  <button
                    type="button"
                    onClick={() => handleApplyCategory(aiCatSuggestion.categoryId)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] transition cursor-pointer shadow-xs"
                  >
                    <Check className="w-3 h-3" />
                    Select {aiCatSuggestion.categoryName}
                  </button>
                )}
              </div>
            )}

            {/* AI Category Error Alert */}
            {aiCatError && (
              <div className="mt-2 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
                <span>{aiCatError}</span>
                <button type="button" onClick={() => setAiCatError('')} className="text-rose-500 hover:text-rose-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
              Subcategory
            </label>
            {selectedCategoryObj && selectedCategoryObj.subcategories?.length > 0 ? (
              <select
                value={formData.subCategory}
                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="">Select Subcategory</option>
                {selectedCategoryObj.subcategories.map((sub, i) => (
                  <option key={i} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Optional subcategory"
                value={formData.subCategory}
                onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
        </div>

        {/* Campus Handover Location */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Campus Meetup / Handover Spot *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. BUP Central Cafeteria, FST Ground Floor, Main Gate"
            value={formData.campusLocation}
            onChange={(e) => setFormData({ ...formData, campusLocation: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Description & AI Generator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Detailed Description *
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAiNotes(!showAiNotes)}
                className="text-[11px] text-slate-500 hover:text-slate-800 transition"
              >
                {showAiNotes ? 'Hide Notes' : '+ Add Key Notes for AI'}
              </button>
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={aiGeneratingDesc || !formData.title || formData.title.trim().length < 3}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Generate a clear, factual description based on your title and condition"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiGeneratingDesc ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{aiGeneratingDesc ? 'Generating...' : 'Generate with AI'}</span>
              </button>
            </div>
          </div>

          {/* Optional Key Notes for AI input */}
          {showAiNotes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 animate-fadeIn">
              <label className="block text-[11px] font-semibold text-slate-600">
                Key Features / Specific Details to include (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g., 9th edition, includes original box, bought in 2025"
                value={aiKeyNotes}
                onChange={(e) => setAiKeyNotes(e.target.value)}
                maxLength={500}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* AI-Generated Description Preview Box */}
          {aiGeneratedDesc && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  AI Suggested Description (Preview):
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded-full">
                  Not published until submitted
                </span>
              </div>
              <p className="text-xs text-slate-800 bg-white p-3 rounded-lg border border-emerald-100 leading-relaxed italic">
                "{aiGeneratedDesc}"
              </p>
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyDescription}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer shadow-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Apply to Description
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiGeneratedDesc('')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-medium text-xs transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Discard
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateDescription}
                  disabled={aiGeneratingDesc}
                  className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${aiGeneratingDesc ? 'animate-spin' : ''}`} />
                  Regenerate
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                You can review, edit, or adjust the description after applying before creating the listing.
              </p>
            </div>
          )}

          {/* AI Description Error */}
          {aiDescError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{aiDescError}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiDescError('')}
                className="text-rose-500 hover:text-rose-700 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          <textarea
            rows="4"
            required
            placeholder="Mention purchase year, condition specifics, edition (for books), included accessories..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          ></textarea>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
            Tags (comma separated)
          </label>
          <input
            type="text"
            placeholder="calculator, casio, engineering, bice"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Image Upload Area */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
              Product Photos (Up to 5 images, max 5MB each)
            </label>
            {selectedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => handleClassifyImage(selectedFiles[0])}
                disabled={aiClassifyingImage}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition cursor-pointer disabled:opacity-40"
                title="Classify photo with AI to detect product type and matching category"
              >
                <Sparkles className={`w-3.5 h-3.5 ${aiClassifyingImage ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{aiClassifyingImage ? 'Analyzing Photo...' : 'Suggest Category from Photo'}</span>
              </button>
            )}
          </div>
          <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-indigo-400 transition bg-slate-50">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileChange}
              className="hidden"
              id="product-image-upload"
            />
            <label htmlFor="product-image-upload" className="cursor-pointer block">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                Click to browse photo files
              </span>
              <p className="text-[11px] text-slate-400 mt-1">JPEG, PNG, WEBP, or GIF</p>
            </label>
          </div>

          {/* AI Image Classification Card */}
          {aiImageClassification && (
            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3 animate-fadeIn text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    AI Visual Analysis & Category Recommendation
                  </span>
                  <div className="mt-1">
                    <span className="text-base font-extrabold text-indigo-950">
                      {aiImageClassification.visibleProductType}
                    </span>
                    <span className="ml-2 text-xs text-indigo-700 font-semibold">
                      &rarr; Suggested Category: <strong>{aiImageClassification.suggestedCategoryName}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-200 text-indigo-900">
                    {Math.round(aiImageClassification.confidence * 100)}% Match
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiImageClassification(null)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {aiImageClassification.observableAttributes?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {aiImageClassification.observableAttributes.map((attr, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-white border border-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md font-medium"
                    >
                      ✓ {attr}
                    </span>
                  ))}
                  {aiImageClassification.suggestedBrand && (
                    <span className="text-[10px] bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md font-bold">
                      Brand: {aiImageClassification.suggestedBrand}
                    </span>
                  )}
                </div>
              )}

              {aiImageClassification.warnings?.length > 0 && (
                <ul className="text-[10px] text-indigo-600 list-disc list-inside">
                  {aiImageClassification.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              )}

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => handleApplyCategory(aiImageClassification.suggestedCategoryId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  Select {aiImageClassification.suggestedCategoryName}
                </button>
                <span className="text-[10px] text-slate-500">
                  Visual classification does not verify item authenticity or internal defects.
                </span>
              </div>
            </div>
          )}

          {/* AI Image Error Alert */}
          {aiImageError && (
            <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
              <span>{aiImageError}</span>
              <button type="button" onClick={() => setAiImageError('')} className="text-rose-500 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Previews */}
          {previews.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {previews.map((src, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                  <img src={src} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePreview(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-rose-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer hover:bg-rose-700"
                  >
                    &times;
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-[9px] text-center font-bold py-0.5">
                      Thumbnail
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => onNavigate('browse-products')}
            className="py-2.5 px-5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Submitting...' : isEdit ? 'Save Changes' : 'Publish Listing'}
          </button>
        </div>
      </form>
    </div>
  );
};
