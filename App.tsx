
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState } from './types';
import { MultiAIClient } from './services/multiAIClient';

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', desc: '정사각형', icon: 'M4 4h16v16H4z' },
  { id: '16:9', label: '16:9', desc: '와이드', icon: 'M2 6h20v12H2z' },
  { id: '9:16', label: '9:16', desc: '세로형', icon: 'M6 2h12v20H6z' },
  { id: '4:3', label: '4:3', desc: '표준', icon: 'M3 5h18v14H3z' },
  { id: '3:4', label: '3:4', desc: '세로표준', icon: 'M5 3h14v18H5z' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [images, setImages] = useState<string[]>([]);
  const [userRequest, setUserRequest] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showAPIKeys, setShowAPIKeys] = useState(false);

  // Multi-AI states
  const [openaiKey, setOpenaiKey] = useState(localStorage.getItem('openai_key') || '');
  const [anthropicKey, setAnthropicKey] = useState(localStorage.getItem('anthropic_key') || '');
  const [googleKey, setGoogleKey] = useState(localStorage.getItem('google_key') || '');
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem('selected_model') || 'anthropic:claude-sonnet-4-5-20250929');

  // Verification states
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});
  const [verificationStatus, setVerificationStatus] = useState<Record<string, 'success' | 'error' | null>>({});

  const resultRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persist keys and model
  useEffect(() => {
    localStorage.setItem('openai_key', openaiKey);
    localStorage.setItem('anthropic_key', anthropicKey);
    localStorage.setItem('google_key', googleKey);
    localStorage.setItem('selected_model', selectedModel);
  }, [openaiKey, anthropicKey, googleKey, selectedModel]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLInputElement) {
        return;
      }
      const items = event.clipboardData?.items;
      if (!items) return;

      const newImages: string[] = [];
      let itemsProcessed = 0;
      // Explicitly cast Array.from result to DataTransferItem[] to ensure 'item' is correctly typed.
      const imageItems = (Array.from(items) as DataTransferItem[]).filter(item => item.type.indexOf('image') !== -1);

      if (imageItems.length === 0) return;

      imageItems.forEach(item => {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            newImages.push(base64);
            itemsProcessed++;
            if (itemsProcessed === imageItems.length) {
              setImages(prev => [...prev, ...newImages]);
              if (state === AppState.IDLE || state === AppState.COMPLETED) {
                setState(AppState.UPLOADING);
              }
              setResult(null);
              setError(null);
              setCopied(false);
            }
          };
          reader.readAsDataURL(file);
        }
      });
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [state]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    let filesProcessed = 0;

    // Explicitly cast Array.from(files) to File[] to ensure the compiler recognizes each element as a Blob-compatible File object.
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        newImages.push(base64);
        filesProcessed++;
        if (filesProcessed === files.length) {
          setImages(prev => [...prev, ...newImages]);
          setState(AppState.UPLOADING);
          setResult(null);
          setError(null);
          setCopied(false);
        }
      };
      // Fixed the 'unknown' assignment error by ensuring 'file' is typed as File.
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (newImages.length === 0) {
      setState(AppState.IDLE);
    }
  };

  const startAnalysis = async () => {
    if (images.length === 0) return;

    // Check if key for selected provider exists
    const provider = selectedModel.split(':')[0];
    const key = provider === 'openai' ? openaiKey : provider === 'anthropic' ? anthropicKey : googleKey;

    if (!key) {
      setError(`${provider.toUpperCase()} API 키가 필요합니다. 설정 메뉴에서 입력해 주세요.`);
      setShowAPIKeys(true);
      return;
    }

    setState(AppState.ANALYZING);
    setCopied(false);
    setError(null);

    const SYSTEM_INSTRUCTION = `
# Role
너는 여러 장의 디자인 이미지를 리버스 엔지니어링하여, 제공된 모든 이미지에서 관통하는 공통적인 디자인 규격과 시스템 DNA를 '구조적 프롬프팅(Structured Prompting)' 형식으로 추출하는 전문 디자인 시스템 분석가이다.

# Task
사용자가 하나 또는 여러 개의 이미지를 업로드하면, 해당 이미지들의 시각적 공통 요소(컬러, 레이아웃, 기법, 분위기 등)를 정밀 분석하여 이를 하나의 통합된 텍스트 가이드라인으로 생성하라.

# Output Format (Strictly Follow)
출력은 반드시 아래 형식을 유지해야 하며, 마크다운 코드 블록 등을 사용하지 말고 순수 텍스트만 출력하라. 답변의 시작을 '디자인 제목:'으로 고정하고, 어떠한 사전 설명이나 인사말, 마크다운 헤더(### 등)를 추가하지 마라.

디자인 제목: [분석된 이미지들의 공통 컨셉을 요약한 스타일 명칭]
디자인 소개: [제공된 이미지들에서 발견된 공통적인 디자인 언어와 시각적 가치를 설명하는 요약문]

추천 활용 분야:
[이 디자인 스타일이 활용되기 좋은 구체적인 분야 3개와 각각에 대한 짧은 설명]
(예: 공익 캠페인, 서비스 매뉴얼, 교육용 콘텐츠 등)
---
전체 디자인 설정:
  프레임 규격: "[사용자가 선택한 가로세로 비율]"
  톤: "[이미지들을 관통하는 분위기를 나타내는 키워드 4~5개]"
  시각적 아이덴티티:
    배경색: "[공통적으로 발견되는 배경색 Hex 코드 및 색상명]"
    텍스트 색상: "[주요 텍스트 색상 Hex 코드 및 색상명]"
    강조 색상: "[포인트로 쓰이는 강조 색상 Hex 코드 및 색상명]"
    이미지 스타일:
      특징: "[핵심 디자인 기법의 공통점]"
      형태: "[도형의 각도, 배치 방식의 일관성]"
      효과: "[질감, 빛, 애니메이션 효과의 공통 요소]"
      구성: "[레이아웃 구조, 예: PCB, 그리드, 대칭 등 공통 패턴]"
  타이포그래피:
    제목: "[일관되게 사용된 폰트 스타일 종류]"
    스타일: "[텍스트가 구현된 방식의 공통점, 예: HUD, 시스템 UI 등]"

# Analysis Guidelines
1. 패턴 인식: 여러 장의 이미지가 주어졌을 때, 각 이미지의 차이점보다는 전체를 관통하는 '일관된 스타일'을 찾는 데 집중하라.
2. 컬러 추출: 이미지들에서 가장 지배적으로 반복되는 색상군을 찾아 정확한 Hex 코드를 추정하라.
3. 기하학적 분석: 반복되는 선의 각도, 격자 구조, 구성의 규칙성을 명시하라.
4. 통합 가이드라인: 이 프롬프트를 사용했을 때 제공된 이미지들과 유사한 일련의 디자인 결과물들이 나올 수 있도록 일반화되면서도 구체적인 지침을 작성하라.
5. 사용자 요청 반영: 사용자가 추가 요청 사항을 제공한 경우, 해당 내용을 분석에 적극 반영하라.
6. 규격 준수: '프레임 규격'은 반드시 사용자가 선택하여 전달한 값을 그대로 프롬프트에 명시하라.
`;

    try {
      const client = new MultiAIClient();
      client.setKey('openai', openaiKey);
      client.setKey('anthropic', anthropicKey);
      client.setKey('google', googleKey);

      const base64s = images.map(img => img.split(',')[1] || img);
      const mimes = images.map(img => img.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1] || 'image/jpeg');

      let promptText = `제공된 ${images.length}장의 이미지를 분석하여 이들의 공통적인 디자인 DNA를 추출해줘. 
사용자가 선택한 결과물 비율은 [${aspectRatio}]이야. 이를 프롬프트의 '프레임 규격' 항목에 반드시 포함시켜줘.
모든 이미지의 특징을 아우르는 하나의 완성된 구조적 프롬프트를 생성해줘.`;

      if (userRequest) {
        promptText += `\n\n[사용자 추가 요청 사항]:\n${userRequest}`;
      }

      const analysisText = await client.analyzeImages(selectedModel, promptText, base64s, mimes, {
        systemPrompt: SYSTEM_INSTRUCTION
      });

      setResult(analysisText);
      setState(AppState.COMPLETED);
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "이미지 분석 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setState(AppState.ERROR);
    }
  };

  const verifyAPIKey = async (provider: 'openai' | 'anthropic' | 'google') => {
    const key = provider === 'openai' ? openaiKey : provider === 'anthropic' ? anthropicKey : googleKey;
    if (!key) return;

    setVerifying(prev => ({ ...prev, [provider]: true }));
    setVerificationStatus(prev => ({ ...prev, [provider]: null }));

    try {
      const client = new MultiAIClient();
      client.setKey(provider, key);
      const isValid = await client.verifyKey(provider);
      setVerificationStatus(prev => ({ ...prev, [provider]: isValid ? 'success' : 'error' }));
    } catch (err) {
      setVerificationStatus(prev => ({ ...prev, [provider]: 'error' }));
    } finally {
      setVerifying(prev => ({ ...prev, [provider]: false }));
    }
  };

  const scrollToResult = () => {
    resultRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const parsedResult = useMemo(() => {
    if (!result) return { title: '', intro: '', recommended: '', prompt: '' };

    // Improved regex to handle optional bolding, different colons, and varying spaces
    const titleMatch = result.match(/(?:\*\*|#\s+)?디자인\s*제목\s*(?:\*\*)?[:：]\s*(.*)/i);
    const introMatch = result.match(/(?:\*\*|#\s+)?디자인\s*소개\s*(?:\*\*)?[:：]\s*(.*)/i);
    const recommendedMatch = result.match(/(?:\*\*|#\s+)?추천\s*활용\s*분야\s*(?:\*\*)?[:：]\s*([\s\S]*?)(?=\n---|\n#|\n\*\*|$)/i);

    const title = titleMatch ? titleMatch[1].replace(/["'\[\]]/g, '').trim() : '분석된 디자인 스타일';
    const intro = introMatch ? introMatch[1].replace(/["'\[\]]/g, '').trim() : '이미지들에서 추출된 통합 디자인 시스템 가이드라인입니다.';
    const recommended = recommendedMatch ? recommendedMatch[1].trim() : '';

    let prompt = '';
    if (result.includes('---')) {
      const parts = result.split(/---/);
      // The prompt is likely everything after the first --- (or the last part if multiple dividers)
      prompt = parts.slice(1).join('---').trim();
    } else {
      // If no separator, try to remove the recognized title/intro/recommended lines
      prompt = result
        .replace(/^(?:\*\*|#\s+)?디자인\s*제목.*(\n|$)/im, '')
        .replace(/^(?:\*\*|#\s+)?디자인\s*소개.*(\n|$)/im, '')
        .replace(/^(?:\*\*|#\s+)?추천\s*활용\s*분야[\s\S]*?(?=\n---|\n#|\n\*\*|$)/im, '')
        .trim();
    }
    return { title, intro, recommended, prompt };
  }, [result]);

  const copyToClipboard = () => {
    if (parsedResult.prompt) {
      navigator.clipboard.writeText(parsedResult.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setState(AppState.IDLE);
    setImages([]);
    setUserRequest('');
    setAspectRatio('1:1');
    setResult(null);
    setError(null);
    setCopied(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="h-screen bg-[#020617] text-slate-200 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-slate-800/60 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="AKLABS Logo"
            className="h-8 opacity-90 hover:opacity-100 transition-opacity cursor-pointer"
            onClick={reset}
          />
          <div className="h-4 w-[1px] bg-slate-800 mx-2"></div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            멀티 AI 디자인 분석기
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${showGuide ? 'bg-indigo-500 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            사용 가이드
          </button>
          <button
            onClick={() => setShowAPIKeys(!showAPIKeys)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${showAPIKeys ? 'bg-indigo-500 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
            API 설정
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Controls */}
        <aside className="w-80 border-r border-slate-800/60 bg-slate-950/30 overflow-y-auto p-6 space-y-8 hidden lg:block">
          {/* Model Selection */}
          <section className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">분석 AI 모델</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none cursor-pointer"
            >
              <optgroup label="Anthropic">
                <option value="anthropic:claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                <option value="anthropic:claude-opus-4-5-20251101">Claude Opus 4.5</option>
              </optgroup>
              <optgroup label="OpenAI">
                <option value="openai:gpt-5.2">GPT-5.2 (Latest)</option>
                <option value="openai:gpt-4o">GPT-4o</option>
              </optgroup>
              <optgroup label="Google">
                <option value="google:gemini-3-pro-preview">Gemini 3 Pro</option>
                <option value="google:gemini-3-flash-preview">Gemini 3 Flash</option>
              </optgroup>
            </select>
          </section>

          {/* Aspect Ratio */}
          <section className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">출력 프롬프트 비율</label>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  onClick={() => setAspectRatio(ratio.id)}
                  className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${aspectRatio === ratio.id
                    ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400'
                    : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'
                    }`}
                >
                  <span className="text-xs font-bold">{ratio.label}</span>
                  <span className="text-[9px] opacity-60 mt-1 uppercase">{ratio.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom Request */}
          <section className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">추가 요청 사항</label>
            <textarea
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              placeholder="블루 톤 강조..."
              className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none placeholder:text-slate-700"
            />
          </section>

          {/* Action Button */}
          <button
            onClick={startAnalysis}
            disabled={images.length === 0 || state === AppState.ANALYZING}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {state === AppState.ANALYZING ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              '분석 리포트 생성'
            )}
          </button>
        </aside>

        {/* Main Content Stage */}
        <main className="flex-1 overflow-y-auto bg-slate-950/20">
          <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-10 pb-32">

            {/* Guide & API Panels */}
            {showAPIKeys && (
              <section className="bg-slate-900 border border-indigo-500/20 rounded-3xl p-8 mb-4 animate-in slide-in-from-top-4 duration-300">
                <h3 className="text-lg font-bold text-white mb-6">API 키 설정</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {['openai', 'anthropic', 'google'].map((p) => (
                    <div key={p} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{p}</label>
                        {verificationStatus[p] === 'success' && <span className="text-[9px] text-green-400 font-bold uppercase tracking-tighter">Verified</span>}
                      </div>
                      <input
                        type="password"
                        value={p === 'openai' ? openaiKey : p === 'anthropic' ? anthropicKey : googleKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (p === 'openai') setOpenaiKey(val);
                          else if (p === 'anthropic') setAnthropicKey(val);
                          else setGoogleKey(val);
                          setVerificationStatus(prev => ({ ...prev, [p]: null }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400"
                        placeholder="Key..."
                      />
                      <button
                        onClick={() => verifyAPIKey(p as any)}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-bold text-slate-300 uppercase transition-all"
                      >
                        {verifying[p] ? 'Checking...' : 'Verify'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showGuide && (
              <section className="bg-indigo-500/5 border border-indigo-500/20 rounded-3xl p-8 animate-in slide-in-from-top-4 duration-300">
                <p className="text-slate-300 leading-relaxed text-sm">
                  여러 장의 디자인 이미지를 업로드하세요. AI가 관통하는 디자인 DNA를 분석하여 시스템 가이드와 통합 프롬프트를 추출합니다.
                  <br /><br />
                  <span className="text-indigo-400 font-bold">💡 Tip:</span> 클립보드 붙여넣기(Ctrl+V)를 지원하여 더욱 빠르게 이미지를 추가할 수 있습니다.
                </p>
              </section>
            )}

            {/* Image Gallery Stage */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">이미지 라이브러리 <span className="text-slate-600 ml-2 font-medium">{images.length}</span></h2>
                <div className="flex gap-2">
                  {images.length > 0 && <button onClick={reset} className="text-[10px] font-black text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest">Clear All</button>}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 ring-offset-4 ring-offset-slate-950 hover:ring-2 hover:ring-indigo-500/50 transition-all">
                    <img src={img} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                ))}

                <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                  <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all">
                    <svg className="w-6 h-6 text-slate-500 group-hover:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                  </div>
                  <span className="text-[10px] mt-3 text-slate-600 font-black uppercase tracking-widest">Add Image</span>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
                </label>
              </div>
            </section>

            {/* Results Stage */}
            {result || state === AppState.ANALYZING ? (
              <section id="analysis-result" className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-800 to-transparent"></div>

                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                  <h2 className="text-2xl font-black text-white tracking-tight">통합 디자인 리포트</h2>
                </div>

                {state === AppState.ANALYZING ? (
                  <div className="py-20 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-indigo-400 animate-pulse">DNA</div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-slate-100 font-bold text-lg">이미지 패턴 리버스 엔지니어링 중</p>
                      <p className="text-slate-500 text-xs">최신 파운데이션 모델을 사용하여 시스템 가이드를 구축하고 있습니다.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 hover:border-slate-700 transition-colors shadow-xl">
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-4">STYLE IDENTIFIER</label>
                        <h3 className="text-3xl font-black text-white leading-tight mb-4">{parsedResult.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed">{parsedResult.intro}</p>
                      </div>

                      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 hover:border-slate-700 transition-colors shadow-xl">
                        <label className="text-[10px] font-black text-amber-500/80 uppercase tracking-widest block mb-4 flex items-center gap-2">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          Recommended Fields
                        </label>
                        <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                          {parsedResult.recommended}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unified Prompt Guide</label>
                        <button
                          onClick={copyToClipboard}
                          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${copied
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 active:scale-95'
                            }`}
                        >
                          {copied ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>}
                          {copied ? 'Copied to Clipboard!' : 'Copy Prompt'}
                        </button>
                      </div>
                      <div className="bg-slate-950/80 rounded-2xl p-6 font-mono text-[13px] text-indigo-300 leading-relaxed border border-slate-800 shadow-inner">
                        <pre className="whitespace-pre-wrap">{parsedResult.prompt}</pre>
                      </div>
                    </div>

                    {/* Bottom Promotion Card */}
                    <aside className="mt-8">
                      <a
                        href="https://litt.ly/aklabs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-1 shadow-2xl hover:scale-[1.01] transition-transform duration-300"
                      >
                        <div className="bg-slate-950 rounded-[1.4rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6 group-hover:bg-transparent transition-colors duration-300">
                          <div className="space-y-1 text-center md:text-left">
                            <h4 className="text-xl font-black text-white tracking-tight italic">Learn AI Mastery at AKLABS</h4>
                            <p className="text-indigo-400/80 text-sm font-semibold">당신만의 창의적인 AI 웹앱을 직접 만드는 법을 배워보세요.</p>
                          </div>
                          <div className="flex items-center gap-4 px-6 py-3 bg-white text-slate-950 font-black rounded-2xl shadow-xl group-hover:bg-indigo-100 transition-colors">
                            START NOW
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7"></path></svg>
                          </div>
                        </div>
                      </a>
                    </aside>
                  </div>
                )}
              </section>
            ) : (
              <div className="flex flex-col items-center justify-center py-40 opacity-30 animate-in fade-in duration-1000">
                <div className="w-24 h-24 mb-6 rounded-full border-2 border-dashed border-slate-700 flex items-center justify-center">
                  <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Ready to Analyze Patterns</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #334155; }
        body { -webkit-font-smoothing: antialiased; }
      `}</style>
    </div>
  );
};

export default App;
