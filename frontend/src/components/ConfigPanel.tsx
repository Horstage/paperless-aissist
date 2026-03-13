import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { configApi, documentsApi, schedulerApi } from '../api/client';
import { RefreshCw, CheckCircle, XCircle, Play, Square, Clock, Server, Brain, Settings, Tag } from 'lucide-react';

interface Configs {
  paperless_url: string;
  paperless_token: string;
  process_tag: string;
  processed_tag: string;
  tag_blacklist: string;
  force_ocr_tag: string;
  force_ocr_fix_tag: string;
  ocr_post_process: string;
  llm_provider: string;
  llm_model: string;
  llm_api_base: string;
  llm_api_key: string;
  enable_vision: string;
  enable_fallback_ocr: string;
  llm_model_vision: string;
  llm_provider_vision: string;
  llm_api_base_vision: string;
  llm_api_key_vision: string;
  llm_timeout: string;
  llm_timeout_vision: string;
  log_level: string;
  modular_tag_process: string;
  modular_tag_ocr: string;
  modular_tag_ocr_fix: string;
  modular_tag_title: string;
  modular_tag_correspondent: string;
  modular_tag_document_type: string;
  modular_tag_tags: string;
  modular_tag_fields: string;
  modular_processed_tag: string;
  auth_enabled: string;
}

interface PaperlessTag {
  id: number;
  name: string;
}

interface PaperlessItem {
  id: number;
  name: string;
}

