import JSZip from "jszip";

function xml(value:unknown){return String(value||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
export async function buildResumeDocx(profile:Record<string,unknown>){
  const fields:Array<[string,string]>=[
    ["",String(profile.name||"")],["",String(profile.headline||"")],["Summary",String(profile.summary||"")],
    ["Skills",String(profile.skills||"")],["Experience & Projects",String(profile.experience||"")],
    ["Verified Achievements",String(profile.achievements||"")],["Education",String(profile.education||"")],
    ["Location",String(profile.location||"")],["Languages",String(profile.languages||"")],
    ["Availability",String(profile.availability||"")],["Links",String(profile.links||"")],
  ];
  const paragraphs=fields.filter(([,value])=>value.trim()).flatMap(([heading,value])=>[
    ...(heading?[`<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>${xml(heading)}</w:t></w:r></w:p>`]:[]),
    ...value.split(/\n+/).filter(Boolean).map(line=>`<w:p><w:r><w:t xml:space="preserve">${xml(line.trim())}</w:t></w:r></w:p>`),
  ]).join("");
  const zip=new JSZip();
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.folder("_rels")!.file(".rels",`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.folder("word")!.file("document.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
}
