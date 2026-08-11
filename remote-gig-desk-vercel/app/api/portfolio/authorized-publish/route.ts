import { createHash,timingSafeEqual } from "crypto";
import { POST as publishPortfolio } from "../publish/route";

const expected="f768ea396a96de0fbbef9e306be7b95f04db8fc05c29626c0be8483e9f2f0539";

export async function GET(request:Request){
  const token=new URL(request.url).searchParams.get("token")||"";
  const actual=createHash("sha256").update(token).digest("hex");
  if(!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return Response.json({error:"invalid_authorization"},{status:403});
  return publishPortfolio();
}
