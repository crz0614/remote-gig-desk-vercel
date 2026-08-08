function chunks(text:string){const result:string[]=[];let rest=text.trim().slice(0,1350);while(rest&&result.length<3){let cut=Math.min(450,rest.length);if(cut<rest.length){const space=rest.lastIndexOf(" ",cut);if(space>280)cut=space;}result.push(rest.slice(0,cut));rest=rest.slice(cut).trim();}return result;}

export async function POST(request:Request){
  const body=await request.json().catch(()=>({}));const text=typeof body.text==="string"?body.text:"";
  if(!text.trim())return Response.json({translated:""});
  try{const translated:string[]=[];for(const part of chunks(text)){const url=`https://api.mymemory.translated.net/get?q=${encodeURIComponent(part)}&langpair=en|zh-CN`;const response=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error();const json=await response.json() as any;if(json.responseStatus!==200)throw new Error();translated.push(json.responseData.translatedText);}return Response.json({translated:translated.join("\n")},{headers:{"Cache-Control":"public, max-age=86400"}});}catch{return Response.json({translated:"",error:"translation_unavailable"},{status:502});}
}
