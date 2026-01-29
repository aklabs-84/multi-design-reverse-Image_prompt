
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const SYSTEM_INSTRUCTION = `
# Role
너는 여러 장의 디자인 이미지를 리버스 엔지니어링하여, 제공된 모든 이미지에서 관통하는 공통적인 디자인 규격과 시스템 DNA를 '구조적 프롬프팅(Structured Prompting)' 형식으로 추출하는 전문 디자인 시스템 분석가이다.

# Task
사용자가 하나 또는 여러 개의 이미지를 업로드하면, 해당 이미지들의 시각적 공통 요소(컬러, 레이아웃, 기법, 분위기 등)를 정밀 분석하여 이를 하나의 통합된 텍스트 가이드라인으로 생성하라.

# Output Format (Strictly Follow)
출력은 반드시 아래 형식을 유지해야 하며, 마크다운 코드 블록 등을 사용하지 말고 순수 텍스트만 출력하라. 각 섹션 사이에는 반드시 구분선 '---'을 넣어라:

디자인 제목: "[분석된 이미지들의 공통 컨셉을 요약한 스타일 명칭]"
디자인 소개: "[제공된 이미지들에서 발견된 공통적인 디자인 언어와 시각적 가치를 설명하는 2~3문장의 요약문]"
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

export async function analyzeImages(base64Images: string[], userRequest?: string, aspectRatio: string = "1:1"): Promise<string> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not configured.");
  }

  // Use the API key directly to initialize GoogleGenAI as per guidelines.
  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const imageParts = base64Images.map(base64 => {
      // Dynamically detect mime type from base64 string or default to image/jpeg.
      const mimeMatch = base64.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      return {
        inlineData: {
          mimeType: mimeType,
          data: base64.split(',')[1] || base64
        }
      };
    });

    let promptText = `제공된 ${base64Images.length}장의 이미지를 분석하여 이들의 공통적인 디자인 DNA를 추출해줘. 
사용자가 선택한 결과물 비율은 [${aspectRatio}]이야. 이를 프롬프트의 '프레임 규격' 항목에 반드시 포함시켜줘.
모든 이미지의 특징을 아우르는 하나의 완성된 구조적 프롬프트를 생성해줘.`;

    if (userRequest) {
      promptText += `\n\n[사용자 추가 요청 사항]:\n${userRequest}`;
    }

    // Use 'gemini-3-pro-preview' for complex text tasks involving advanced reasoning like design analysis.
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...imageParts,
          {
            text: promptText
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2,
      },
    });

    // response.text is a property, not a method.
    return response.text || "분석 결과를 생성하지 못했습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
