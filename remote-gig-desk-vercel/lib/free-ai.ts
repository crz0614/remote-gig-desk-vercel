type JsonSchema=Record<string,unknown>;

export async function generateFreeJson(prompt:string,schema:JsonSchema){
  const key=process.env.GEMINI_API_KEY?.trim();
  if(!key)throw new Error("free_ai_not_configured");
  const model=process.env.GEMINI_MODEL?.trim()||"gemini-2.5-flash-lite";
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},cache:"no-store",
    body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json",responseJsonSchema:schema}}),
  });
  if(!response.ok){const detail=await response.text();console.error("free_gemini_failed",response.status,detail.slice(0,300));throw new Error(`free_ai_${response.status}`);}
  const result=await response.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};
  const text=result.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("").trim()||"";
  if(!text)throw new Error("free_ai_empty");
  return JSON.parse(text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim()) as Record<string,unknown>;
}
