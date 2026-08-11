type JsonSchema=Record<string,unknown>;

export async function generateFreeJson(prompt:string,schema:JsonSchema){
  const key=process.env.GEMINI_API_KEY?.trim();
  if(!key)throw new Error("free_ai_not_configured");
  const models=[process.env.GEMINI_MODEL?.trim(),"gemini-3.1-flash-lite","gemini-3.5-flash-lite"].filter((value,index,array):value is string=>Boolean(value)&&array.indexOf(value)===index);
  let result:{candidates?:{content?:{parts?:{text?:string}[]}}[]}|null=null,lastStatus=502;
  for(const model of models){const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
    method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":key},cache:"no-store",
    body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.2,responseMimeType:"application/json",responseJsonSchema:schema}}),
  });if(response.ok){result=await response.json();break;}lastStatus=response.status;const detail=await response.text();console.error("free_gemini_failed",model,response.status,detail.slice(0,300));if(response.status!==404)break;}
  if(!result)throw new Error(`free_ai_${lastStatus}`);
  const text=result.candidates?.[0]?.content?.parts?.map(part=>part.text||"").join("").trim()||"";
  if(!text)throw new Error("free_ai_empty");
  return JSON.parse(text.replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"").trim()) as Record<string,unknown>;
}
