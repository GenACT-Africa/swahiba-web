// Enhanced Resources.jsx - Save this as your new Resources.jsx file
// Key enhancements:
// ✅ Video content support (YouTube, Vimeo, direct links)
// ✅ Advanced filtering (type, language, tags)
// ✅ Clickable tags for filtering
// ✅ Share functionality (Twitter, Facebook, WhatsApp, Copy link)
// ✅ Auto-suggest search
// ✅ Related resources
// ✅ Better UX with content type indicators

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../context/LanguageContext.jsx";

const TOPIC_TO_CATEGORY = {
  contraception: "SRHR", sti_hiv: "SRHR", pregnancy: "SRHR", emergency_contraception: "SRHR",
  consent: "Safety", safety: "Safety", gbv: "GBV", mental_health: "Mental", mh: "Mental",
};

const RESOURCE_TYPE_ICONS = { article: "📝", video: "🎥", infographic: "📊" };

function splitParagraphs(text) {
  const raw = (text || "").trim();
  if (!raw) return [];
  return raw.split(/\n\s*\n+/g).map((p) => p.trim()).filter(Boolean);
}

function makeSummary(content, max = 150) {
  const first = splitParagraphs(content)[0] || "";
  const s = first.replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max - 1).trim() + "…";
}

function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

