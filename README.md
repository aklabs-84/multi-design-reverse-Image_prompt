# 🎨 Multi Design Reverse Engineer

여러 장의 디자인 이미지를 리버스 엔지니어링하여 관통하는 공통 디자인 DNA와 통합 프롬프트를 추출하는 강력한 AI 도구입니다. **OpenAI, Anthropic, Google AI**의 최신 2026년형 플래그십 모델들을 지원합니다.

## ✨ 주요 기능

- **멀티 AI 모델 지원**: GPT-5.2, Claude 4.5, Gemini 3 Pro 등 최신 고성능 모델 선택 가능.
- **이미지 통합 분석**: 한 장 또는 여러 장의 이미지에서 공통적인 레이아웃, 컬러, 타이포그래피 패턴을 추출.
- **추천 활용 분야 제안**: 분석된 스타일이 어떤 분야(공익 캠페인, 매뉴얼, 교육 등)에 적합한지 AI가 추천.
- **구조적 프롬프트 생성**: 분석 결과를 바탕으로 미드저니, 스테이블 디퓨전 등에서 즉시 사용 가능한 정밀 프롬프트 생성.
- **API 키 검증 UI**: 입력한 API 키의 유효성을 즉시 확인하고 로컬 스토리지에 안전하게 보관.

## 🚀 시작하기

### 1. 필수 조건
- [Node.js](https://nodejs.org/) (v16 이상 권장)
- 지원되는 AI 서비스의 API 키 (OpenAI, Anthropic, Google 중 하나 이상)

### 2. 설치 및 실행
```bash
# 패키지 설치
npm install

# 로컬 개발 서버 실행
npm run dev
```
실행 후 터미널에 표시된 `http://localhost:5173` 주소로 접속하세요.

## 📖 사용 방법

1. **API 키 설정**: 웹앱 상단의 'API 키 설정' 버튼을 클릭하여 보유하신 키를 입력하고 '검증하기'를 눌러 확인합니다.
2. **이미지 업로드**: 분석하고자 하는 디자인 이미지들을 드래그 앤 드롭하거나 '이미지 추가'를 통해 업로드합니다. (복사된 이미지 붙여넣기 기능 지원)
3. **옵션 선택**: 결과물의 화면 비율(Aspect Ratio)과 분석에 사용할 AI 모델을 선택합니다. 추가 요청 사항이 있다면 입력 칸에 적어주세요.
4. **리포트 생성**: '통합 분석 리포트 생성' 버튼을 클릭합니다.
5. **결과 확인 및 활용**: 추출된 **스타일 이름**, **시스템 설명**, **추천 활용 분야**를 확인하고, 하단의 **프롬프트**를 복사하여 이미지 생성 AI에서 활용합니다.

## 🛠 기술 스택
- **Frontend**: React, TypeScript, Vite
- **Styling**: Vanilla CSS (Modern aesthetic with glassmorphism)
- **AI Integration**: Custom Multi-AI Client (OpenAI API, Anthropic API, Google Generative AI SDK)

## 🔗 관련 정보
- **GitHub Repository**: [https://github.com/aklabs-84/multi-design-reverse-Image_prompt.git](https://github.com/aklabs-84/multi-design-reverse-Image_prompt.git)
- **Developer**: AKLABS

---
이 도구는 디자인 시스템의 일관성을 분석하고 새로운 창작적 영감을 얻는 데 최적화되어 있습니다.
