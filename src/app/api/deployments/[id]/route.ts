import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    const deployment = await db.deployment.findUnique({
      where: { id },
    });

    if (!deployment) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }

    if (deployment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Unauthorized access to this deployment" },
        { status: 403 }
      );
    }

    await db.deployment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting deployment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
