import React from 'react';
import { FileText, ScanFace, Receipt, Scale, Folder, Search, Filter, Trash2, Eye, Download, ChevronRight, ArrowLeft, Upload, File, CheckCircle, X } from 'lucide-react';

export default function DocumentsTab({
  activeTab, t, language, today, bookings, properties, documents,
  leaseStageFilter, setLeaseStageFilter, activeFolder, setActiveFolder,
  searchQuery, setSearchQuery, openModal, handleDocDownload, handleDocPreview,
  handleDocDelete, formatDate, computeLeaseStage, uploadedDocs = {}
}) {
const todayDate = today;

          // --- Real counts derived from the rest of the dashboard's state -------------------
          // Lease agreements: one per booking that has progressed past 'draft'.
          const leaseAgreements = bookings.filter(b => computeLeaseStage(b, todayDate) !== 'draft');
          // Tenant IDs: assume one NID file per booking with tenantInit (proxy for "tenant on file").
          const tenantIdCount = bookings.filter(b => b.tenantInit).length;
          // Payment receipts: count of paid ledger entries across all bookings (matches the cross-system bridge).
          const paymentReceipts = bookings.reduce((sum, b) => sum + Object.values(b.ledger || {}).filter(e => e?.paid).length, 0);
          // Property photos: 12 photos per property (placeholder ratio until a real media table exists).
          const propertyPhotoCount = properties.length * 12;
          // Legal docs (NOC, ownership): 1 per property by convention.
          const legalCount = properties.length;
          // Inspection reports: 1 move-in + 1 move-out per booking that has ever been active.
          const inspectionCount = bookings.filter(b => ['active','notice','done'].includes(computeLeaseStage(b, todayDate))).length * 2;

          const docCount = (fid) => documents.filter(d => d.folder === fid).length;
          const folders = [
            { id: 'agreements', icon: FileText, tint: 'blue',    grad: 'from-blue-500 to-indigo-600',   count: docCount('agreements'), en: 'Rental Agreements', bn: 'রেন্টাল এগ্রিমেন্ট', desc: language === 'বাংলা' ? 'লিজ চুক্তিপত্র'  : 'Signed leases' },
            { id: 'nids',       icon: ScanFace, tint: 'emerald', grad: 'from-emerald-500 to-green-600', count: docCount('nids'),       en: 'Tenant NID / IDs',  bn: 'ভাড়াটিয়া NID / আইডি', desc: language === 'বাংলা' ? 'ভাড়াটিয়ার আইডি' : 'Tenant IDs' },
            { id: 'payments',   icon: Receipt,  tint: 'amber',   grad: 'from-amber-500 to-orange-500',  count: docCount('payments'),   en: 'Payment Records',   bn: 'পেমেন্ট রেকর্ড',       desc: language === 'বাংলা' ? 'রিসিপ্ট ও রেকর্ড' : 'Receipts & records' },
            { id: 'legal',      icon: Scale,    tint: 'rose',    grad: 'from-rose-500 to-red-600',      count: docCount('legal'),      en: 'Legal Documents',   bn: 'লিগ্যাল ডকুমেন্টস',     desc: language === 'বাংলা' ? 'NOC, দলিল'     : 'NOC, deeds' },
          ];

          const totalDocs = folders.reduce((s, f) => s + f.count, 0);

          // Filter: reuse rentPriorityFilter as a generic UI mode so navigation feels continuous,
          // but we map filter IDs onto folder IDs for clarity here.
          const docFilter = leaseStageFilter; // piggyback the existing filter state so we don't add new state
          const visibleFolders = folders.filter(f => {
            if (docFilter === 'all') return true;
            if (docFilter === 'active' && f.id === 'agreements') return true;
            if (docFilter === 'notice' && f.id === 'payments') return true;
            if (docFilter === 'draft'  && f.id === 'nids') return true;
            if (docFilter === 'done'   && (f.id === 'legal' || f.id === 'inspections')) return true;
            if (docFilter === 'all') return true;
            return docFilter === 'all';
          }).filter(f => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (f.en + ' ' + f.bn).toLowerCase().includes(q);
          });

          // File list for the active folder — REAL uploaded documents.
          const buildFileList = (folder) => {
            if (!folder) return [];
            const typeLabel = (m) => (String(m || '').startsWith('image/') ? 'Image' : (String(m || '').includes('pdf') ? 'PDF' : 'Document'));
            return documents
              .filter(d => d.folder === folder.id)
              .map(d => ({
                id:   d.id || d._id,
                name: d.fileName,
                meta: `${d.tenantName ? d.tenantName + ' • ' : ''}${typeLabel(d.fileType)}`,
                date: d.createdAt,
                doc:  d,
              }));
          };

          const fileList = buildFileList(activeFolder).filter(f => {
            if (!searchQuery.trim()) return true;
            return f.name.toLowerCase().includes(searchQuery.toLowerCase());
          });

          const tintMap = {
            blue:    { bg: 'bg-blue-50',     text: 'text-blue-600',     border: 'border-blue-200',     ring: 'ring-blue-200' },
            emerald: { bg: 'bg-emerald-50',  text: 'text-emerald-600',  border: 'border-emerald-200',  ring: 'ring-emerald-200' },
            amber:   { bg: 'bg-amber-50',    text: 'text-amber-600',    border: 'border-amber-200',    ring: 'ring-amber-200' },
            violet:  { bg: 'bg-violet-50',   text: 'text-violet-600',   border: 'border-violet-200',   ring: 'ring-violet-200' },
            rose:    { bg: 'bg-rose-50',     text: 'text-rose-600',     border: 'border-rose-200',     ring: 'ring-rose-200' },
            teal:    { bg: 'bg-teal-50',     text: 'text-teal-600',     border: 'border-teal-200',     ring: 'ring-teal-200' },
          };

          const docPill = (id, lbl, count) => (
            <button
              type="button"
              onClick={() => setLeaseStageFilter(id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all ${
                docFilter === id
                  ? 'bg-gray-900 text-white border-gray-900 shadow-[0_4px_12px_rgba(0,0,0,0.18)]'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {lbl}
              <span className={`text-[9px] px-1.5 py-px rounded-full tabular-nums ${docFilter === id ? 'bg-white/15' : 'bg-gray-100'}`}>{count}</span>
            </button>
          );

          return (
            <div className="w-full animate-in fade-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-6 items-start">

                {/* ─── LEFT RAIL — dark hero (always visible) ─── */}
                <aside className="xl:col-span-4 w-full flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">

                  <div className="relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6 text-white shadow-[0_20px_45px_rgba(15,23,42,0.35)]"
                       style={{background: 'linear-gradient(135deg,#0f172a 0%,#1e3a8a 60%,#312e81 100%)'}}>
                    <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-blue-500/30 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex items-start justify-between gap-3 mb-5">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">
                          {language === 'বাংলা' ? 'ভল্ট' : 'Vault'}
                        </p>
                        <h3 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                          {language === 'বাংলা' ? 'ডকুমেন্ট ভল্ট' : 'Document Vault'}
                        </h3>
                        <p className="text-[10px] font-bold text-blue-200/80 mt-1">
                          {language === 'বাংলা' ? 'সব ভাড়ার ডকুমেন্ট এক সুরক্ষিত জায়গায়' : 'Everything in one secure place'}
                        </p>
                      </div>
                      <button
                        onClick={() => openModal('upload_document')}
                        className="shrink-0 inline-flex items-center gap-1.5 bg-white text-gray-900 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all active:scale-95"
                      >
                        <Upload size={12}/> {language === 'বাংলা' ? 'আপলোড' : 'Upload'}
                      </button>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-2.5">
                      <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-200 mb-1">
                          {language === 'বাংলা' ? 'মোট ফাইল' : 'Total Files'}
                        </p>
                        <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{totalDocs}</p>
                        <p className="text-[9px] font-bold text-blue-200 mt-1">
                          {language === 'বাংলা' ? `${folders.length} ফোল্ডার` : `${folders.length} folders`}
                        </p>
                      </div>
                      <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-200 mb-1">
                          {language === 'বাংলা' ? 'এগ্রিমেন্ট' : 'Agreements'}
                        </p>
                        <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{leaseAgreements.length}</p>
                        <p className="text-[9px] font-bold text-blue-200 mt-1">
                          {language === 'বাংলা' ? 'স্বাক্ষরিত' : 'signed'}
                        </p>
                      </div>
                      <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-200 mb-1">
                          {language === 'বাংলা' ? 'রিসিপ্ট' : 'Receipts'}
                        </p>
                        <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{paymentReceipts}</p>
                        <p className="text-[9px] font-bold text-blue-200 mt-1">
                          {language === 'বাংলা' ? 'পেমেন্ট' : 'payments'}
                        </p>
                      </div>
                      <div className="bg-white/10 backdrop-blur rounded-2xl p-3 border border-white/10">
                        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-200 mb-1">
                          {language === 'বাংলা' ? 'প্রপার্টি' : 'Properties'}
                        </p>
                        <p className="text-[15px] sm:text-base font-black tabular-nums leading-tight">{properties.length}</p>
                        <p className="text-[9px] font-bold text-blue-200 mt-1">
                          {language === 'বাংলা' ? 'মালিকানা' : 'on file'}
                        </p>
                      </div>
                    </div>

                    {/* Quick verification card */}
                    <div className="relative z-10 mt-4 pt-4 border-t border-white/10">
                      <p className="text-[8px] font-black uppercase tracking-[0.16em] text-blue-200 mb-2">
                        {language === 'বাংলা' ? 'আপনার ভেরিফিকেশন' : 'Your Verification'}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] font-black tabular-nums">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${uploadedDocs.nidFront ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-white/5 text-gray-400 border-white/15'}`}>
                          {uploadedDocs.nidFront ? <CheckCircle size={9}/> : <X size={9}/>} NID-F
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${uploadedDocs.nidBack ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-white/5 text-gray-400 border-white/15'}`}>
                          {uploadedDocs.nidBack ? <CheckCircle size={9}/> : <X size={9}/>} NID-B
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${uploadedDocs.selfie ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-white/5 text-gray-400 border-white/15'}`}>
                          {uploadedDocs.selfie ? <CheckCircle size={9}/> : <X size={9}/>} {language === 'বাংলা' ? 'সেলফি' : 'Selfie'}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border ${uploadedDocs.utilityBill ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' : 'bg-white/5 text-gray-400 border-white/15'}`}>
                          {uploadedDocs.utilityBill ? <CheckCircle size={9}/> : <X size={9}/>} {language === 'বাংলা' ? 'বিল' : 'Bill'}
                        </span>
                      </div>
                    </div>
                  </div>
                </aside>

                {/* ─── RIGHT PANE — sticky toolbar + folder grid OR file list ─── */}
                <main className="xl:col-span-8 w-full flex flex-col xl:h-[calc(100vh-160px)] xl:overflow-y-auto xl:pr-2 custom-scrollbar bg-white rounded-[1.75rem] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100">

                  {/* Sticky toolbar inside scroll container */}
                  <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-100 px-3 sm:px-4 py-2.5 rounded-t-[1.75rem]">
                    <div className="flex flex-wrap items-center gap-2">
                      {activeFolder ? (
                        <button
                          type="button"
                          onClick={() => setActiveFolder(null)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 text-white text-[10px] font-black uppercase tracking-widest transition-colors active:scale-95"
                        >
                          <ArrowLeft size={11}/>{language === 'বাংলা' ? 'ফোল্ডার' : 'Folders'}
                        </button>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">
                          <Folder size={11}/>{language === 'বাংলা' ? 'ভল্ট' : 'Vault'}
                        </span>
                      )}

                      {activeFolder && (
                        <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-black text-gray-900">
                          <activeFolder.icon size={12} className={tintMap[activeFolder.tint]?.text || 'text-gray-500'}/>
                          {language === 'বাংলা' ? activeFolder.bn : activeFolder.en}
                        </span>
                      )}

                      <div className="flex-1 min-w-[120px] relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={activeFolder ? (language === 'বাংলা' ? 'ফাইল খুঁজুন...' : 'Search files...') : (language === 'বাংলা' ? 'ফোল্ডার খুঁজুন...' : 'Search folders...')}
                          className="w-full pl-7 pr-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-[11px] font-bold text-gray-700 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-blue-300 transition-colors"
                        />
                      </div>

                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-[10px] font-black tabular-nums">
                        {activeFolder ? fileList.length : visibleFolders.length}<span className="text-gray-400">/{activeFolder ? buildFileList(activeFolder).length : folders.length}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => openModal('upload_document')}
                        className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#ba0036] hover:bg-[#90002a] text-white text-[10px] font-black uppercase tracking-widest shadow-sm transition-colors active:scale-95"
                      >
                        <Upload size={11}/>{language === 'বাংলা' ? 'আপলোড' : 'Upload'}
                      </button>
                    </div>

                    {!activeFolder && (
                      <div className="flex items-center gap-1.5 mt-2 overflow-x-auto -mx-1 px-1 pb-0.5 no-scrollbar">
                        {docPill('all',    language === 'বাংলা' ? 'সব'           : 'All',          folders.length)}
                        {docPill('active', language === 'বাংলা' ? 'এগ্রিমেন্ট'   : 'Agreements',   1)}
                        {docPill('draft',  language === 'বাংলা' ? 'আইডি'         : 'IDs',          1)}
                        {docPill('notice', language === 'বাংলা' ? 'পেমেন্ট'      : 'Payments',     1)}
                        {docPill('done',   language === 'বাংলা' ? 'লিগ্যাল'      : 'Legal',        2)}
                      </div>
                    )}
                  </div>

                  {/* Body: folder grid OR file list */}
                  <div className="flex-1 px-3 sm:px-4 py-3">
                    {!activeFolder ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                        {visibleFolders.length === 0 ? (
                          <div className="col-span-full text-center py-12">
                            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Folder className="text-gray-300" size={22}/>
                            </div>
                            <h3 className="text-sm font-black text-gray-900">
                              {language === 'বাংলা' ? 'কোনো ফোল্ডার নেই' : 'No folders match'}
                            </h3>
                          </div>
                        ) : (
                          visibleFolders.map((folder) => {
                            const tint = tintMap[folder.tint];
                            return (
                              <button
                                key={folder.id}
                                type="button"
                                onClick={() => setActiveFolder(folder)}
                                className="group relative rounded-2xl border border-gray-100 hover:border-gray-200 bg-white hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all overflow-hidden text-left p-3 sm:p-4 active:scale-[0.98]"
                              >
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-50 group-hover:opacity-80 transition-opacity ${tint.bg}`}/>

                                <div className={`relative z-10 w-10 h-10 rounded-xl bg-gradient-to-br ${folder.grad} flex items-center justify-center text-white shadow-[0_8px_20px_rgba(15,23,42,0.12)] mb-2.5`}>
                                  <folder.icon size={18} strokeWidth={2.5}/>
                                </div>

                                <p className="relative z-10 text-[11px] sm:text-[12px] font-black text-gray-900 mb-0.5 leading-tight">
                                  {language === 'বাংলা' ? folder.bn : folder.en}
                                </p>
                                <p className="relative z-10 text-[9px] font-bold text-gray-400 tabular-nums mb-0.5">
                                  {folder.count} {language === 'বাংলা' ? 'ফাইল' : 'files'}
                                </p>
                                <p className="relative z-10 text-[9px] font-medium text-gray-400 truncate">
                                  {folder.desc}
                                </p>

                                <div className="relative z-10 mt-2.5 flex items-center justify-between">
                                  <span className={`inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ${tint.text}`}>
                                    <span className={`w-1 h-1 rounded-full ${tint.text.replace('text-', 'bg-')}`}/>
                                    {language === 'বাংলা' ? 'দেখুন' : 'Open'}
                                  </span>
                                  <ChevronRight size={12} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all"/>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {fileList.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                              <File className="text-gray-300" size={22}/>
                            </div>
                            <h3 className="text-sm font-black text-gray-900">
                              {language === 'বাংলা' ? 'এই ফোল্ডারে কোনো ফাইল নেই' : 'No files in this folder yet'}
                            </h3>
                            <p className="text-[10px] font-bold text-gray-400 mt-1 max-w-xs mx-auto">
                              {language === 'বাংলা' ? 'বুকিং বা পেমেন্ট তৈরি করলে এখানে আসবে।' : 'Create a booking or record a payment and files will appear here.'}
                            </p>
                          </div>
                        ) : (
                          fileList.map((file) => {
                            const tint = tintMap[activeFolder.tint];
                            return (
                              <div
                                key={file.id}
                                className="group flex items-center gap-2.5 sm:gap-3 px-3 sm:px-3.5 py-2.5 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition-all"
                              >
                                <div className={`shrink-0 w-9 h-9 rounded-xl ${tint.bg} ${tint.text} flex items-center justify-center`}>
                                  <File size={16}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-black text-gray-900 truncate group-hover:text-[#ba0036] cursor-pointer transition-colors" onClick={() => handleDocPreview(file.doc)}>
                                    {file.name}
                                  </p>
                                  <p className="text-[9px] font-bold text-gray-400 mt-0.5 truncate">{file.meta}</p>
                                </div>
                                <div className="hidden sm:block shrink-0 text-[9px] font-bold text-gray-400 tabular-nums text-right min-w-[64px]">
                                  {formatDate(file.date)}
                                </div>
                                <div className="shrink-0 flex items-center gap-0.5">
                                  <button onClick={() => handleDocPreview(file.doc)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors active:scale-95" title="Preview"><Eye size={14}/></button>
                                  <button onClick={() => handleDocDownload(file.doc)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors active:scale-95" title="Download"><Download size={14}/></button>
                                  <button onClick={() => handleDocDelete(file.doc)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors active:scale-95" title="Delete"><Trash2 size={14}/></button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                </main>
              </div>
            </div>
            );
}
