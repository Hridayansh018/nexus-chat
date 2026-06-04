/* ═══════════════════════════════════════════════════
   NexusPDF — Application Logic
   ═══════════════════════════════════════════════════ */

(function () {
    'use strict';

    // ── Configuration ─────────────────────────────
    const API_BASE = 'http://localhost:8000';

    // ── DOM References ────────────────────────────
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const els = {
        serverStatus: $('#serverStatus'),
        uploadSection: $('#uploadSection'),
        chatSection: $('#chatSection'),
        dropzone: $('#dropzone'),
        dropzoneContent: $('#dropzoneContent'),
        fileInput: $('#fileInput'),
        processingOverlay: $('#processingOverlay'),
        processingTitle: $('#processingTitle'),
        processingStatus: $('#processingStatus'),
        processingPercentage: $('#processingPercentage'),
        chatMessages: $('#chatMessages'),
        chatForm: $('#chatForm'),
        chatInput: $('#chatInput'),
        btnSend: $('#btnSend'),
        charCount: $('#charCount'),
        docName: $('#docName'),
        docMeta: $('#docMeta'),
        btnRemoveDoc: $('#btnRemoveDoc'),
    };

    // ── Application State ─────────────────────────
    const state = {
        currentFile: null,
        documentFilename: null,
        isUploading: false,
        isStreaming: false,
        abortController: null,
    };

    // ── Initialize ────────────────────────────────
    function init() {
        bindEvents();
        autoResizeTextarea();
    }

    // ── Event Bindings ────────────────────────────
    function bindEvents() {
        // Dropzone click → open file picker
        els.dropzone.addEventListener('click', (e) => {
            // Don't re-open if the click was on the Upload button or Change file link
            if (e.target.closest('.btn-upload-action') || e.target.closest('.btn-change-file')) return;
            if (state.isUploading) return;
            els.fileInput.click();
        });

        // File selected via input
        els.fileInput.addEventListener('change', () => {
            const file = els.fileInput.files[0];
            if (file) handleFileSelected(file);
        });

        // Drag and drop
        els.dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            els.dropzone.classList.add('drag-over');
        });

        els.dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            els.dropzone.classList.remove('drag-over');
        });

        els.dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            els.dropzone.classList.remove('drag-over');
            if (state.isUploading) return;
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelected(file);
        });

        // Prevent default form submission behavior globally for upload area
        els.dropzone.addEventListener('submit', (e) => e.preventDefault());

        // Chat form
        els.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleChatSubmit();
        });

        // Chat input
        els.chatInput.addEventListener('input', () => {
            els.charCount.textContent = els.chatInput.value.length;
            els.btnSend.disabled = els.chatInput.value.trim().length === 0 || state.isStreaming;
            autoResizeTextarea();
        });

        // Enter to send (Shift+Enter for newline)
        els.chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!els.btnSend.disabled) {
                    handleChatSubmit();
                }
            }
        });

        // Remove document
        els.btnRemoveDoc.addEventListener('click', handleRemoveDocument);

        // Suggestion chips
        $$('.chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                const q = chip.getAttribute('data-question');
                if (q && !state.isStreaming) {
                    els.chatInput.value = q;
                    els.charCount.textContent = q.length;
                    els.btnSend.disabled = false;
                    autoResizeTextarea();
                    handleChatSubmit();
                }
            });
        });
    }

    // ── File Selection ────────────────────────────
    function handleFileSelected(file) {
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            showToast('Only PDF files are supported.', 'error');
            resetFileInput();
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            showToast('File is too large. Maximum size is 50MB.', 'error');
            resetFileInput();
            return;
        }

        state.currentFile = file;

        // Show file selected state in dropzone
        els.dropzone.classList.add('file-selected');
        els.dropzoneContent.innerHTML = `
            <div class="file-selected-content">
                <div class="file-selected-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M6 2H14L20 8V22H6V2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        <path d="M14 2V8H20" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                    </svg>
                </div>
                <span class="file-selected-name">${escapeHtml(file.name)}</span>
                <span class="file-selected-size">${formatFileSize(file.size)}</span>
                <button type="button" class="btn-upload-action" id="btnStartUpload">Upload & Process</button>
                <button type="button" class="btn-change-file" id="btnChangeFile">Choose different file</button>
            </div>
        `;

        // Bind upload button
        $('#btnStartUpload').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startUpload();
        });

        // Bind change file button
        $('#btnChangeFile').addEventListener('click', (e) => {
            e.stopPropagation();
            resetDropzone();
            els.fileInput.click();
        });
    }

    // ── Upload ────────────────────────────────────
    async function startUpload() {
        if (!state.currentFile || state.isUploading) return;

        state.isUploading = true;
        showProcessing();

        const formData = new FormData();
        formData.append('file', state.currentFile);

        // Simulate progressive steps
        animateProcessingSteps();

        try {
            const res = await fetch(`${API_BASE}/upload-file/`, {
                method: 'POST',
                body: formData,
                // No Content-Type header — browser sets it with boundary for multipart
            });

            if (!res.ok) {
                let detail = 'Upload failed.';
                try {
                    const errData = await res.json();
                    detail = errData.detail || detail;
                } catch { /* ignore parse error */ }
                throw new Error(detail);
            }

            const data = await res.json();
            console.log('Upload response:', res.status, res.headers.get('content-type'));
            console.log('Upload successful:', data);

            // Mark all steps as done
            completeAllSteps();

            // Brief pause to let user see the completed state
            await delay(600);

            // Transition to chat
            state.documentFilename = data.filename;
            state.documentId = data.document_id;
            els.docName.textContent = data.filename;
            els.docMeta.textContent = `${data.pages} page${data.pages !== 1 ? 's' : ''} · ${data.chunks} chunk${data.chunks !== 1 ? 's' : ''}`;

            // Show chat section immediately (no need to verify)
            els.uploadSection.classList.add('hidden');
            els.chatSection.classList.remove('hidden');
            hideProcessing();

            showToast(`"${data.filename}" processed successfully!`, 'success');

            // Focus chat input
            els.chatInput.focus();

        } catch (err) {
            console.error('Upload error:', err);
            showToast(err.message || 'Failed to upload file. Please try again.', 'error');
            hideProcessing();
        } finally {
            state.isUploading = false;
        }
    }

    // ── Processing Animation ──────────────────────
    function showProcessing() {
        els.processingOverlay.classList.add('active');
        els.processingPercentage.textContent = '0%';
        els.processingTitle.textContent = 'Uploading Document...';
        els.processingStatus.textContent = 'Preparing your file for analysis';

        // Reset steps
        for (let i = 1; i <= 4; i++) {
            const step = $(`#step${i}`);
            const indicator = step.querySelector('.step-indicator');
            step.classList.remove('active', 'done');
            indicator.classList.remove('active', 'done');
        }

        // First step active
        const step1 = $('#step1');
        step1.classList.add('active');
        step1.querySelector('.step-indicator').classList.add('active');
    }

    function hideProcessing() {
        els.processingOverlay.classList.remove('active');
        resetDropzone();
    }

    function animateProcessingSteps() {
        const stepTimings = [
            { step: 1, pct: 15, delay: 0, title: 'Uploading Document...', status: 'Transferring your file to the server' },
            { step: 2, pct: 35, delay: 2000, title: 'Extracting Text...', status: 'Reading content from PDF pages' },
            { step: 2, pct: 50, delay: 4000, title: 'Extracting Text...', status: 'Processing document structure' },
            { step: 3, pct: 70, delay: 6000, title: 'Generating Embeddings...', status: 'Creating semantic representations' },
            { step: 4, pct: 90, delay: 9000, title: 'Building Vector Index...', status: 'Indexing for intelligent search' },
        ];

        stepTimings.forEach(({ step, pct, delay: d, title, status }) => {
            setTimeout(() => {
                if (!state.isUploading) return;

                els.processingPercentage.textContent = `${pct}%`;
                els.processingTitle.textContent = title;
                els.processingStatus.textContent = status;

                // Mark previous steps as done, current as active
                for (let i = 1; i <= 4; i++) {
                    const el = $(`#step${i}`);
                    const ind = el.querySelector('.step-indicator');
                    el.classList.remove('active', 'done');
                    ind.classList.remove('active', 'done');

                    if (i < step) {
                        el.classList.add('done');
                        ind.classList.add('done');
                    } else if (i === step) {
                        el.classList.add('active');
                        ind.classList.add('active');
                    }
                }
            }, d);
        });
    }

    function completeAllSteps() {
        els.processingPercentage.textContent = '100%';
        els.processingTitle.textContent = 'Processing Complete!';
        els.processingStatus.textContent = 'Your document is ready for questions';

        for (let i = 1; i <= 4; i++) {
            const el = $(`#step${i}`);
            const ind = el.querySelector('.step-indicator');
            el.classList.remove('active');
            el.classList.add('done');
            ind.classList.remove('active');
            ind.classList.add('done');
        }
    }

    // ── Chat ──────────────────────────────────────
    async function handleChatSubmit() {
        const question = els.chatInput.value.trim();
        if (!question || state.isStreaming) return;

        // Clear welcome message if present
        const welcome = els.chatMessages.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        // Render user message
        appendMessage('user', question);

        // Reset input
        els.chatInput.value = '';
        els.charCount.textContent = '0';
        els.btnSend.disabled = true;
        autoResizeTextarea();

        // Start streaming response
        state.isStreaming = true;
        els.btnSend.disabled = true;

        // Create assistant message container
        const { messageEl, bubbleEl } = appendAssistantPlaceholder();

        // Show thinking indicator
        bubbleEl.innerHTML = `
            <div class="thinking-bubble-inner">
                <div class="thinking-dots"><span></span><span></span><span></span></div>
                <span>Analyzing your question...</span>
            </div>
        `;

        let sourcesHtml = '';
        let answerText = '';

        try {
            state.abortController = new AbortController();

            const res = await fetch(`${API_BASE}/chat/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    document_id: state.documentId || '',
                    question: question,
                }),
                signal: state.abortController.signal,
            });

            if (!res.ok) {
                let detail = 'Failed to get response.';
                try {
                    const errData = await res.json();
                    detail = errData.detail || detail;
                } catch { /* ignore */ }
                throw new Error(detail);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // keep incomplete line in buffer

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    try {
                        const parsed = JSON.parse(trimmed);

                        if (parsed.type === 'sources') {
                            sourcesHtml = renderSources(parsed.sources);
                        } else if (parsed.type === 'text') {
                            answerText += parsed.content;
                            bubbleEl.innerHTML = formatAnswer(answerText) +
                                '<span class="streaming-indicator"><span></span><span></span><span></span></span>';
                        } else if (parsed.type === 'done') {
                            // Finalize
                            bubbleEl.innerHTML = formatAnswer(answerText);
                            if (sourcesHtml) {
                                const sourcesDiv = document.createElement('div');
                                sourcesDiv.innerHTML = sourcesHtml;
                                messageEl.querySelector('.message-body').appendChild(sourcesDiv);
                            }
                        }
                    } catch {
                        // Skip malformed JSON lines
                    }
                }
            }

            // Handle case where done event was not received
            if (answerText && !bubbleEl.querySelector('.sources-panel')) {
                bubbleEl.innerHTML = formatAnswer(answerText);
                if (sourcesHtml) {
                    const sourcesDiv = document.createElement('div');
                    sourcesDiv.innerHTML = sourcesHtml;
                    messageEl.querySelector('.message-body').appendChild(sourcesDiv);
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') {
                bubbleEl.innerHTML = '<em style="color: var(--text-muted);">Response cancelled.</em>';
            } else {
                bubbleEl.innerHTML = `<span style="color: var(--error);">⚠ ${escapeHtml(err.message)}</span>`;
            }
        } finally {
            state.isStreaming = false;
            state.abortController = null;
            els.btnSend.disabled = els.chatInput.value.trim().length === 0;
            scrollToBottom();
        }
    }

    function appendMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;

        const avatarLabel = role === 'user' ? 'U' : 'AI';

        div.innerHTML = `
            <div class="message-avatar">${avatarLabel}</div>
            <div class="message-body">
                <div class="message-bubble">${escapeHtml(text)}</div>
            </div>
        `;

        els.chatMessages.appendChild(div);
        scrollToBottom();
        return div;
    }

    function appendAssistantPlaceholder() {
        const div = document.createElement('div');
        div.className = 'message assistant';
        div.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-body">
                <div class="message-bubble"></div>
            </div>
        `;

        els.chatMessages.appendChild(div);
        scrollToBottom();

        return {
            messageEl: div,
            bubbleEl: div.querySelector('.message-bubble'),
        };
    }

    function renderSources(sources) {
        if (!sources || sources.length === 0) return '';

        let html = '<div class="sources-panel"><div class="sources-panel-title">📚 Sources Referenced</div>';

        sources.forEach((src) => {
            const pageStr = src.page != null ? `<span class="source-page">· Page ${src.page + 1}</span>` : '';
            html += `
                <div class="source-item">
                    <span class="source-badge">${src.index}</span>
                    ${escapeHtml(src.preview)}${pageStr}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    function formatAnswer(text) {
        // Basic formatting: convert markdown-style bold, newlines
        let html = escapeHtml(text);
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Citations like [1], [2]
        html = html.replace(/\[(\d+)\]/g, '<span class="source-badge" style="display:inline-flex; margin:0 2px;">$1</span>');
        // Newlines
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    // ── Remove Document ───────────────────────────
    async function handleRemoveDocument() {
        if (state.isStreaming) {
            showToast('Please wait for the current response to finish.', 'error');
            return;
        }

        // Try to delete from server
        if (state.documentId) {
            try {
                await fetch(`${API_BASE}/documents/${encodeURIComponent(state.documentId)}`, {
                    method: 'DELETE',
                });
            } catch {
                // Non-critical, continue
            }
        }

        // Reset state
        state.currentFile = null;
        state.documentFilename = null;
        state.documentId = null;
        resetFileInput();
        resetDropzone();

        // Clear chat
        els.chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="20" r="18" stroke="url(#welcomeGrad)" stroke-width="1.5" stroke-dasharray="4 3"/>
                        <path d="M14 20C14 16.6863 16.6863 14 20 14C23.3137 14 26 16.6863 26 20" stroke="url(#welcomeGrad)" stroke-width="1.5" stroke-linecap="round"/>
                        <circle cx="20" cy="24" r="2" fill="url(#welcomeGrad)"/>
                        <defs>
                            <linearGradient id="welcomeGrad" x1="0" y1="0" x2="40" y2="40">
                                <stop stop-color="#6366f1"/>
                                <stop offset="1" stop-color="#a855f7"/>
                            </linearGradient>
                        </defs>
                    </svg>
                </div>
                <h3>Ready to Explore Your Document</h3>
                <p>Ask any question about your uploaded PDF. I'll find the most relevant sections and provide accurate answers with source citations.</p>
                <div class="suggestion-chips">
                    <button class="chip" data-question="What is the main topic of this document?">📄 Main topic</button>
                    <button class="chip" data-question="Can you summarize the key points?">📋 Key points</button>
                    <button class="chip" data-question="What are the conclusions drawn in this document?">🎯 Conclusions</button>
                </div>
            </div>
        `;

        // Re-bind suggestion chips
        $$('.chip').forEach((chip) => {
            chip.addEventListener('click', () => {
                const q = chip.getAttribute('data-question');
                if (q && !state.isStreaming) {
                    els.chatInput.value = q;
                    els.charCount.textContent = q.length;
                    els.btnSend.disabled = false;
                    autoResizeTextarea();
                    handleChatSubmit();
                }
            });
        });

        // Show upload, hide chat
        els.chatSection.classList.add('hidden');
        els.uploadSection.classList.remove('hidden');
    }

    // ── Utilities ─────────────────────────────────
    function resetDropzone() {
        els.dropzone.classList.remove('file-selected');
        els.dropzoneContent.innerHTML = `
            <div class="dropzone-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <span class="dropzone-text">Choose PDF file or drag it here</span>
            <span class="dropzone-hint">Maximum file size: 50MB</span>
        `;
        state.currentFile = null;
    }

    function resetFileInput() {
        els.fileInput.value = '';
    }

    function autoResizeTextarea() {
        const ta = els.chatInput;
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 150) + 'px';
    }

    function scrollToBottom() {
        requestAnimationFrame(() => {
            els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
        });
    }

    function showToast(message, type = 'error') {
        // Remove any existing toasts
        document.querySelectorAll('.error-toast, .success-toast').forEach((t) => t.remove());

        const toast = document.createElement('div');
        toast.className = type === 'success' ? 'success-toast' : 'error-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        // Auto-remove after animation
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 4500);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function delay(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    // ── Boot ──────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