export default function ConfigPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<Configs>({
    paperless_url: '',
    paperless_token: '',
    process_tag: '',
    processed_tag: '',
    tag_blacklist: '',
    force_ocr_tag: 'force_ocr',
    force_ocr_fix_tag: 'force-ocr-fix',
    ocr_post_process: 'true',
    llm_provider: 'ollama',
    llm_model: 'qwen2.5:7b',
    llm_api_base: 'http://localhost:11434',
    llm_api_key: '',
    enable_vision: 'false',
    enable_fallback_ocr: 'false',
    llm_provider_vision: 'ollama',
    llm_model_vision: 'qwen2.5vl:7b',
    llm_api_base_vision: 'http://localhost:11434',
    llm_api_key_vision: '',
    llm_timeout: '600',
    llm_timeout_vision: '600',
    log_level: 'INFO',
    modular_tag_process: '',
    modular_tag_ocr: '',
    modular_tag_ocr_fix: '',
    modular_tag_title: '',
    modular_tag_correspondent: '',
    modular_tag_document_type: '',
    modular_tag_tags: '',
    modular_tag_fields: '',
    modular_processed_tag: '',
    auth_enabled: 'false',
  });
  const [saving, setSaving] = useState(false);
  const [testingPaperless, setTestingPaperless] = useState(false);
  const [testingLlm, setTestingLlm] = useState(false);
  const [paperlessConnected, setPaperlessConnected] = useState(false);
  const [paperlessError, setPaperlessError] = useState<string | null>(null);
  const [availableTags, setAvailableTags] = useState<PaperlessTag[]>([]);
  const [availableCorrespondents, setAvailableCorrespondents] = useState<PaperlessItem[]>([]);
  const [llmResult, setLlmResult] = useState<{success: boolean; message: string} | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<{running: boolean; interval_minutes: number | null; next_run: string | null; is_processing: boolean; current_doc_id: number | null} | null>(null);
  const [schedulerInterval, setSchedulerInterval] = useState(5);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadSchedulerStatus();
  }, []);

  const loadConfigs = async () => {
    try {
      const res = await configApi.getAll();
      const loadedConfigs = res.data;
      setConfigs((prev) => ({ ...prev, ...loadedConfigs }));

      if (loadedConfigs.paperless_url && loadedConfigs.paperless_token) {
        handleTestPaperless();
      }
    } catch (error) {
      console.error('Failed to load configs:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    if (configs.auth_enabled === 'true' && !configs.paperless_url.trim()) {
      alert(t('config.authRequiresPaperless'));
      setSaving(false);
      return;
    }
    try {
      for (const [key, value] of Object.entries(configs)) {
        if (key === 'auth_enabled') continue;
        await configApi.set(key, value);
      }
      await configApi.set('auth_enabled', configs.auth_enabled);
      if (configs.auth_enabled === 'true') {
        navigate('/login');
        return;
      }
      alert(t('config.savedSuccess'));
    } catch (error) {
      console.error('Failed to save configs:', error);
      alert(t('config.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestPaperless = async () => {
    setTestingPaperless(true);
    setPaperlessError(null);
    setPaperlessConnected(false);
    try {
      const res = await documentsApi.getTags();
      setAvailableTags(res.data.tags || []);
      setAvailableCorrespondents(res.data.correspondents || []);
      setPaperlessConnected(true);
    } catch (error: any) {
      setPaperlessError(error.response?.data?.detail || error.message);
    } finally {
      setTestingPaperless(false);
    }
  };

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setLlmResult(null);
    try {
      const res = await fetch('/api/config/test-ollama', { method: 'POST' });
      const data = await res.json();

      let message = '';
      if (data.main) message += `Main: ${data.main.message}`;
      if (data.vision !== null && data.vision !== undefined) message += `\nVision: ${data.vision.message}`;

      setLlmResult({ success: data.success, message });
    } catch (error: any) {
      setLlmResult({ success: false, message: `Error: ${error.message}` });
    } finally {
      setTestingLlm(false);
    }
  };

  const loadSchedulerStatus = async () => {
    try {
      const res = await schedulerApi.getStatus();
      setSchedulerStatus(res.data);
      if (res.data.interval_minutes) {
        setSchedulerInterval(res.data.interval_minutes);
      }
    } catch (error) {
      console.error('Failed to load scheduler status:', error);
    }
  };

  const handleSchedulerStart = async () => {
    setSchedulerLoading(true);
    try {
      await schedulerApi.start(schedulerInterval);
      await loadSchedulerStatus();
    } catch (error) {
      console.error('Failed to start scheduler:', error);
      alert(t('config.schedulerStartFailed'));
    } finally {
      setSchedulerLoading(false);
    }
  };

  const handleSchedulerStop = async () => {
    setSchedulerLoading(true);
    try {
      await schedulerApi.stop();
      await loadSchedulerStatus();
    } catch (error) {
      console.error('Failed to stop scheduler:', error);
      alert(t('config.schedulerStopFailed'));
    } finally {
      setSchedulerLoading(false);
    }
  };

  const handleClearState = async () => {
    if (!window.confirm(t('config.clearStateConfirm'))) return;
    try {
      await schedulerApi.clearState();
      await loadSchedulerStatus();
      alert(t('config.clearStateSuccess'));
    } catch (error) {
      console.error('Failed to clear state:', error);
      alert(t('config.clearStateFailed'));
    }
  };

  const field = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const label = 'block text-sm font-medium text-gray-700 mb-1';
  const hint = 'text-xs text-gray-500 mt-1';

  const sectionHeader = (Icon: React.ElementType, titleKey: string) => (
    <div className="flex items-center gap-2 border-b pb-3 mb-4">
      <Icon size={18} className="text-blue-600" />
      <h2 className="text-lg font-semibold text-gray-800">{t(titleKey)}</h2>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <h1 className="text-2xl font-bold text-gray-900">{t('config.title')}</h1>
      </div>

      {/* Paperless-ngx */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        {sectionHeader(Server, 'config.paperlessSection')}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>{t('config.paperlessUrl')}</label>
            <input
              type="text"
              value={configs.paperless_url}
              onChange={(e) => setConfigs({ ...configs, paperless_url: e.target.value })}
              placeholder="http://localhost:8000"
              className={field}
            />
          </div>
          <div>
            <label className={label}>{t('config.apiToken')}</label>
            <input
              type="password"
              value={configs.paperless_token}
              onChange={(e) => setConfigs({ ...configs, paperless_token: e.target.value })}
              placeholder={t('config.apiTokenPlaceholder')}
              className={field}
            />
          </div>
        </div>

        <div>
          <button
            onClick={handleTestPaperless}
            disabled={testingPaperless}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {testingPaperless ? <RefreshCw size={16} className="animate-spin" /> : <Server size={16} />}
            {testingPaperless ? t('config.connecting') : t('config.connect')}
          </button>
        </div>

        {paperlessConnected && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm">
            <CheckCircle size={16} />
            {t('config.connectedBadge', { tags: availableTags.length, correspondents: availableCorrespondents.length })}
          </div>
        )}

        {paperlessError && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm">
            <XCircle size={16} />
            {paperlessError}
          </div>
        )}

        <div className="border-t pt-4 space-y-4">
          {!paperlessConnected && availableTags.length === 0 && (
            <p className="text-xs text-gray-400 italic">{t('config.notConnectedHint')}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={label}>{t('config.processTag')}</label>
              <select value={configs.process_tag} onChange={(e) => setConfigs({ ...configs, process_tag: e.target.value })} className={field}>
                <option value="">{t('common.selectTag')}</option>
                {availableTags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
              </select>
              <p className={hint}>{t('config.processTagHint')}</p>
            </div>
            <div>
              <label className={label}>{t('config.processedTag')}</label>
              <select value={configs.processed_tag} onChange={(e) => setConfigs({ ...configs, processed_tag: e.target.value })} className={field}>
                <option value="">{t('common.selectTag')}</option>
                {availableTags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
              </select>
              <p className={hint}>{t('config.processedTagHint')}</p>
            </div>
            <div>
              <label className={label}>{t('config.ocrPostProcess')}</label>
              <select value={configs.ocr_post_process} onChange={(e) => setConfigs({ ...configs, ocr_post_process: e.target.value })} className={field}>
                <option value="false">{t('common.disabled')}</option>
                <option value="true">{t('common.enabled')}</option>
              </select>
              <p className={hint}>{t('config.ocrPostProcessHint')}</p>
            </div>
            <div className="md:col-span-3">
              <label className={label}>{t('config.tagBlacklist')}</label>
              <input
                type="text"
                value={configs.tag_blacklist}
                onChange={(e) => setConfigs({ ...configs, tag_blacklist: e.target.value })}
                placeholder={t('config.tagBlacklistPlaceholder')}
                className={field}
              />
              <p className={hint}>{t('config.tagBlacklistHint')}</p>
            </div>
            <div>
              <label className={label}>{t('config.forceOcrTag')}</label>
              <select value={configs.force_ocr_tag} onChange={(e) => setConfigs({ ...configs, force_ocr_tag: e.target.value })} className={field}>
                <option value="">{t('common.none')}</option>
                {availableTags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
              </select>
              <p className={hint}>{t('config.forceOcrTagHint')}</p>
            </div>
            <div>
              <label className={label}>{t('config.forceOcrFixTag')}</label>
              <select value={configs.force_ocr_fix_tag} onChange={(e) => setConfigs({ ...configs, force_ocr_fix_tag: e.target.value })} className={field}>
                <option value="">{t('common.none')}</option>
                {availableTags.map((tag) => <option key={tag.id} value={tag.name}>{tag.name}</option>)}
              </select>
              <p className={hint}>{t('config.forceOcrFixTagHint')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* LLM / AI Model */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('config.llmSection')}</h2>
          </div>
          <button
            onClick={handleTestLlm}
            disabled={testingLlm}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {testingLlm ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {t('config.testConnection')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>{t('config.provider')}</label>
            <select value={configs.llm_provider} onChange={(e) => setConfigs({ ...configs, llm_provider: e.target.value })} className={field}>
              <option value="ollama">Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="grok">Grok (xAI)</option>
            </select>
          </div>
          <div>
            <label className={label}>{t('config.model')}</label>
            <input
              type="text"
              value={configs.llm_model}
              onChange={(e) => setConfigs({ ...configs, llm_model: e.target.value })}
              placeholder={configs.llm_provider === 'openai' ? 'gpt-4o-mini' : configs.llm_provider === 'grok' ? 'grok-3-mini' : 'qwen2.5:7b'}
              className={field}
            />
          </div>
          <div>
            <label className={label}>{t('config.apiBaseUrl')}</label>
            <input
              type="text"
              value={configs.llm_api_base}
              onChange={(e) => setConfigs({ ...configs, llm_api_base: e.target.value })}
              placeholder={configs.llm_provider === 'openai' ? 'https://api.openai.com/v1' : configs.llm_provider === 'grok' ? 'https://api.x.ai/v1' : 'http://localhost:11434'}
              className={field}
            />
          </div>
          <div>
            <label className={label}>{t('config.apiKey')} <span className="font-normal text-gray-400">({t('common.optional')})</span></label>
            <input
              type="password"
              value={configs.llm_api_key}
              onChange={(e) => setConfigs({ ...configs, llm_api_key: e.target.value })}
              placeholder={configs.llm_provider === 'ollama' ? t('config.apiKeyPlaceholderOllama') : t('config.apiKeyPlaceholderCloud')}
              className={field}
            />
            <p className={hint}>{t('config.apiKeyHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.visionOcr')}</label>
            <select value={configs.enable_vision} onChange={(e) => setConfigs({ ...configs, enable_vision: e.target.value })} className={field}>
              <option value="false">{t('common.disabled')}</option>
              <option value="true">{t('common.enabled')}</option>
            </select>
            <p className={hint}>{t('config.visionOcrHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.fallbackOcr')}</label>
            <select value={configs.enable_fallback_ocr} onChange={(e) => setConfigs({ ...configs, enable_fallback_ocr: e.target.value })} className={field}>
              <option value="false">{t('common.disabled')}</option>
              <option value="true">{t('common.enabled')}</option>
            </select>
            <p className={hint}>{t('config.fallbackOcrHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.llmTimeout')}</label>
            <input
              type="number"
              min="30"
              max="3600"
              value={configs.llm_timeout}
              onChange={(e) => setConfigs({ ...configs, llm_timeout: e.target.value })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className={hint}>{t('config.llmTimeoutHint')}</p>
          </div>
        </div>

        {configs.enable_vision === 'true' && (
          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{t('config.visionModelSection')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={label}>{t('config.provider')}</label>
                <select value={configs.llm_provider_vision} onChange={(e) => setConfigs({ ...configs, llm_provider_vision: e.target.value })} className={field}>
                  <option value="ollama">Ollama</option>
                  <option value="openai">OpenAI</option>
                  <option value="grok">Grok (xAI)</option>
                </select>
              </div>
              <div>
                <label className={label}>{t('config.visionModel')}</label>
                <input
                  type="text"
                  value={configs.llm_model_vision}
                  onChange={(e) => setConfigs({ ...configs, llm_model_vision: e.target.value })}
                  placeholder={configs.llm_provider_vision === 'openai' ? 'gpt-4o' : configs.llm_provider_vision === 'grok' ? 'grok-2-vision-1212' : 'qwen2.5vl:7b'}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>{t('config.apiBaseUrl')}</label>
                <input
                  type="text"
                  value={configs.llm_api_base_vision}
                  onChange={(e) => setConfigs({ ...configs, llm_api_base_vision: e.target.value })}
                  placeholder={configs.llm_provider_vision === 'openai' ? 'https://api.openai.com/v1' : configs.llm_provider_vision === 'grok' ? 'https://api.x.ai/v1' : 'http://localhost:11434'}
                  className={field}
                />
              </div>
              <div>
                <label className={label}>{t('config.apiKey')} <span className="font-normal text-gray-400">({t('common.optional')})</span></label>
                <input
                  type="password"
                  value={configs.llm_api_key_vision}
                  onChange={(e) => setConfigs({ ...configs, llm_api_key_vision: e.target.value })}
                  placeholder={configs.llm_provider_vision === 'ollama' ? t('config.apiKeyPlaceholderOllama') : t('config.apiKeyPlaceholderCloud')}
                  className={field}
                />
                <p className={hint}>{t('config.apiKeyHint')}</p>
              </div>
              <div>
                <label className={label}>{t('config.llmTimeoutVision')}</label>
                <input
                  type="number"
                  min="30"
                  max="3600"
                  value={configs.llm_timeout_vision}
                  onChange={(e) => setConfigs({ ...configs, llm_timeout_vision: e.target.value })}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className={hint}>{t('config.llmTimeoutVisionHint')}</p>
              </div>
            </div>
          </div>
        )}

        {llmResult && (
          <div className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${llmResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {llmResult.success ? <CheckCircle size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />}
            <span className="whitespace-pre-line">{llmResult.message}</span>
          </div>
        )}
      </div>

      {/* Scheduler */}
      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div className="flex items-center justify-between border-b pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('config.schedulerSection')}</h2>
            {schedulerStatus?.running ? (
              <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                <CheckCircle size={11} /> {t('config.schedulerRunning')}
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                <XCircle size={11} /> {t('config.schedulerStopped')}
              </span>
            )}
            {schedulerStatus?.is_processing && (
              <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                <RefreshCw size={11} className="animate-spin" /> {t('config.schedulerProcessing')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-end gap-4">
          <div>
            <label className={label}>{t('config.schedulerInterval')}</label>
            <input
              type="number"
              min="1"
              max="60"
              value={schedulerInterval}
              onChange={(e) => setSchedulerInterval(parseInt(e.target.value) || 5)}
              disabled={schedulerStatus?.running}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>
          <div className="flex gap-2">
            {schedulerStatus?.running ? (
              <button
                onClick={handleSchedulerStop}
                disabled={schedulerLoading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Square size={16} />
                {t('config.stop')}
              </button>
            ) : (
              <button
                onClick={handleSchedulerStart}
                disabled={schedulerLoading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <Play size={16} />
                {t('config.start')}
              </button>
            )}
          </div>
          {schedulerStatus?.running && schedulerStatus.next_run && (
            <span className="text-sm text-gray-500">
              {t('config.schedulerNextRun', { time: new Date(schedulerStatus.next_run).toLocaleString() })}
            </span>
          )}
        </div>

        {schedulerStatus?.is_processing && schedulerStatus.current_doc_id && (
          <div className="text-sm text-blue-600">
            {t('config.schedulerCurrentDoc', { id: schedulerStatus.current_doc_id })}
          </div>
        )}

        <div className="border-t pt-4">
          <button onClick={handleClearState} className="text-sm text-gray-500 hover:text-gray-700 underline">
            {t('config.clearStuckState')}
          </button>
        </div>
      </div>

      {/* Modular Tag Workflows */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        {sectionHeader(Tag, 'config.modularSection')}
        <p className="text-sm text-gray-500 -mt-2">{t('config.modularSectionHint')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>{t('config.modularTagProcess')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_process}
              placeholder="ai-process"
              onChange={e => setConfigs({ ...configs, modular_tag_process: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagProcessHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagOcr')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_ocr}
              placeholder="ai-ocr"
              onChange={e => setConfigs({ ...configs, modular_tag_ocr: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagOcrHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagOcrFix')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_ocr_fix}
              placeholder="ai-ocr-fix"
              onChange={e => setConfigs({ ...configs, modular_tag_ocr_fix: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagOcrFixHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagTitle')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_title}
              placeholder="ai-title"
              onChange={e => setConfigs({ ...configs, modular_tag_title: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagTitleHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagCorrespondent')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_correspondent}
              placeholder="ai-correspondent"
              onChange={e => setConfigs({ ...configs, modular_tag_correspondent: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagCorrespondentHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagDocumentType')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_document_type}
              placeholder="ai-document-type"
              onChange={e => setConfigs({ ...configs, modular_tag_document_type: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagDocumentTypeHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagTags')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_tags}
              placeholder="ai-tags"
              onChange={e => setConfigs({ ...configs, modular_tag_tags: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagTagsHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularTagFields')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_tag_fields}
              placeholder="ai-fields"
              onChange={e => setConfigs({ ...configs, modular_tag_fields: e.target.value })}
            />
            <p className={hint}>{t('config.modularTagFieldsHint')}</p>
          </div>
          <div>
            <label className={label}>{t('config.modularProcessedTag')}</label>
            <input
              type="text"
              className={field}
              value={configs.modular_processed_tag}
              placeholder={configs.processed_tag || 'ai-processed'}
              onChange={e => setConfigs({ ...configs, modular_processed_tag: e.target.value })}
            />
            <p className={hint}>{t('config.modularProcessedTagHint')}</p>
          </div>
        </div>
      </div>

      {/* Application */}
      <div className="bg-white rounded-lg shadow p-6">
        {sectionHeader(Settings, 'config.applicationSection')}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="w-48">
            <label className={label}>{t('config.logLevel')}</label>
            <select
              value={configs.log_level}
              onChange={(e) => setConfigs({ ...configs, log_level: e.target.value })}
              className={field}
            >
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
            <p className={hint}>{t('config.logLevelHint')}</p>
          </div>
          <div className="w-48">
            <label className={label}>{t('config.authEnabled')}</label>
            <select
              value={configs.auth_enabled}
              onChange={(e) => setConfigs({ ...configs, auth_enabled: e.target.value })}
              className={field}
            >
              <option value="false">{t('common.disabled')}</option>
              <option value="true">{t('common.enabled')}</option>
            </select>
            <p className={hint}>{t('config.authEnabledHint')}</p>
            {configs.auth_enabled === 'true' && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                {t('config.authEnabledWarning')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? t('config.saving') : t('config.saveConfiguration')}
        </button>
      </div>
    </div>
  );
}