function extractVimeoId(url) {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

const i18n = {
  sw: {
    pageTitle: "Rasilimali", pageSubtitle: "Majibu ya haraka ya SRHR unayoweza kuamini — salama, rahisi na rafiki kwa vijana.",
    backHome: "Rudi Nyumbani", disclaimerTitle: "Kumbuka",
    disclaimerText: "Swahiba si huduma ya dharura. Kama upo hatarini sasa hivi, tafuta msaada wa dharura.",
    searchPh: "Tafuta rasilimali…", filterAll: "Zote", filterSRHR: "SRHR", filterSafety: "Usalama",
    filterGBV: "GBV", filterMental: "Afya ya akili", filterByLang: "Chuja kwa Lugha", filterByType: "Chuja kwa Aina",
    allLanguages: "Lugha Zote", allTypes: "Aina Zote", loading: "Inapakia…", empty: "Hakuna rasilimali.",
    noResults: "Hakuna matokeo.", read: "Soma", watch: "Tazama", view: "Angalia", share: "Shiriki",
    copyLink: "Nakili Kiungo", linkCopied: "Kiungo kimenakiliwa!", talkBtn: "Nenda kuongea",
    navTalk: "Ongea na SWAHIBA", close: "Funga", tags: "Lebo", relatedResources: "Rasilimali Zinazohusiana", dash: "—",
  },
  en: {
    pageTitle: "Resources", pageSubtitle: "Quick SRHR guidance you can trust — safe, clear, youth-friendly.",
    backHome: "Back Home", disclaimerTitle: "Reminder",
    disclaimerText: "Swahiba is not an emergency service. If you're in immediate danger, seek emergency help.",
    searchPh: "Search resources…", filterAll: "All", filterSRHR: "SRHR", filterSafety: "Safety",
    filterGBV: "GBV", filterMental: "Mental health", filterByLang: "Filter by Language", filterByType: "Filter by Type",
    allLanguages: "All Languages", allTypes: "All Types", loading: "Loading…", empty: "No resources yet.",
    noResults: "No results found.", read: "Read", watch: "Watch", view: "View", share: "Share",
    copyLink: "Copy Link", linkCopied: "Link copied!", talkBtn: "Go to Talk",
    navTalk: "Talk to SWAHIBA", close: "Close", tags: "Tags", relatedResources: "Related Resources", dash: "—",
  },
};

export default function Resources() {
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const dbLang = lang === "SW" ? "sw" : "en";
  const t = useMemo(() => (dbLang === "sw" ? i18n.sw : i18n.en), [dbLang]);

  const [rawRows, setRawRows] = useState([]);
  const [loadingDb, setLoadingDb] = useState(true);
  const [dbErr, setDbErr] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [langFilter, setLangFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedTag, setSelectedTag] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [shareNotification, setShareNotification] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingDb(true);
      setDbErr("");
      try {
        const { data, error } = await supabase
          .from("resources")
          .select("id, title, topic, language, content, resource_type, video_url, thumbnail_url, tags, published, updated_at")
          .eq("published", true)
          .order("updated_at", { ascending: false });
        if (error) throw error;
        if (!alive) return;
        setRawRows(data ?? []);
      } catch (e) {
        if (!alive) return;
        setDbErr(e?.message || String(e));
      } finally {
        if (!alive) return;
        setLoadingDb(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const byTopic = useMemo(() => {
    const map = new Map();
    for (const r of rawRows || []) {
      const topic = (r.topic || "").trim();
      const lng = (r.language || "").trim().toLowerCase();
      if (!topic) continue;
      if (!map.has(topic)) map.set(topic, {});
      const bucket = map.get(topic);
      if (lng === "sw" || lng === "en") {
        if (!bucket[lng]) bucket[lng] = r;
      } else {
        if (!bucket.other) bucket.other = r;
      }
    }
    return map;
  }, [rawRows]);

  const resources = useMemo(() => {
    const list = [];
    for (const [topic, bucket] of byTopic.entries()) {
      const chosen = bucket[dbLang] || bucket.sw || bucket.en || bucket.other;
      if (!chosen) continue;
      const category = TOPIC_TO_CATEGORY[topic] || "SRHR";
      list.push({
        id: topic, topic, category,
        language: chosen.language || dbLang,
        title: chosen.title || topic,
        summary: makeSummary(chosen.content || ""),
        body: splitParagraphs(chosen.content || ""),
        resourceType: chosen.resource_type || "article",
        videoUrl: chosen.video_url || null,
        thumbnailUrl: chosen.thumbnail_url || null,
        tags: chosen.tags || [],
      });
    }
    const order = { SRHR: 1, Safety: 2, GBV: 3, Mental: 4 };
    list.sort((a, b) => {
      const diff = (order[a.category] || 9) - (order[b.category] || 9);
      return diff !== 0 ? diff : a.title.localeCompare(b.title);
    });
    return list;
  }, [byTopic, dbLang]);

  const allTags = useMemo(() => {
    const tagSet = new Set();
    resources.forEach(r => (r.tags || []).forEach(tag => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [resources]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      const matchesQuery = !q || r.title.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) ||
        r.topic.toLowerCase().includes(q) || (r.tags || []).some(tag => tag.toLowerCase().includes(q));
      const matchesFilter = filter === "All" || r.category === filter;
      const matchesLang = langFilter === "all" || r.language === langFilter;
      const matchesType = typeFilter === "all" || r.resourceType === typeFilter;
      const matchesTag = !selectedTag || (r.tags || []).includes(selectedTag);
      return matchesQuery && matchesFilter && matchesLang && matchesType && matchesTag;
    });
  }, [resources, query, filter, langFilter, typeFilter, selectedTag]);

  const suggestions = useMemo(() => {
    if (!query.trim() || !showSuggestions) return [];
    const q = query.trim().toLowerCase();
    const titleMatches = resources.filter(r => r.title.toLowerCase().includes(q)).slice(0, 3).map(r => ({ type: 'title', text: r.title, id: r.id }));
    const tagMatches = allTags.filter(tag => tag.toLowerCase().includes(q)).slice(0, 2).map(tag => ({ type: 'tag', text: tag }));
    return [...titleMatches, ...tagMatches];
  }, [query, showSuggestions, resources, allTags]);

  const openItem = resources.find((r) => r.id === openId) || null;

  const relatedResources = useMemo(() => {
    if (!openItem) return [];
    return resources.filter(r => r.category === openItem.category && r.id !== openItem.id).slice(0, 3);
  }, [openItem, resources]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpenId(null); };
    if (openId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const modalCloseBtnRef = useRef(null);
  useEffect(() => {
    if (openId) setTimeout(() => modalCloseBtnRef.current?.focus(), 0);
  }, [openId]);

  const handleShare = async (resource, platform) => {
    const url = `${window.location.origin}/resources?id=${resource.id}`;
    const text = `${resource.title} - ${t.pageTitle}`;
    if (platform === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setShareNotification(true);
        setTimeout(() => setShareNotification(false), 2000);
      } catch (err) { console.error('Failed to copy:', err); }
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
    } else if (platform === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <section className="mx-auto max-w-[1200px] px-4 py-12 sm:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>{t.pageTitle}</h1>
            <p className="mt-3 max-w-2xl text-slate-600">{t.pageSubtitle}</p>
          </div>
          <Link to="/" className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-600">{t.backHome}</Link>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div className="text-sm font-extrabold text-slate-900">{t.disclaimerTitle}</div>
          <div className="mt-1 text-sm leading-7 text-slate-600">{t.disclaimerText}</div>
        </div>

        {dbErr && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{dbErr}</div>}

        <div className="mt-10 relative">
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={t.searchPh}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-300"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-lg">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (s.type === 'title') { setOpenId(s.id); } else { setSelectedTag(s.text); setQuery(''); }
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50 first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <span className="mr-2">{s.type === 'title' ? '📄' : '🏷️'}</span>{s.text}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {["All", "SRHR", "Safety", "GBV", "Mental"].map(f => (
              <FilterPill key={f} active={filter === f} onClick={() => setFilter(f)}>
                {t[`filter${f}`]}
              </FilterPill>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700">{t.filterByLang}:</label>
              <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-300">
                <option value="all">{t.allLanguages}</option>
                <option value="sw">Swahili</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-slate-700">{t.filterByType}:</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-300">
                <option value="all">{t.allTypes}</option>
                <option value="article">📝 Articles</option>
                <option value="video">🎥 Videos</option>
                <option value="infographic">📊 Infographics</option>
              </select>
            </div>
          </div>

          {selectedTag && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">{t.tags}:</span>
              <button onClick={() => setSelectedTag(null)} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200">
                {selectedTag} <span>×</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {loadingDb ? (
            <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-7 text-sm text-slate-600">{t.loading}</div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-7 text-center text-sm text-slate-600">
              <p className="text-lg font-semibold">{query || selectedTag ? t.noResults : t.empty}</p>
              {(query || selectedTag) && (
                <button onClick={() => { setQuery(''); setSelectedTag(null); }} className="mt-3 text-amber-600 hover:text-amber-700 font-semibold">Clear filters</button>
              )}
            </div>
          ) : (
            filtered.map((r) => (
              <ResourceCard key={r.id} resource={r} onClick={() => setOpenId(r.id)} onTagClick={(tag) => setSelectedTag(tag === selectedTag ? null : tag)} t={t} />
            ))
          )}
        </div>

        <div className="mt-14 flex justify-center">
          <button type="button" onClick={() => navigate("/talk")} className="rounded-2xl bg-slate-900 px-7 py-3 text-sm font-semibold text-white hover:bg-slate-800">{t.talkBtn}</button>
        </div>
      </section>

      {openItem && (
        <ResourceModal resource={openItem} relatedResources={relatedResources} onClose={() => setOpenId(null)} onShare={handleShare}
          onTagClick={(tag) => { setSelectedTag(tag); setOpenId(null); }} onRelatedClick={setOpenId} closeBtnRef={modalCloseBtnRef} t={t} />
      )}

      {shareNotification && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg">✓ {t.linkCopied}</div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={["rounded-2xl border px-4 py-2 text-xs font-bold transition", active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"].join(" ")}>{children}</button>
  );
}

function ResourceCard({ resource, onClick, onTagClick, t }) {
  const typeIcon = RESOURCE_TYPE_ICONS[resource.resourceType] || "📝";
  const actionText = resource.resourceType === 'video' ? t.watch : resource.resourceType === 'article' ? t.read : t.view;
  return (
    <button type="button" onClick={onClick} className="group text-left rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md">
      {resource.thumbnailUrl && (
        <div className="mb-4 aspect-video w-full overflow-hidden rounded-2xl bg-slate-100">
          <img src={resource.thumbnailUrl} alt={resource.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{typeIcon}</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{resource.category}</span>
        </div>
        <span className="text-xs text-slate-500">{resource.language.toUpperCase()}</span>
      </div>
      <div className="text-base font-extrabold text-slate-900 line-clamp-2">{resource.title}</div>
      <div className="mt-3 text-sm leading-6 text-slate-600 line-clamp-2">{resource.summary || t.dash}</div>
      {resource.tags && resource.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {resource.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} onClick={(e) => { e.stopPropagation(); onTagClick(tag); }}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 cursor-pointer">{tag}</span>
          ))}
          {resource.tags.length > 3 && (
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">+{resource.tags.length - 3}</span>
          )}
        </div>
      )}
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-900">
        {actionText} <span className="transition group-hover:translate-x-0.5">→</span>
      </div>
    </button>
  );
}

function ResourceModal({ resource, relatedResources, onClose, onShare, onTagClick, onRelatedClick, closeBtnRef, t }) {
  const youtubeId = extractYouTubeId(resource.videoUrl);
  const vimeoId = extractVimeoId(resource.videoUrl);
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-3xl max-h-[90vh] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 rounded-t-3xl z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-2xl tracking-tight text-slate-900 font-bold" style={{ fontFamily: "ui-serif, Georgia, Cambria, serif" }}>{resource.title}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{RESOURCE_TYPE_ICONS[resource.resourceType]} {resource.resourceType}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{resource.category}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{resource.language.toUpperCase()}</span>
              </div>
            </div>
            <button ref={closeBtnRef} type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">{t.close}</button>
          </div>
        </div>

        <div className="p-6">
          {resource.resourceType === 'video' && resource.videoUrl && (
            <div className="mb-6">
              {youtubeId ? (
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-100">
                  <iframe src={`https://www.youtube.com/embed/${youtubeId}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" />
                </div>
              ) : vimeoId ? (
                <div className="aspect-video w-full overflow-hidden rounded-2xl bg-slate-100">
                  <iframe src={`https://player.vimeo.com/video/${vimeoId}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="h-full w-full" />
                </div>
              ) : (
                <video controls className="w-full rounded-2xl"><source src={resource.videoUrl} /></video>
              )}
            </div>
          )}

          {resource.tags && resource.tags.length > 0 && (
            <div className="mb-6">
              <div className="text-sm font-semibold text-slate-700 mb-2">{t.tags}</div>
              <div className="flex flex-wrap gap-2">
                {resource.tags.map((tag, idx) => (
                  <button key={idx} onClick={() => { onTagClick(tag); }} className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 hover:bg-amber-100">{tag}</button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {resource.body.length ? resource.body.map((p, idx) => (
              <p key={idx} className="text-sm leading-7 text-slate-700">{p}</p>
            )) : <p className="text-sm leading-7 text-slate-700">{t.dash}</p>}
          </div>

          {relatedResources.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <div className="text-lg font-bold text-slate-900 mb-4">{t.relatedResources}</div>
              <div className="grid gap-4 sm:grid-cols-3">
                {relatedResources.map(r => (
                  <button key={r.id} onClick={() => onRelatedClick(r.id)} className="text-left rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 transition">
                    <div className="text-xs font-semibold text-slate-500 mb-1">{RESOURCE_TYPE_ICONS[r.resourceType]} {r.resourceType}</div>
                    <div className="text-sm font-bold text-slate-900 line-clamp-2">{r.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="text-sm font-semibold text-slate-700 mb-3">{t.share}</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onShare(resource, 'twitter')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Twitter</button>
              <button onClick={() => onShare(resource, 'facebook')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Facebook</button>
              <button onClick={() => onShare(resource, 'whatsapp')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50">WhatsApp</button>
              <button onClick={() => onShare(resource, 'copy')} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">{t.copyLink}</button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => { onClose(); navigate("/talk"); }} className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-600">{t.navTalk}</button>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold hover:bg-slate-50">{t.close}</button>
          </div>
        </div>
      </div>
    </div>
  );
}