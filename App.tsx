
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
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center max-w-6xl mx-auto">
      {/* Header */}
      <header className="w-full text-center mb-8 space-y-4">
        <h1 className="text-4xl md:text-6xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent pb-6 pt-2 leading-snug">
          Multi Design Reverse Engineer
        </h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto">
          여러 장의 이미지를 분석하여 관통하는 공통 디자인 DNA와 통합 프롬프트를 추출합니다.
        </p>

        <div className="flex justify-center gap-4 mt-4">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs font-bold text-slate-300 transition-all flex items-center gap-2"
          >
            <svg className={`w-4 h-4 transition-transform ${showGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            {showGuide ? '가이드 닫기' : '사용 가이드 보기'}
          </button>
          <button
            onClick={() => setShowAPIKeys(!showAPIKeys)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs font-bold text-slate-300 transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            API 키 설정
          </button>
        </div>
      </header>

      {/* API 키 설정 섹션 */}
      {showAPIKeys && (
        <section className="w-full mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
              API 키 설정
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OpenAI API Key</label>
                    {verificationStatus.openai === 'success' && <span className="text-[10px] text-green-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>사용 가능</span>}
                    {verificationStatus.openai === 'error' && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>검증 실패</span>}
                  </div>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => { setOpenaiKey(e.target.value); setVerificationStatus(prev => ({ ...prev, openai: null })); }}
                    placeholder="sk-..."
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono"
                  />
                </div>
                <button
                  onClick={() => verifyAPIKey('openai')}
                  disabled={!openaiKey || verifying.openai}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-[10px] font-bold text-white rounded-lg transition-all"
                >
                  {verifying.openai ? '검증 중...' : 'OpenAI 키 검증하기'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Anthropic API Key</label>
                    {verificationStatus.anthropic === 'success' && <span className="text-[10px] text-green-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>사용 가능</span>}
                    {verificationStatus.anthropic === 'error' && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>검증 실패</span>}
                  </div>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => { setAnthropicKey(e.target.value); setVerificationStatus(prev => ({ ...prev, anthropic: null })); }}
                    placeholder="sk-ant-..."
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-mono"
                  />
                </div>
                <button
                  onClick={() => verifyAPIKey('anthropic')}
                  disabled={!anthropicKey || verifying.anthropic}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-[10px] font-bold text-white rounded-lg transition-all"
                >
                  {verifying.anthropic ? '검증 중...' : 'Anthropic 키 검증하기'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Google AI API Key</label>
                    {verificationStatus.google === 'success' && <span className="text-[10px] text-green-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>사용 가능</span>}
                    {verificationStatus.google === 'error' && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>검증 실패</span>}
                  </div>
                  <input
                    type="password"
                    value={googleKey}
                    onChange={(e) => { setGoogleKey(e.target.value); setVerificationStatus(prev => ({ ...prev, google: null })); }}
                    placeholder="AIza..."
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all font-mono"
                  />
                </div>
                <button
                  onClick={() => verifyAPIKey('google')}
                  disabled={!googleKey || verifying.google}
                  className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-[10px] font-bold text-white rounded-lg transition-all"
                >
                  {verifying.google ? '검증 중...' : 'Google 키 검증하기'}
                </button>
              </div>
            </div>
            <p className="mt-4 text-[10px] text-slate-500 text-center">API 키는 브라우저 로컬 스토리지에만 안전하게 저장됩니다.</p>
          </div>
        </section>
      )}

      {/* 사용 가이드 섹션 */}
      {showGuide && (
        <section className="w-full mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-3xl p-6 md:p-8 backdrop-blur-md">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="flex-1 space-y-4">
                <div className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  Multi-Analysis
                </div>
                <p className="text-lg md:text-xl font-bold text-slate-100 leading-relaxed">
                  "참고하고 싶은 여러 장의 이미지를 한꺼번에 업로드하세요. AI가 공통적인 레이아웃, 컬러 패턴, 기하학적 규칙을 찾아 하나의 통합 가이드라인으로 만들어 드립니다."
                </p>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-500/10 rounded-md flex items-center justify-center text-[10px]">1</span>
                    다중 이미지 업로드
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">여러 파일을 한꺼번에 선택하거나, 클립보드에서 여러 번 붙여넣어 이미지를 추가합니다.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-500/10 rounded-md flex items-center justify-center text-[10px]">2</span>
                    공통 패턴 분석
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">AI가 각 이미지의 개별 특징이 아닌, 전체를 아우르는 일관된 시스템 DNA를 분석합니다.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-500/10 rounded-md flex items-center justify-center text-[10px]">3</span>
                    통합 프롬프트 생성
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">생성된 하나의 프롬프트로 일관된 스타일의 새로운 시리즈를 제작할 수 있습니다.</p>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-500/10 rounded-md flex items-center justify-center text-[10px]">4</span>
                    디자인 시스템 구축
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">추출된 Hex 코드와 폰트 스타일을 활용해 나만의 디자인 가이드를 확립하세요.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      <main className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

        {/* Left Column: Input & Options */}
        <section className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="bg-blue-500 w-2 h-6 rounded-full inline-block"></span>
              이미지 분석 라이브러리 ({images.length})
            </h2>
            {images.length > 0 && state !== AppState.ANALYZING && (
              <button onClick={reset} className="text-xs text-slate-400 hover:text-white transition-colors uppercase tracking-widest font-bold">전체 삭제</button>
            )}
          </div>

          <div className="space-y-6">
            {/* Image Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-lg animate-in zoom-in-95 duration-200">
                  <img src={img} alt={`Sample ${idx}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ))}

              {/* Add Button */}
              <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-slate-800 transition-all group">
                <svg className="w-8 h-8 text-slate-500 group-hover:text-blue-400 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                <span className="text-[10px] mt-2 text-slate-500 font-bold uppercase">이미지 추가</span>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageUpload} />
              </label>
              {/* Model Selector */}
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">분석 AI 모델 선택 (AI Model)</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                >
                  <optgroup label="🟠 Anthropic - Flagship 2026">
                    <option value="anthropic:claude-opus-4-5-20251101">Claude Opus 4.5 (Premium)</option>
                    <option value="anthropic:claude-sonnet-4-5-20250929">Claude Sonnet 4.5 (Recommended)</option>
                    <option value="anthropic:claude-haiku-4-5-20251001">Claude Haiku 4.5 (Fast)</option>
                  </optgroup>
                  <optgroup label="🔷 OpenAI - Flagship 2026">
                    <option value="openai:gpt-5.2">GPT-5.2 (Latest)</option>
                    <option value="openai:gpt-5.2-codex">GPT-5.2 Codex (Coding)</option>
                    <option value="openai:gpt-5.1">GPT-5.1 (Balanced)</option>
                    <option value="openai:gpt-5">GPT-5 (Standard)</option>
                  </optgroup>
                  <optgroup label="🔴 Google - Flagship 2026">
                    <option value="google:gemini-3-pro-preview">Gemini 3 Pro (Vision Premium)</option>
                    <option value="google:gemini-3-flash-preview">Gemini 3 Flash (Fast & Reliable)</option>
                    <option value="google:gemini-2.5-flash">Gemini 2.5 Flash (Efficiency)</option>
                  </optgroup>
                </select>
              </div>
            </div>

            {images.length > 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* 가로세로 비율 선택 UI */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">출력 프롬프트 비율 (Aspect Ratio)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.id}
                        onClick={() => setAspectRatio(ratio.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${aspectRatio === ratio.id
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/30'
                          : 'bg-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                      >
                        <svg className="w-5 h-5 mb-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d={ratio.icon} />
                        </svg>
                        <span className="text-[10px] font-bold">{ratio.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 추가 요청 사항 입력창 */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">추가 요청 사항 (Optional)</label>
                  <textarea
                    value={userRequest}
                    onChange={(e) => setUserRequest(e.target.value)}
                    placeholder="예: '전체적으로 블루 톤을 더 강조해줘', '공통적인 레이아웃 규칙을 찾아줘' 등"
                    className="w-full h-24 bg-slate-900/80 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all resize-none"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  {state !== AppState.ANALYZING && (
                    <button
                      onClick={startAnalysis}
                      disabled={images.length === 0}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {state === AppState.COMPLETED ? '새로운 옵션으로 통합 재분석' : `${images.length}장의 이미지 통합 분석 리포트 생성`}
                    </button>
                  )}

                  {state === AppState.COMPLETED && (
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={scrollToResult} className="py-3 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 font-bold rounded-xl border border-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        결과 보기
                      </button>
                      <button onClick={reset} className="py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        초기화
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {images.length === 0 && (
              <div className="py-20 text-center space-y-4">
                <p className="text-slate-500 font-medium">분석할 이미지를 추가해 주세요.<br /><span className="text-xs">여러 장을 추가하면 공통점을 분석합니다.</span></p>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">CTRL+V 지원</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Result */}
        <section ref={resultRef} className="bg-slate-800/50 border border-slate-700 rounded-3xl p-6 shadow-2xl backdrop-blur-sm min-h-[500px] flex flex-col overflow-hidden relative">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="bg-indigo-500 w-2 h-6 rounded-full inline-block"></span>
              통합 분석 결과 리포트
            </h2>
            {state === AppState.COMPLETED && (
              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded border border-green-500/30 uppercase tracking-tighter">완료</span>
            )}
          </div>

          <div className="flex-grow flex flex-col space-y-6 overflow-hidden">
            {state === AppState.ANALYZING ? (
              <div className="h-full flex flex-col items-center justify-center space-y-4 py-20">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-slate-200 font-bold mb-1">통합 디자인 DNA 추출 중...</p>
                  <p className="text-slate-500 text-xs">{images.length}장의 이미지에서 패턴을 발견하고 있습니다.</p>
                </div>
              </div>
            ) : result ? (
              <div className="flex flex-col space-y-6 overflow-y-auto pr-2 custom-scrollbar animate-in fade-in duration-500 pb-4">
                <div className="bg-indigo-900/30 border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
                  <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-2">COMMON STYLE NAME</p>
                  <h3 className="text-2xl font-black text-white leading-tight">{parsedResult.title}</h3>
                </div>

                <div className="bg-slate-900/40 border border-slate-700/50 rounded-2xl p-5">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">SYSTEM DESCRIPTION</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{parsedResult.intro}</p>
                </div>

                {parsedResult.recommended && (
                  <div className="bg-amber-900/10 border border-amber-500/20 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] text-amber-500/80 font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      RECOMMENDED APPLICATION FIELDS
                    </p>
                    <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">
                      {parsedResult.recommended}
                    </div>
                  </div>
                )}

                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">UNIFIED STRUCTURAL PROMPT</p>
                    <button
                      onClick={copyToClipboard}
                      className={`text-xs font-bold flex items-center gap-1 transition-all px-2 py-1 rounded-md ${copied
                        ? 'bg-green-500/20 text-green-400'
                        : 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10'
                        }`}
                    >
                      {copied ? (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                          복사됨!
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                          프롬프트 복사
                        </>
                      )}
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 font-mono text-[13px] leading-relaxed relative group shadow-inner">
                    <pre className="whitespace-pre-wrap text-slate-300">{parsedResult.prompt}</pre>
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
                <span className="text-red-400 text-3xl">⚠️</span>
                <p className="text-red-400 font-medium">{error}</p>
                <button onClick={startAnalysis} className="mt-4 text-sm underline text-slate-400 hover:text-white">재시도</button>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center py-20 opacity-50">
                <div className="mb-4 bg-slate-800/30 p-6 rounded-full inline-block">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                </div>
                <p className="font-medium">이미지들을 분석하면 공통 가이드가 표시됩니다.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* AKLABS 홍보 푸터 배너 */}
      <div className="w-full max-w-xl mx-auto mt-20 mb-10 group">
        <a
          href="https://litt.ly/aklabs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-6 md:p-8 bg-white rounded-[2.5rem] shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer"
        >
          <div className="space-y-1">
            <p className="text-slate-900 font-bold text-lg md:text-xl">나만의 AI 웹앱을 만들고 싶다면?</p>
            <p className="text-indigo-600 font-bold md:text-lg italic">아크랩스에서 AI 마스터가 되어보세요</p>
          </div>
          <div className="flex-shrink-0 bg-[#0a0f1a] w-14 h-14 md:w-16 md:h-16 rounded-3xl flex items-center justify-center shadow-lg group-hover:bg-indigo-600 transition-colors">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </div>

      <footer className="mt-12 text-slate-600 text-xs py-8 text-center border-t border-slate-800/50 w-full tracking-widest uppercase">
        Multi-Image Design Reverse Engineer AI Analyst • Powered by Multi-AI Support
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #475569; }
      `}</style>
    </div>
  );
};

export default App;
