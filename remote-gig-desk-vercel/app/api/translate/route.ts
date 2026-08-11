function chunks(text:string){
  const source=text.trim(),result:string[]=[];let start=0;
  while(start<source.length){let end=Math.min(start+1800,source.length);if(end<source.length){const boundaries=[source.lastIndexOf("\n\n",end),source.lastIndexOf("\n",end),source.lastIndexOf(". ",end),source.lastIndexOf("; ",end)];const boundary=Math.max(...boundaries);if(boundary>start+900)end=boundary+(source.slice(boundary,boundary+2)==="\n\n"?2:1);}result.push(source.slice(start,end).trim());start=end;}
  return result.filter(Boolean);
}

function protectLiterals(text:string){
  const values:string[]=[];
  const protectedText=text.replace(/https?:\/\/[^\s<>()\]]+|\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g,value=>{const index=values.push(value)-1;return ` CRZLITERAL${index} `;});
  return {protectedText,restore:(translated:string)=>translated.replace(/CRZLITERAL\s*(\d+)/gi,(_,raw)=>values[Number(raw)]||"")};
}

async function freeTranslate(part:string){
  const {protectedText,restore}=protectLiterals(part);
  const url=new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client","gtx");url.searchParams.set("sl","auto");url.searchParams.set("tl","zh-CN");url.searchParams.set("dt","t");url.searchParams.set("q",protectedText);
  const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store"});
  if(!response.ok)throw new Error(`free_translation_${response.status}`);
  const result=await response.json() as unknown;
  if(!Array.isArray(result)||!Array.isArray(result[0]))throw new Error("free_translation_invalid_response");
  const translated=(result[0] as unknown[]).map(item=>Array.isArray(item)&&typeof item[0]==="string"?item[0]:"").join("").trim();
  if(!translated)throw new Error("translation_empty");return restore(translated);
}

export async function POST(request:Request){
  const body=await request.json().catch(()=>({}));const text=typeof body.text==="string"?body.text:"";
  if(!text.trim())return Response.json({translated:"",complete:true});
  if(text.length>30000)return Response.json({translated:"",error:"source_too_long"},{status:413});
  try{const parts=chunks(text),translated:string[]=[];for(const part of parts)translated.push(await freeTranslate(part));return Response.json({translated:translated.join("\n\n"),complete:translated.length===parts.length,parts:parts.length,sourceLength:text.length,provider:"free-machine-translation"},{headers:{"Cache-Control":"no-store"}});}catch(error){console.error("complete_translation_failed",error);return Response.json({translated:"",complete:false,error:"translation_unavailable"},{status:502});}
}
