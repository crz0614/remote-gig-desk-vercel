import {sortTickets,tickets} from "@/lib/inbox";export async function GET(){return Response.json({tickets:sortTickets(tickets),mode:"fictional-demo",syncedAt:new Date().toISOString()});}
