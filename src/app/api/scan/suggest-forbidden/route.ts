// import { NextResponse } from "next/server";
// import { authenticateRequest } from "@/lib/auth-utils";
// import { DEFAULT_MODEL } from "@/lib/model-utils";
// import { extractSeedInfo } from "@/lib/seed-extractor";

// export async function POST(req: Request) {
//   const authUser = await authenticateRequest(req);
//   if (!authUser) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   try {
//     const body = await req.json().catch(() => ({}));
//     const {
//       systemPrompt = "",
//       tools = "[]",
//       mockResponses = "{}",
//       extractorModel = DEFAULT_MODEL,
//       forbiddenTask = "",
//     } = body;

//     const seedInfo = await extractSeedInfo(
//       extractorModel,
//       systemPrompt,
//       tools,
//       mockResponses,
//       forbiddenTask,
//     );

//     const vulnerabilities = Array.from(
//       new Set(seedInfo.things.flatMap((t) => t.vulnerabilities))
//     );

//     return NextResponse.json({
//       success: true,
//       seedInfo,
//       things: seedInfo.things,
//       vulnerabilities,
//       categories: seedInfo.businessCategories,
//     });
//   } catch (error: any) {
//     console.error("Error in suggest-forbidden API:", error);
//     return NextResponse.json(
//       { error: error.message || "Failed to suggest forbidden tasks" },
//       { status: 500 }
//     );
//   }
// }
